'use strict';

/**
 * salAiSuggest.service.js - SAL Fase 5-A
 *
 * Suggeritore di stato AI per clausola del SAL a partire dalle evidenze
 * documentali GIA' collegate (requirement_implementation_status.evidence_document_ids).
 *
 * Principi (spec MODULO_SAL sez. K, ADR-010, ISO 9001 par. 7.5):
 *  - human-in-the-loop OBBLIGATORIO: il servizio PROPONE, non scrive mai lo stato.
 *  - isolamento multi-tenant: ogni recupero di contesto e' filtrato a monte per
 *    organization_id + company_id PRIMA della chiamata AI (assertCompanyInOrganization
 *    + scope su document_registry). Mai aggregare contesto cross-tenant.
 *  - graceful degradation: provider AI assente, documento senza testo o clausola
 *    senza evidenze non rompono il flusso (ritorno strutturato con confidence 'low').
 *
 * Riuso (golden rule "blocco unico"):
 *  - aiProviderAdapter (chat / getActiveProvider) - nessuna API AI chiamata a mano.
 *  - documentTextExtractor.extractDocumentText - estrazione testo PDF/DOCX/txt.
 *  - gapAnalysis.service (assertCompanyInOrganization, SAL_STATUS_VALUES).
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { chat, getActiveProvider } = require('./aiProviderAdapter');
const { extractDocumentText } = require('./documentTextExtractor.service');
const normBroker = require('./normBroker.service');
const {
  assertCompanyInOrganization,
  SAL_STATUS_VALUES,
} = require('./gapAnalysis.service');

/** Troncamento testo per documento (token budget). */
const MAX_DOC_TEXT_CHARS = 6000;
/** Troncamento testo per articolo di legge (token budget). */
const MAX_LEGAL_TEXT_CHARS = 4000;
/** Numero massimo di articoli di legge valutati per clausola. */
const MAX_LEGAL_ARTICLES = 12;
/** Numero massimo di clausole per richiesta batch. */
const MAX_BATCH = 25;

const CONFIDENCE_VALUES = Object.freeze(['high', 'medium', 'low']);

/** Valori di copertura conformita' legislativa (per articolo). */
const COVERAGE_VALUES = Object.freeze(['covered', 'partial', 'missing']);

/** Sinonimi IT/EN -> valore di copertura canonico. */
const COVERAGE_SYNONYMS = Object.freeze({
  coperto: 'covered',
  conforme: 'covered',
  soddisfatto: 'covered',
  rispettato: 'covered',
  full: 'covered',
  yes: 'covered',
  si: 'covered',
  parziale: 'partial',
  parzialmente: 'partial',
  'parzialmente coperto': 'partial',
  mancante: 'missing',
  assente: 'missing',
  'non conforme': 'missing',
  'non coperto': 'missing',
  'non soddisfatto': 'missing',
  gap: 'missing',
  no: 'missing',
});

/** Sinonimi/etichette IT -> codice stato SAL canonico. */
const STATUS_SYNONYMS = Object.freeze({
  completato: 'completed',
  complete: 'completed',
  done: 'completed',
  da_validare: 'to_validate',
  'to validate': 'to_validate',
  validate: 'to_validate',
  'to-validate': 'to_validate',
  in_corso: 'in_progress',
  'in corso': 'in_progress',
  'in progress': 'in_progress',
  'in-progress': 'in_progress',
  progress: 'in_progress',
  discusso: 'discussed',
  discuss: 'discussed',
  non_applicabile: 'na',
  not_applicable: 'na',
  'n/a': 'na',
});

/**
 * Normalizza lo stato proposto dall'AI su un valore SAL ammesso, altrimenti null.
 * @param {*} raw
 * @returns {string|null}
 */
function normalizeSuggestedStatus(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (SAL_STATUS_VALUES.includes(s)) return s;
  return STATUS_SYNONYMS[s] || null;
}

/**
 * Normalizza la confidenza su high|medium|low (default low se ignoto).
 * @param {*} raw
 * @returns {'high'|'medium'|'low'}
 */
