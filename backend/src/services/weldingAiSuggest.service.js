'use strict';

/**
 * weldingAiSuggest.service.js
 *
 * Suggeritore di conformita' AI per le clausole ISO 3834-3 rilevanti di una
 * commessa (progetto di saldatura), replicando il pattern gia' in produzione
 * per il SAL (`salAiSuggest.service.js`, ADR-010):
 *  - human-in-the-loop OBBLIGATORIO: il servizio PROPONE, non scrive mai stati
 *    o esiti sulla commessa.
 *  - isolamento multi-tenant: la commessa viene sempre risolta con
 *    organization_id dal JWT PRIMA di costruire qualunque contesto AI.
 *  - graceful degradation: provider AI assente, commessa senza WPS/documenti
 *    o errore di rete non rompono il flusso (risposta strutturata, mai 500
 *    per condizioni previste).
 *
 * Differenza rispetto al SAL (semplificazione intenzionale, da evolvere):
 * le commesse non hanno ancora un collegamento evidenza-per-clausola
 * (l'equivalente di `requirement_implementation_status.evidence_document_ids`).
 * Il contesto usa i dati strutturati della commessa (WPS applicabili, checklist
 * riesame tecnico §5.3, note/descrizione) + i documenti CORRENTI dell'azienda
 * collegata (stesso estrattore `documentTextExtractor` del SAL, senza mappatura
 * per-clausola: sono evidenze aziendali generiche, non specifiche per requisito).
 *
 * Riuso (golden rule "blocco unico"):
 *  - aiProviderAdapter (chat / getActiveProvider) - nessuna API AI a mano.
 *  - documentTextExtractor.extractDocumentText - stesso estrattore di SAL.
 *  - salAiSuggest.service (normalizeConfidence, normalizeCoverage) - stessi
 *    vocabolari/sinonimi IT-EN, nessuna duplicazione di mappe.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { chat, getActiveProvider } = require('./aiProviderAdapter');
const { extractDocumentText } = require('./documentTextExtractor.service');
const { normalizeConfidence, normalizeCoverage } = require('./salAiSuggest.service');

/** Standard ISO 3834-3 di riferimento (unico gia' importato in norm_requirements). */
const DEFAULT_STANDARD_CODE = 'ISO_3834_3_2021';

/**
 * Clausole macro rilevanti per una commessa operativa (riesame, produzione,
 * ispezioni/prove, non conformita', identificazione/rintracciabilita').
 * Elenco curato e volutamente ridotto (token budget) rispetto alle 35 clausole
 * totali della norma: estendibile passando `clauseRefs` espliciti al servizio.
 */
const DEFAULT_TOP_LEVEL_CLAUSES = Object.freeze(['5', '10', '14', '15', '17']);

const MAX_DOC_TEXT_CHARS = 4000;
const MAX_EVIDENCE_DOCS = 5;
const MAX_CLAUSES = 20;

/** Rimuove eventuali code fence json da una risposta AI (stesso helper di SAL). */
function stripCodeFences(raw) {
  let s = String(raw || '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  return s.trim();
}

/** Carica la commessa nello scope dell'organizzazione (mai cross-tenant). */
async function loadProjectForOrg(organizationId, projectId) {
  const res = await query(
    `SELECT p.*, c.name AS company_name
     FROM projects p
     LEFT JOIN companies c ON p.company_id = c.id
     WHERE p.id = @id AND p.organization_id = @orgId`,
    { id: projectId, orgId: organizationId },
  );
  return res.recordset[0] || null;
}

/** Risolve le WPS applicabili (dettagli minimi: codice, processo, materiale). */
async function loadApplicableWps(organizationId, project) {
  if (!project.applicable_wps_ids) return [];
  let ids = [];
  try {
    const parsed = JSON.parse(project.applicable_wps_ids);
    ids = Array.isArray(parsed) ? parsed.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n)) : [];
  } catch (_) {
    return [];
  }
  if (!ids.length) return [];

  const placeholders = ids.map((_, i) => `@id${i}`).join(', ');
  const params = { orgId: organizationId };
  ids.forEach((id, i) => { params[`id${i}`] = id; });

  const res = await query(
    `SELECT id, wps_code, revision, welding_process, material_group, status
     FROM welding_procedures
     WHERE organization_id = @orgId AND id IN (${placeholders})`,
    params,
  );
  return res.recordset || [];
}