function normalizeConfidence(raw) {
  const c = String(raw == null ? '' : raw).trim().toLowerCase();
  if (CONFIDENCE_VALUES.includes(c)) return c;
  if (c === 'alta') return 'high';
  if (c === 'media') return 'medium';
  if (c === 'bassa') return 'low';
  return 'low';
}

/**
 * Normalizza la copertura legislativa su covered|partial|missing (null se ignoto).
 * @param {*} raw
 * @returns {'covered'|'partial'|'missing'|null}
 */
function normalizeCoverage(raw) {
  if (raw == null) return null;
  const c = String(raw).trim().toLowerCase();
  if (COVERAGE_VALUES.includes(c)) return c;
  return COVERAGE_SYNONYMS[c] || null;
}

/** Rimuove eventuali code fence json da una risposta AI. */
function stripCodeFences(raw) {
  let s = String(raw || '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  return s.trim();
}

/**
 * Ricava lo standard_code di un decreto dalla sua etichetta discorsiva.
 * Es. 'D.Lgs. 81/2008' -> 'DLgs_81_2008'. Ritorna null se non riconosciuto.
 * @param {string} label
 * @returns {string|null}
 */
function decreeLabelToStandardCode(label) {
  const m = String(label || '').match(/D\.?\s*Lgs\.?\s*(\d+)\s*\/\s*(\d{4})/i);
  if (!m) return null;
  return `DLgs_${m[1]}_${m[2]}`;
}

/** Etichetta canonica del decreto (es. 'D.Lgs. 81/2008'). */
function normalizeDecreeLabel(label) {
  const m = String(label || '').match(/D\.?\s*Lgs\.?\s*(\d+)\s*\/\s*(\d{4})/i);
  if (!m) return String(label || '').trim();
  return `D.Lgs. ${m[1]}/${m[2]}`;
}

/**
 * Parsea la stringa `linked_legislation` di una clausola ISO in una lista
 * ordinata di articoli di legge collegati.
 *
 * Formato atteso (matrice legislation_seed): "D.Lgs. 81/2008 art.28; art.29"
 * oppure piu' decreti "D.Lgs. 81/2008 art.15; D.Lgs. 152/2006 art.6".
 * I riferimenti articolo ("art.NN") coincidono con norm_requirements.clause_ref.
 *
 * @param {string} raw
 * @returns {Array<{decreeLabel:string, standardCode:string, clauseRef:string, articleRef:string}>}
 */
function parseLinkedLegislation(raw) {
  const str = String(raw || '').trim();
  if (!str) return [];

  const decreeRe = /D\.?\s*Lgs\.?\s*\d+\s*\/\s*\d{4}/gi;
  const artRe = /art\.\s*[\w-]+/gi;

  const out = [];
  const seen = new Set();
  let currentCode = null;
  let currentLabel = null;

  // Segmenti separati da ';' preservando l'ordine: ogni etichetta di decreto
  // incontrata aggiorna il contesto per gli articoli che seguono.
  for (const seg of str.split(';')) {
    const s = seg.trim();
    if (!s) continue;

    const decrees = s.match(decreeRe);
    if (decrees && decrees.length) {
      currentLabel = normalizeDecreeLabel(decrees[decrees.length - 1]);
      currentCode = decreeLabelToStandardCode(currentLabel);
    }
    if (!currentCode) continue;

    const arts = s.match(artRe) || [];
    for (const a of arts) {
      const clauseRef = a.replace(/\s+/g, '').toLowerCase();
      const key = `${currentCode}|${clauseRef}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        decreeLabel: currentLabel,
        standardCode: currentCode,
        clauseRef,
        articleRef: `${currentLabel} ${clauseRef}`,
      });
      if (out.length >= MAX_LEGAL_ARTICLES) return out;
    }
  }
  return out;
}

async function loadClause(normRequirementId) {
  const res = await query(
    `SELECT id, standard_code, clause_ref, clause_title, requirement_text, linked_legislation
     FROM norm_requirements
     WHERE id = @id AND is_current = 1`,
    { id: normRequirementId },
  );
  return res.recordset[0] || null;
}

/**
 * Risolve il testo degli articoli di legge collegati a una clausola ISO tramite
 * il broker normativo (cascata local_db -> publicLaw). Le leggi sono UNIVERSALI
 * (norm_requirements non e' scoped per organizzazione): nessun filtro tenant qui.
 * Graceful: articolo non trovato o errore broker -> textAvailable=false.
 *
 * @param {{linked_legislation?:string}} clause
 * @returns {Promise<Array<object>>}
 */
async function loadLegislationArticles(clause) {
  const refs = parseLinkedLegislation(clause && clause.linked_legislation);
  if (!refs.length) return [];

  const articles = [];
  for (const ref of refs) {
    let hit = null;
    try {
      // eslint-disable-next-line no-await-in-loop
      hit = await normBroker.getClauseText(ref.standardCode, ref.clauseRef);
    } catch (err) {
      logger.warn(`[SalAiSuggest] recupero articolo ${ref.articleRef} fallito: ${err.message}`);
      hit = null;
    }
    const text = hit && hit.text ? String(hit.text) : null;
    articles.push({
      articleRef: ref.articleRef,
      standardCode: ref.standardCode,
      clauseRef: ref.clauseRef,
      title: (hit && hit.title) || null,
      text: text ? text.slice(0, MAX_LEGAL_TEXT_CHARS) : null,
      sourceUrl: (hit && hit.sourceUrl) || null,
      source: (hit && hit.source) || null,
      textAvailable: !!(text && text.trim().length > 0),
    });
  }
  return articles;
}

/**
 * Carica le evidenze documentali collegate alla clausola per (org, azienda),
 * risolvendo il file corrente e il testo estraibile. Scope multi-tenant a monte.
 *
 * @returns {Promise<Array<{documentId:number,title:string,storagePath:string|null,mimeType:string|null,fileName:string|null}>>}
 */
async function loadLinkedEvidenceDocuments(organizationId, companyId, normRequirementId) {
  const risRes = await query(
    `SELECT evidence_document_ids
     FROM requirement_implementation_status
     WHERE organization_id = @orgId
       AND company_id = @companyId
       AND norm_requirement_id = @reqId`,
    { orgId: organizationId, companyId, reqId: normRequirementId },
  );
  if (!risRes.recordset.length) return [];

  const raw = risRes.recordset[0].evidence_document_ids;
  let parsed = [];
  if (raw) {
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (_) {
      parsed = [];
    }
  }

  const ids = [...new Set(
    (Array.isArray(parsed) ? parsed : [])
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n) && n > 0),
  )];
  if (!ids.length) return [];

  const placeholders = ids.map((_, i) => `@id${i}`).join(', ');
  const params = { orgId: organizationId, companyId };
  ids.forEach((id, i) => { params[`id${i}`] = id; });

  // Scope org + azienda + versione documento corrente: nessun leak cross-tenant.
  const docRes = await query(
    `SELECT dr.id AS document_id, dr.title,
            a.storage_path, a.mime_type, a.file_name
     FROM document_registry dr
     LEFT JOIN attachments a
            ON a.document_id = dr.id AND a.is_current_doc_version = 1
     WHERE dr.organization_id = @orgId
       AND dr.company_id = @companyId
       AND dr.is_current = 1
       AND dr.id IN (${placeholders})`,
    params,
  );

  return (docRes.recordset || []).map((d) => ({
    documentId: d.document_id,
    title: d.title || `Documento #${d.document_id}`,
    storagePath: d.storage_path || null,
    mimeType: d.mime_type || null,
    fileName: d.file_name || null,
  }));
}

/**
 * Costruisce il contesto (clausola + testo evidenze estratto) per una clausola.
 * @returns {Promise<{error?:string, clause?:object, evidences?:Array}>}
 */
async function buildClauseContext(organizationId, companyId, normRequirementId) {
  const clause = await loadClause(normRequirementId);
  if (!clause) return { error: 'CLAUSE_NOT_FOUND' };

  // Asse legislativo (SAL 5-B): articoli di legge collegati via linked_legislation.
  // Leggi universali -> nessuno scoping tenant; le evidenze restano scoped org+azienda.
  const legislation = await loadLegislationArticles(clause);

  const docs = await loadLinkedEvidenceDocuments(organizationId, companyId, normRequirementId);

  const evidences = [];
  for (const d of docs) {
    let text = null;
    let reason = null;
    if (d.storagePath) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const extracted = await extractDocumentText(d.storagePath, d.mimeType, d.fileName);
        text = extracted.text || null;
        reason = extracted.reason || null;
      } catch (err) {
        reason = 'extract_error';
        logger.warn(`[SalAiSuggest] estrazione doc ${d.documentId} fallita: ${err.message}`);
      }
    } else {
      reason = 'no_attachment';
    }
    evidences.push({
      documentId: d.documentId,
      title: d.title,
      text: text ? text.slice(0, MAX_DOC_TEXT_CHARS) : null,
      reason,
    });
  }

  return { clause, evidences, legislation };
}