/**
 * Clausole ISO 3834-3 rilevanti: elenco esplicito (clauseRefs) oppure le
 * macro-clausole di default (DEFAULT_TOP_LEVEL_CLAUSES + relative sotto-clausole).
 */
async function loadRelevantClauses(standardCode, clauseRefs) {
  if (Array.isArray(clauseRefs) && clauseRefs.length) {
    const refs = [...new Set(clauseRefs.map((r) => String(r).trim()).filter(Boolean))].slice(0, MAX_CLAUSES);
    const placeholders = refs.map((_, i) => `@ref${i}`).join(', ');
    const params = { standardCode };
    refs.forEach((r, i) => { params[`ref${i}`] = r; });
    const res = await query(
      `SELECT id, standard_code, clause_ref, clause_title, requirement_text
       FROM norm_requirements
       WHERE standard_code = @standardCode AND is_current = 1 AND clause_ref IN (${placeholders})`,
      params,
    );
    return res.recordset || [];
  }

  const conditions = DEFAULT_TOP_LEVEL_CLAUSES
    .map((_, i) => `clause_ref = @top${i} OR clause_ref LIKE @topLike${i}`)
    .join(' OR ');
  const params = { standardCode };
  DEFAULT_TOP_LEVEL_CLAUSES.forEach((top, i) => {
    params[`top${i}`] = top;
    params[`topLike${i}`] = `${top}.%`;
  });

  const res = await query(
    `SELECT id, standard_code, clause_ref, clause_title, requirement_text
     FROM norm_requirements
     WHERE standard_code = @standardCode AND is_current = 1 AND (${conditions})`,
    params,
  );
  return (res.recordset || []).slice(0, MAX_CLAUSES);
}

/**
 * Documenti correnti dell'azienda collegata alla commessa (evidenze generiche,
 * non mappate per clausola - vedi nota di semplificazione in testa al file).
 */
async function loadCompanyEvidenceDocs(organizationId, companyId) {
  if (!companyId) return [];
  const res = await query(
    `SELECT TOP ${MAX_EVIDENCE_DOCS} dr.id AS document_id, dr.title,
            a.storage_path, a.mime_type, a.file_name
     FROM document_registry dr
     LEFT JOIN attachments a
            ON a.document_id = dr.id AND a.is_current_doc_version = 1
     WHERE dr.organization_id = @orgId
       AND dr.company_id = @companyId
       AND dr.is_current = 1
       AND dr.doc_type <> 'folder'
     ORDER BY dr.updated_at DESC`,
    { orgId: organizationId, companyId },
  );

  const docs = res.recordset || [];
  const evidences = [];
  for (const d of docs) {
    let text = null;
    if (d.storage_path) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const extracted = await extractDocumentText(d.storage_path, d.mime_type, d.file_name);
        text = extracted.text || null;
      } catch (err) {
        logger.warn(`[WeldingAiSuggest] estrazione doc ${d.document_id} fallita: ${err.message}`);
      }
    }
    evidences.push({
      documentId: d.document_id,
      title: d.title || `Documento #${d.document_id}`,
      text: text ? text.slice(0, MAX_DOC_TEXT_CHARS) : null,
    });
  }
  return evidences;
}