function buildSystemPrompt(hasLegal) {
  const lines = [
    'Sei un assistente per consulenti dei sistemi di gestione ISO 9001, ISO 14001 e ISO 45001.',
    'Analizzi le evidenze documentali collegate a un requisito normativo e PROPONI lo stato di implementazione.',
    'NON prendi decisioni definitive: un professionista convalidera\u2019 sempre la proposta (human-in-the-loop).',
    'Basati ESCLUSIVAMENTE sulle evidenze fornite in questo messaggio; non inventare documenti o contenuti assenti.',
    'Rispondi SOLO con JSON valido, senza testo aggiuntivo e senza markdown.',
    '',
    'ASSE 1 - CONFORMITA\u2019 ALLA NORMA TECNICA (stato di implementazione).',
    'Stati ammessi (usa esattamente questi codici):',
    '- "discussed": requisito solo discusso, nessuna evidenza concreta di attuazione',
    '- "in_progress": attuazione parziale, evidenze incomplete',
    '- "to_validate": evidenze presenti ma da verificare/validare formalmente',
    '- "completed": requisito pienamente attuato e documentato dalle evidenze',
    '- "na": requisito non applicabile all\u2019organizzazione',
    '',
    'Livello di confidenza:',
    '- "high": le evidenze coprono chiaramente e in modo completo il requisito',
    '- "medium": evidenze parziali oppure serve interpretazione',
    '- "low": evidenze deboli, ambigue o poco pertinenti',
  ];

  if (hasLegal) {
    lines.push(
      '',
      'ASSE 2 - CONFORMITA\u2019 LEGISLATIVA (obblighi di legge collegati alla clausola).',
      'Sono forniti articoli di legge italiani collegati a questo requisito. Valuta SEPARATAMENTE,',
      'per singolo articolo, se le evidenze documentali dimostrano il rispetto dell\u2019obbligo di legge.',
      'NON confondere i due assi: lo stato di implementazione (asse 1) e la conformita\u2019 legislativa',
      '(asse 2) sono distinti e vanno riportati in campi separati.',
      'Copertura per articolo (usa esattamente questi codici):',
      '- "covered": l\u2019obbligo di legge risulta soddisfatto dalle evidenze',
      '- "partial": l\u2019obbligo risulta soddisfatto solo in parte',
      '- "missing": nessuna evidenza dimostra il rispetto dell\u2019obbligo',
      'Il testo di legge e\u2019 di pubblico dominio: puoi citarne i riferimenti. NON riprodurre il testo',
      'integrale delle norme tecniche UNI/ISO.',
    );
  }

  lines.push(
    '',
    'Formato JSON di risposta:',
    hasLegal
      ? '{"suggestedStatus":"<codice>","confidence":"<high|medium|low>","rationale":"<motivazione, max 400 caratteri>","evidenceRefs":[<id documenti usati>],"legalConfidence":"<high|medium|low>","legalConformity":[{"articleRef":"<riferimento esatto come fornito>","coverage":"<covered|partial|missing>","gap":"<lacuna sintetica o stringa vuota>","rationale":"<motivazione breve>"}]}'
      : '{"suggestedStatus":"<codice>","confidence":"<high|medium|low>","rationale":"<motivazione in italiano, max 400 caratteri>","evidenceRefs":[<id documenti realmente usati>]}',
  );

  return lines.join('\n');
}

function buildUserPrompt(clause, evidencesWithText, legalWithText) {
  const lines = [];
  lines.push(`STANDARD: ${clause.standard_code}`);
  lines.push(`CLAUSOLA: ${clause.clause_ref} - ${clause.clause_title || ''}`.trim());
  const req = String(clause.requirement_text || '').slice(0, 2000).trim();
  lines.push(`REQUISITO NORMATIVO:\n${req || '(testo requisito non disponibile)'}`);
  lines.push('');
  lines.push('EVIDENZE DOCUMENTALI COLLEGATE:');
  for (const e of evidencesWithText) {
    lines.push(`--- [documento #${e.documentId}] "${e.title}" ---`);
    lines.push(e.text);
  }

  if (Array.isArray(legalWithText) && legalWithText.length) {
    lines.push('');
    lines.push('ARTICOLI DI LEGGE COLLEGATI A QUESTA CLAUSOLA (obblighi da verificare):');
    for (const a of legalWithText) {
      lines.push(`--- [${a.articleRef}] ${a.title || ''} ---`.trim());
      lines.push(a.text);
    }
    lines.push('');
    lines.push('Per ogni articolo di legge sopra, indica in "legalConformity" se le evidenze');
    lines.push('dimostrano il rispetto dell\u2019obbligo (covered/partial/missing), usando come');
    lines.push('"articleRef" ESATTAMENTE il riferimento indicato tra parentesi quadre.');
  }

  lines.push('');
  lines.push('Valuta lo stato di implementazione del requisito sulla base delle evidenze sopra.');
  return lines.join('\n');
}

/**
 * Costruisce il risultato "conformita' legislativa" combinando gli articoli
 * risolti (con/senza testo) con la valutazione dell'AI (per articleRef).
 * Anti-allucinazione: ritorna SOLO articoli realmente collegati alla clausola.
 *
 * @param {Array<object>} legalArticles articoli risolti da loadLegislationArticles
 * @param {object} parsed JSON parsato della risposta AI
 * @returns {object}
 */
function buildLegalResult(legalArticles, parsed) {
  const rawList = Array.isArray(parsed && parsed.legalConformity) ? parsed.legalConformity : [];
  const byRef = new Map();
  for (const item of rawList) {
    if (item && item.articleRef != null) {
      byRef.set(String(item.articleRef).trim().toLowerCase(), item);
    }
  }

  const matchAi = (article) => {
    const exact = byRef.get(article.articleRef.toLowerCase());
    if (exact) return exact;
    // Fallback tollerante: match sul solo clause_ref (es. "art.28").
    for (const [key, val] of byRef.entries()) {
      if (key.includes(article.clauseRef.toLowerCase())) return val;
    }
    return null;
  };

  const articles = legalArticles.map((a) => {
    const ai = a.textAvailable ? matchAi(a) : null;
    return {
      articleRef: a.articleRef,
      standardCode: a.standardCode,
      clauseRef: a.clauseRef,
      title: a.title,
      sourceUrl: a.sourceUrl,
      source: a.source,
      textAvailable: a.textAvailable,
      coverage: a.textAvailable ? normalizeCoverage(ai && ai.coverage) : null,
      gap: ai && ai.gap ? String(ai.gap).trim().slice(0, 400) : null,
      rationale: ai && ai.rationale
        ? String(ai.rationale).trim().slice(0, 400)
        : (a.textAvailable
          ? null
          : 'Testo dell\u2019articolo non disponibile nell\u2019archivio locale: conformita\u2019 legislativa non valutabile automaticamente.'),
    };
  });

  const withText = legalArticles.filter((a) => a.textAvailable);
  return {
    evaluated: withText.length > 0,
    confidence: withText.length ? normalizeConfidence(parsed && parsed.legalConfidence) : null,
    articles,
  };
}

/**
 * Risultato legislativo quando l'AI NON e' stata interrogata (nessun testo
 * evidenza, provider assente o errore). Elenca gli articoli collegati senza
 * verdetto di copertura, per trasparenza (human-in-the-loop).
 * @param {Array<object>} legalArticles
 * @returns {object|undefined}
 */