function buildSystemPrompt() {
  return [
    'Sei un assistente per coordinatori di saldatura (IWE/IWT/IWS) secondo ISO 3834.',
    'Analizzi i dati di una commessa (WPS applicabili, riesame tecnico, note) e i documenti',
    'aziendali disponibili, e PROPONI lo stato di copertura rispetto a clausole ISO 3834-3.',
    'NON prendi decisioni definitive: un professionista convalidera\u2019 sempre la proposta',
    '(human-in-the-loop, nessuna scrittura automatica sui dati della commessa).',
    'Basati ESCLUSIVAMENTE sui dati fornititi in questo messaggio; non inventare documenti,',
    'certificazioni o contenuti assenti.',
    'Rispondi SOLO con JSON valido, senza testo aggiuntivo e senza markdown.',
    '',
    'Per ciascuna clausola elencata valuta la copertura (usa esattamente questi codici):',
    '- "covered": la commessa dimostra chiaramente il rispetto del requisito',
    '- "partial": copertura solo parziale o da completare',
    '- "missing": nessun elemento fornito dimostra il rispetto del requisito',
    'Livello di confidenza: "high" | "medium" | "low".',
    '',
    'Formato JSON di risposta:',
    '{"clauses":[{"clauseRef":"<esattamente come fornito>","coverage":"<covered|partial|missing>",'
      + '"confidence":"<high|medium|low>","rationale":"<motivazione in italiano, max 400 caratteri>"}]}',
  ].join('\n');
}

function buildUserPrompt(project, wpsList, clauses, evidences) {
  const lines = [];
  lines.push(`COMMESSA: ${project.project_code}${project.company_name ? ` \u2014 ${project.company_name}` : ''}`);
  if (project.description) lines.push(`Descrizione: ${String(project.description).slice(0, 500)}`);
  if (project.notes) lines.push(`Note: ${String(project.notes).slice(0, 500)}`);

  lines.push('');
  lines.push('WPS APPLICABILI:');
  if (wpsList.length) {
    for (const w of wpsList) {
      lines.push(`- ${w.wps_code}${w.revision ? ` (Rev. ${w.revision})` : ''} \u2014 processo ${w.welding_process || 'n/d'}, materiale ${w.material_group || 'n/d'}, stato ${w.status || 'n/d'}`);
    }
  } else {
    lines.push('- Nessuna WPS applicabile assegnata alla commessa.');
  }

  if (project.technical_review_checklist) {
    let checklist = null;
    try { checklist = JSON.parse(project.technical_review_checklist); } catch (_) { checklist = null; }
    if (checklist && typeof checklist === 'object') {
      const checked = Object.entries(checklist).filter(([, v]) => v && v.checked).length;
      const total = Object.keys(checklist).length;
      lines.push('');
      lines.push(`RIESAME TECNICO \u00A75.3: ${checked}/${total} punti verificati.`);
      for (const [key, val] of Object.entries(checklist)) {
        if (val && (val.checked || val.note)) {
          lines.push(`- ${key}: ${val.checked ? 'verificato' : 'non verificato'}${val.note ? ` (${val.note})` : ''}`);
        }
      }
    }
  }

  lines.push('');
  lines.push('DOCUMENTI AZIENDALI DISPONIBILI (evidenze generiche, non specifiche per clausola):');
  const withText = evidences.filter((e) => e.text);
  if (withText.length) {
    for (const e of withText) {
      lines.push(`--- [documento #${e.documentId}] "${e.title}" ---`);
      lines.push(e.text);
    }
  } else {
    lines.push('- Nessun documento con testo estraibile disponibile.');
  }

  lines.push('');
  lines.push('CLAUSOLE ISO 3834-3 DA VALUTARE:');
  for (const c of clauses) {
    lines.push(`--- [${c.clause_ref}] ${c.clause_title || ''} ---`.trim());
    lines.push(String(c.requirement_text || '').slice(0, 800));
  }

  lines.push('');
  lines.push('Valuta la copertura di ciascuna clausola elencata sopra sulla base dei dati fornititi.');
  return lines.join('\n');
}

/**
 * Proposta di conformita' 3834-3 per una commessa. NON scrive su DB.
 *
 * @param {object} params
 * @param {number} params.organizationId
 * @param {number|string} params.projectId
 * @param {string} [params.standardCode] default ISO_3834_3_2021
 * @param {Array<string>} [params.clauseRefs] elenco esplicito di clausole (opzionale)
 * @returns {Promise<{error?:string, data?:object, meta?:object}>}
 */