function buildUnevaluatedLegal(legalArticles) {
  if (!legalArticles || !legalArticles.length) return undefined;
  return {
    evaluated: false,
    confidence: null,
    articles: legalArticles.map((a) => ({
      articleRef: a.articleRef,
      standardCode: a.standardCode,
      clauseRef: a.clauseRef,
      title: a.title,
      sourceUrl: a.sourceUrl,
      source: a.source,
      textAvailable: a.textAvailable,
      coverage: null,
      gap: null,
      rationale: null,
    })),
  };
}

/**
 * Proposta di stato per una singola clausola. NON scrive su DB.
 *
 * @returns {Promise<object>} proposta { normRequirementId, suggestedStatus, confidence, rationale, evidenceRefs, aiUsed, ... }
 */
async function suggestForClause(organizationId, companyId, normRequirementId) {
  const ctx = await buildClauseContext(organizationId, companyId, normRequirementId);
  if (ctx.error) {
    return { normRequirementId, error: ctx.error };
  }
  const { clause, evidences, legislation = [] } = ctx;

  const base = {
    normRequirementId,
    clauseRef: clause.clause_ref,
    clauseTitle: clause.clause_title,
    standardCode: clause.standard_code,
  };
  // Sezione legislativa presente solo se la clausola ha leggi collegate (graceful).
  const legalBase = legislation.length ? { legal: buildUnevaluatedLegal(legislation) } : {};

  const withText = evidences.filter((e) => e.text && e.text.trim().length > 0);
  const legalWithText = legislation.filter((a) => a.textAvailable);

  // Nessun testo estraibile -> nessuna chiamata AI (graceful, zero token spesi).
  if (!withText.length) {
    return {
      ...base,
      ...legalBase,
      suggestedStatus: null,
      confidence: 'low',
      rationale: evidences.length
        ? 'Le evidenze collegate non contengono testo estraibile (PDF immagine, formato non supportato o file mancante). Collega documenti con testo leggibile oppure valuta manualmente.'
        : 'Nessuna evidenza documentale collegata a questa clausola. Collega i documenti dal registro prima di richiedere un suggerimento AI.',
      evidenceRefs: evidences.map((e) => ({
        documentId: e.documentId,
        title: e.title,
        used: false,
        reason: e.reason,
      })),
      aiUsed: false,
    };
  }

  const hasLegal = legalWithText.length > 0;
  const messages = [
    { role: 'system', content: buildSystemPrompt(hasLegal) },
    { role: 'user', content: buildUserPrompt(clause, withText, legalWithText) },
  ];

  let result;
  try {
    result = await chat(messages, { temperature: 0.2, responseFormat: 'json', maxTokens: hasLegal ? 1100 : 700 });
  } catch (err) {
    logger.warn(`[SalAiSuggest] chat fallita clausola ${clause.clause_ref}: ${err.message}`);
    return {
      ...base,
      ...legalBase,
      suggestedStatus: null,
      confidence: 'low',
      rationale: 'Servizio AI non raggiungibile al momento. Riprova piu\u2019 tardi o valuta manualmente.',
      evidenceRefs: withText.map((e) => ({ documentId: e.documentId, title: e.title, used: false })),
      aiUsed: false,
      aiError: err.code || 'AI_ERROR',
    };
  }

  let parsed = {};
  try {
    parsed = JSON.parse(stripCodeFences(result.content));
  } catch (_) {
    parsed = {};
  }

  const suggestedStatus = normalizeSuggestedStatus(parsed.suggestedStatus);
  const confidence = normalizeConfidence(parsed.confidence);
  const rationale = String(parsed.rationale || '').trim().slice(0, 600)
    || 'Nessuna motivazione fornita dall\u2019AI.';

  // evidenceRefs: solo id realmente collegati (anti-allucinazione), con flag "used".
  const usedIds = new Set(
    (Array.isArray(parsed.evidenceRefs) ? parsed.evidenceRefs : [])
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n)),
  );
  const evidenceRefs = withText.map((e) => ({
    documentId: e.documentId,
    title: e.title,
    used: usedIds.has(e.documentId),
  }));

  // Asse legislativo: valutato se ci sono articoli con testo, altrimenti elenco
  // trasparente senza verdetto (articoli senza testo in local_db).
  const legal = legislation.length
    ? (hasLegal ? buildLegalResult(legislation, parsed) : buildUnevaluatedLegal(legislation))
    : undefined;

  return {
    ...base,
    suggestedStatus: suggestedStatus || (confidence === 'low' ? 'discussed' : suggestedStatus),
    confidence,
    rationale,
    evidenceRefs,
    ...(legal ? { legal } : {}),
    aiUsed: true,
    model: result.model || null,
    tokens: result.tokens || null,
    cost: result.cost || null,
  };
}

/**
 * Orchestratore: proposta AI per una o piu' clausole di un'azienda.
 * Scope multi-tenant una sola volta; provider assente = graceful (aiAvailable=false).
 *
 * @param {object} params
 * @param {number} params.organizationId
 * @param {number|string} params.companyId
 * @param {number} [params.normRequirementId]        singola clausola
 * @param {Array<number>} [params.normRequirementIds] batch clausole
 * @returns {Promise<{error?:string, data?:object}>}
 */
async function suggestSalStatus({
  organizationId,
  companyId,
  normRequirementId = null,
  normRequirementIds = null,
}) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return { error: 'NOT_FOUND' };

  // Normalizza l'elenco richiesto (singola o batch).
  let requested = [];
  if (Array.isArray(normRequirementIds) && normRequirementIds.length) {
    requested = normRequirementIds;
  } else if (normRequirementId != null) {
    requested = [normRequirementId];
  }
  const ids = [...new Set(
    requested
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n) && n > 0),
  )];

  if (!ids.length) {
    return { error: 'VALIDATION', message: 'normRequirementId o normRequirementIds obbligatorio' };
  }
  if (ids.length > MAX_BATCH) {
    return { error: 'VALIDATION', message: `Massimo ${MAX_BATCH} clausole per richiesta` };
  }

  const provider = getActiveProvider();
  if (!provider) {
    // Graceful degradation: la pagina SAL non deve rompersi (ADR-010 par. 1).
    return {
      data: {
        companyId: scoped.companyId,
        aiAvailable: false,
        message: 'Nessun provider AI configurato: suggeritore stato non disponibile.',
        suggestions: [],
      },
    };
  }

  const suggestions = [];
  const tokenTotals = { input: 0, output: 0 };
  let model = null;
  let legalEvaluatedCount = 0;

  for (const reqId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const suggestion = await suggestForClause(organizationId, scoped.companyId, reqId);
    if (suggestion.tokens) {
      tokenTotals.input += suggestion.tokens.input || 0;
      tokenTotals.output += suggestion.tokens.output || 0;
    }
    if (suggestion.model) model = suggestion.model;
    if (suggestion.legal && suggestion.legal.evaluated) legalEvaluatedCount += 1;
    suggestions.push(suggestion);
  }

  // Audit trail (ai_interactions): un unico feature 'sal_suggest'; l'asse legislativo
  // e' tracciato nel context_summary (nessuna modifica schema, coerente con 5-A).
  const legalNote = legalEvaluatedCount
    ? `, conformita legislativa su ${legalEvaluatedCount} clausola/e`
    : '';

  return {
    data: {
      companyId: scoped.companyId,
      aiAvailable: true,
      provider,
      suggestions,
    },
    meta: {
      provider,
      model,
      tokens: tokenTotals,
      contextSummary: `SAL AI suggest (norma tecnica + legge) - azienda ${scoped.companyId}, ${ids.length} clausola/e${legalNote}`,
    },
  };
}

module.exports = {
  suggestSalStatus,
  suggestForClause,
  buildClauseContext,
  loadLegislationArticles,
  parseLinkedLegislation,
  decreeLabelToStandardCode,
  normalizeSuggestedStatus,
  normalizeConfidence,
  normalizeCoverage,
  MAX_BATCH,
  MAX_LEGAL_ARTICLES,
};