async function suggestWeldingCompliance({
  organizationId,
  projectId,
  standardCode = DEFAULT_STANDARD_CODE,
  clauseRefs = null,
}) {
  const pid = parseInt(projectId, 10);
  if (!Number.isFinite(pid) || pid <= 0) {
    return { error: 'VALIDATION', message: 'projectId non valido' };
  }

  const project = await loadProjectForOrg(organizationId, pid);
  if (!project) return { error: 'PROJECT_NOT_FOUND' };

  const clauses = await loadRelevantClauses(standardCode, clauseRefs);
  if (!clauses.length) {
    return {
      data: {
        projectId: project.id,
        projectCode: project.project_code,
        aiAvailable: false,
        message: 'Nessuna clausola ISO 3834-3 trovata per la valutazione (verificare import norme).',
        suggestions: [],
      },
    };
  }

  const provider = getActiveProvider();
  if (!provider) {
    // Graceful degradation: la pagina commesse non deve rompersi (ADR-010 §1).
    return {
      data: {
        projectId: project.id,
        projectCode: project.project_code,
        aiAvailable: false,
        message: 'Nessun provider AI configurato: suggeritore conformita\u2019 non disponibile.',
        suggestions: [],
      },
    };
  }

  const wpsList = await loadApplicableWps(organizationId, project);
  const evidences = await loadCompanyEvidenceDocs(organizationId, project.company_id);

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserPrompt(project, wpsList, clauses, evidences) },
  ];

  let result;
  try {
    result = await chat(messages, { temperature: 0.2, responseFormat: 'json', maxTokens: 1400 });
  } catch (err) {
    logger.warn(`[WeldingAiSuggest] chat fallita commessa ${project.project_code}: ${err.message}`);
    return {
      data: {
        projectId: project.id,
        projectCode: project.project_code,
        aiAvailable: true,
        provider,
        message: 'Servizio AI non raggiungibile al momento. Riprova pi\u00f9 tardi o valuta manualmente.',
        suggestions: clauses.map((c) => ({
          clauseRef: c.clause_ref,
          clauseTitle: c.clause_title,
          coverage: null,
          confidence: 'low',
          rationale: 'Servizio AI non raggiungibile.',
        })),
      },
    };
  }

  let parsed = {};
  try {
    parsed = JSON.parse(stripCodeFences(result.content));
  } catch (_) {
    parsed = {};
  }

  const rawList = Array.isArray(parsed.clauses) ? parsed.clauses : [];
  const byRef = new Map();
  for (const item of rawList) {
    if (item && item.clauseRef != null) byRef.set(String(item.clauseRef).trim(), item);
  }

  const suggestions = clauses.map((c) => {
    const ai = byRef.get(c.clause_ref);
    return {
      clauseRef: c.clause_ref,
      clauseTitle: c.clause_title,
      coverage: normalizeCoverage(ai && ai.coverage),
      confidence: normalizeConfidence(ai && ai.confidence),
      rationale: (ai && ai.rationale ? String(ai.rationale).trim().slice(0, 400) : null)
        || 'Nessuna motivazione fornita dall\u2019AI.',
    };
  });

  return {
    data: {
      projectId: project.id,
      projectCode: project.project_code,
      aiAvailable: true,
      provider,
      suggestions,
    },
    meta: {
      provider,
      model: result.model || null,
      tokens: result.tokens || null,
      contextSummary: `Welding AI suggest (ISO 3834-3) - commessa ${project.project_code}, ${clauses.length} clausola/e, ${wpsList.length} WPS`,
    },
  };
}

module.exports = {
  suggestWeldingCompliance,
  loadRelevantClauses,
  loadApplicableWps,
  loadCompanyEvidenceDocs,
  DEFAULT_STANDARD_CODE,
  DEFAULT_TOP_LEVEL_CLAUSES,
  MAX_CLAUSES,
};
