const logger = require('../utils/logger');

/**
 * Build context for contract review requirements analysis.
 * @param {object} params
 * @param {string} params.capitolatoText - Extracted text from the uploaded RFQ/spec document
 * @param {number} params.companyId - Azienda SGQ le cui capacità si valutano (es. LM&CO)
 * @param {number} params.organizationId - Tenant scope
 * @param {string} [params.commercialCustomerName] - Committente commerciale del lavoro (es. PT.MAIDO)
 * @param {string} [params.commercialCustomerRef] - Riferimento esterno del committente commerciale
 * @param {string[]} [params.standardCodes] - Specific standards to check against
 * @returns {Promise<{systemPrompt: string, userPrompt: string, contextSummary: string}>}
 */
async function buildReviewRequirementsContext({
  capitolatoText,
  companyId,
  organizationId,
  commercialCustomerName,
  commercialCustomerRef,
  standardCodes,
}) {
  // 1. Load norm clauses for specified standards (or auto-detect from text)
  let normContext = '';
  try {
    const normBroker = require('./normBroker.service');
    const standards = standardCodes || ['ISO_9001_2015'];
    for (const code of standards) {
      const clauses = await normBroker.getFullNorm(code);
      if (clauses && clauses.length > 0) {
        normContext += `\n\n--- Requisiti ${code} ---\n`;
        for (const c of clauses.slice(0, 80)) {
          // limit to avoid token overflow
          if (c.requirement_text && c.requirement_text.trim()) {
            normContext += `§${c.clause_ref} ${c.clause_title || ''}: ${c.requirement_text.substring(0, 300)}\n`;
          }
        }
      }
    }
  } catch (err) {
    logger.warn('[AI_CONTEXT] NormBroker not available, proceeding without norm context:', err.message);
  }

  // 1b. Semantic search from indexed norm chunks
  try {
    const normChunker = require('./normChunker.service');
    const searchQuery = capitolatoText.substring(0, 1000);
    const relevantChunks = await normChunker.searchSimilar(searchQuery, organizationId, {
      topK: 15,
      minScore: 0.25,
    });
    if (relevantChunks.length > 0) {
      normContext += '\n\nContenuto normativo aggiuntivo pertinente al capitolato:';
      for (const chunk of relevantChunks) {
        normContext += `\n[${chunk.standard_code || 'DOC'}] ${chunk.chunk_text.substring(0, 400)}`;
      }
    }
  } catch (err) {
    logger.debug('[AI_CONTEXT] Semantic search for review not available:', err.message);
  }

  // 2. Profilo azienda SGQ (capacità da valutare — NON confondere con il committente commerciale)
  let capabilityContext = '';
  let capabilityLabel = companyId ? `azienda id ${companyId}` : 'N/D';
  try {
    const { query } = require('../config/database');
    if (companyId) {
      const result = await query(
        'SELECT name, vat_number, sector, address FROM companies WHERE id = @id AND organization_id = @orgId',
        { id: companyId, orgId: organizationId }
      );
      if (result.recordset.length > 0) {
        const c = result.recordset[0];
        capabilityLabel = c.name || capabilityLabel;
        capabilityContext =
          `\nEnte che riesamina le capacità (azienda SGQ): ${c.name}` +
          ` (P.IVA: ${c.vat_number || 'N/D'}, Settore: ${c.sector || 'N/D'}, Sede: ${c.address || 'N/D'})` +
          '\nValuta se QUESTA azienda ha capacità, qualifiche, attrezzature e documentazione per eseguire il lavoro.';
      }
    }
  } catch (err) {
    logger.warn('[AI_CONTEXT] Company lookup failed:', err.message);
  }

  const commercialName =
    commercialCustomerName != null && String(commercialCustomerName).trim() !== ''
      ? String(commercialCustomerName).trim()
      : null;
  const commercialRef =
    commercialCustomerRef != null && String(commercialCustomerRef).trim() !== ''
      ? String(commercialCustomerRef).trim()
      : null;
  let commercialCustomerContext = '';
  if (commercialName) {
    commercialCustomerContext =
      `\nCommittente commerciale del lavoro (cliente del capitolato): ${commercialName}` +
      (commercialRef ? ` (rif. ${commercialRef})` : '') +
      '\nI requisiti nel capitolato provengono da questo committente; NON confonderlo con l\'ente che riesamina le capacità.';
  }

  // 3. Build prompts
  const systemPrompt = `Sei un esperto di sistemi di gestione qualità ISO e riesame requisiti contrattuali (ISO 9001:2015 §8.2).
Il tuo compito è analizzare un capitolato/richiesta d'offerta e:
1. Identificare tutti i requisiti tecnici espliciti
2. Identificare le norme e standard citati o applicabili
3. Per ogni requisito, valutare se l'ente che riesamina le capacità ha le competenze/documentazione necessarie per soddisfare il committente commerciale
4. Segnalare i GAP (requisiti non soddisfatti o da verificare)
5. Suggerire azioni per colmare i gap

Rispondi SEMPRE in italiano. Rispondi SOLO con JSON valido nel formato specificato.
${normContext ? '\nHai accesso ai seguenti requisiti normativi come riferimento:' + normContext : ''}
${capabilityContext ? '\nContesto capacità:' + capabilityContext : ''}
${commercialCustomerContext ? '\nContesto committente:' + commercialCustomerContext : ''}`;

  const userPrompt = `Analizza il seguente capitolato/richiesta d'offerta e produci un JSON con questa struttura:
{
  "identified_requirements": [
    {
      "ref": "REQ-01",
      "description": "descrizione requisito",
      "source": "dove nel capitolato",
      "applicable_norms": ["ISO 9001:2015 §8.4", ...],
      "assessment": "satisfied|gap|to_verify",
      "gap_detail": "dettaglio gap se presente",
      "suggested_action": "azione suggerita se gap"
    }
  ],
  "identified_standards": ["ISO 9001:2015", "ISO 3834-2", ...],
  "overall_risk": "low|medium|high",
  "summary": "sintesi dell'analisi"
}

CAPITOLATO:
---
${capitolatoText}
---`;

  const summaryParts = [`capacità: ${capabilityLabel}`];
  if (commercialName) summaryParts.push(`committente: ${commercialName}`);
  summaryParts.push(`standards: ${(standardCodes || ['auto']).join(',')}`);

  return {
    systemPrompt,
    userPrompt,
    contextSummary: `Review requirements — ${summaryParts.join('; ')}`,
  };
}

/**
 * Build context for audit conclusions suggestion.
 * Accepts the full audit context: metrics, NC/OSS details, existing conclusions,
 * and per-standard breakdown. Supports two modes:
 *   - existingConclusions present → AI refines/improves what the auditor wrote
 *   - existingConclusions empty   → AI generates a proposal from scratch
 *
 * Enrichment:
 *   - Loads relevant normative clauses from DB for cited findings (Level A)
 *   - Loads past accepted/rephrased conclusions as few-shot examples (Level C)
 *
 * @param {object} params
 * @param {object} params.auditMetrics - { total, nc, oss, om, nv, conformities }
 * @param {string[]} params.standardCodes - e.g. ['ISO_9001_2015']
 * @param {Array} [params.findings] - [{ clauseRef, status, notes, standardCode }]
 * @param {string} [params.existingConclusions] - text already written by the auditor
 * @param {object} [params.byStandardConclusions] - { ISO_9001_2015: "text", ... }
 * @param {string} [params.auditObject] - object/scope of the audit
 * @param {string} [params.auditDescription] - objective description
 * @param {string} [params.mode] - 'generate' | 'refine' (auto-detected if omitted)
 * @param {number} [params.userId] - for loading personalized few-shot examples
 * @param {number} [params.organizationId] - tenant scope for feedback lookup
 * @returns {Promise<{systemPrompt: string, userPrompt: string, contextSummary: string}>}
 */
async function buildAuditConclusionsContext({
  auditMetrics,
  standardCodes,
  findings,
  existingConclusions,
  byStandardConclusions,
  auditObject,
  auditDescription,
  mode,
  userId,
  organizationId,
}) {
  const codes = standardCodes || ['ISO_9001_2015'];
  const labels = codes.map(c => c.replace(/_/g, ' ')).join(', ');
  const hasExisting = !!(existingConclusions && existingConclusions.trim());
  const effectiveMode = mode || (hasExisting ? 'refine' : 'generate');

  // --- Level A: Load normative clauses for cited findings ---
  let normContext = '';
  try {
    const normBroker = require('./normBroker.service');
    const relevantRefs = (findings || [])
      .filter(f => f.clauseRef && f.status !== 'COMPLIANT')
      .map(f => ({ ref: f.clauseRef.split('.').slice(0, 2).join('.'), std: f.standardCode }));

    const seen = new Set();
    for (const { ref, std } of relevantRefs) {
      const key = `${std}:${ref}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const clause = await normBroker.getClauseText(std || codes[0], ref);
      if (clause && clause.text) {
        normContext += `\n§${ref} (${(std || codes[0]).replace(/_/g, ' ')}): ${clause.text.substring(0, 400)}`;
      }
    }
    if (!normContext && codes.length > 0) {
      const allClauses = await normBroker.getFullNorm(codes[0]);
      if (allClauses && allClauses.length > 0) {
        normContext = '\n\nRiferimenti normativi principali:';
        for (const c of allClauses.slice(0, 20)) {
          if (c.requirement_text) {
            normContext += `\n§${c.clause_ref} ${c.clause_title || ''}: ${c.requirement_text.substring(0, 200)}`;
          }
        }
      }
    }
  } catch (err) {
    logger.warn('[AI_CONTEXT] NormBroker enrichment failed for conclusions:', err.message);
  }

  // --- Level A2: Semantic search from indexed norms ---
  try {
    const normChunker = require('./normChunker.service');
    const queryParts = (findings || [])
      .filter(f => f.status !== 'COMPLIANT' && f.notes)
      .slice(0, 5)
      .map(f => f.notes)
      .join('. ');
    const searchQuery = `Conclusioni audit ${labels}: ${queryParts || auditObject || 'sistema di gestione qualità'}`;

    const relevantChunks = await normChunker.searchSimilar(searchQuery, organizationId, {
      standardCodes: codes,
      topK: 8,
      minScore: 0.3,
    });

    if (relevantChunks.length > 0) {
      normContext += '\n\nContenuto normativo pertinente (da documenti caricati):';
      for (const chunk of relevantChunks) {
        normContext += `\n[${chunk.standard_code || 'DOC'}] ${chunk.chunk_text.substring(0, 500)}`;
      }
    }
  } catch (err) {
    logger.debug('[AI_CONTEXT] Semantic search not available:', err.message);
  }

  // --- Level C: Load past accepted conclusions as few-shot examples ---
  let fewShotBlock = '';
  try {
    const { query } = require('../config/database');
    const feedbackRows = await query(
      `SELECT TOP 3 final_text FROM ai_feedback
       WHERE feature = 'audit_conclusions'
         AND action IN ('accepted', 'rephrased')
         AND user_id = @userId
         AND organization_id = @orgId
         AND final_text IS NOT NULL AND LEN(final_text) > 50
       ORDER BY created_at DESC`,
      { userId: userId || 0, orgId: organizationId || 0 }
    );
    if (feedbackRows.recordset && feedbackRows.recordset.length > 0) {
      fewShotBlock = '\n\nEsempi di conclusioni già approvate da questo auditor (imita questo stile):';
      for (const row of feedbackRows.recordset) {
        fewShotBlock += `\n---\n${row.final_text.substring(0, 600)}\n---`;
      }
    }
  } catch (err) {
    logger.debug('[AI_CONTEXT] ai_feedback table not available yet (Level C):', err.message);
  }

  const systemPrompt = `Sei un lead auditor ISO esperto con 15+ anni di esperienza su ${labels}.
Scrivi conclusioni di audit formali, professionali, in italiano, coerenti con lo stile di un verbale di audit ISO 19011:2018.

Riferimento ISO 19011:2018 — Struttura delle conclusioni dell'audit (§6.4.9):
Le conclusioni dell'audit devono affrontare:
a) il grado di conformità del sistema di gestione rispetto ai criteri dell'audit;
b) l'efficace attuazione, mantenimento e miglioramento del sistema di gestione;
c) la capacità del processo di riesame della direzione di assicurare l'idoneità e l'efficacia del sistema;
d) il raggiungimento degli obiettivi dell'audit, la copertura del campo dell'audit e il soddisfacimento dei criteri di audit;
e) i rilievi simili identificati in aree diverse (che evidenziano un pattern sistemico);
f) le raccomandazioni per il miglioramento e le buone pratiche identificate.

Regole operative:
- Le conclusioni devono essere specifiche, mai generiche. Cita i numeri reali (quante NC, quante OSS, quali clausole).
- Se ci sono NC, indica chiaramente che il sistema non è pienamente conforme e quali aree richiedono azioni correttive.
- Se ci sono solo OSS, il giudizio è positivo ma con raccomandazioni di miglioramento.
- Se tutto è conforme, esprimi un giudizio positivo ma professionale (mai enfatico).
- Organizza il testo in paragrafi logici: giudizio generale → dettaglio rilievi → raccomandazioni.
- Usa un linguaggio da verbale ufficiale, non da chat.
${effectiveMode === 'refine' ? '\nL\'auditor ha già scritto una bozza di conclusioni. Migliorala: mantieni il suo stile e le informazioni corrette, arricchisci con dettagli dalle evidenze, correggi eventuali imprecisioni, rendi il testo più completo e professionale.' : ''}
${normContext ? '\nRequisiti normativi pertinenti ai rilievi:' + normContext : ''}${fewShotBlock}

Rispondi SOLO con JSON valido:
{
  "conclusion_text": "testo conclusioni (può contenere \\n per a capo)",
  "recommendation": "conforme|conforme_con_osservazioni|non_conforme",
  "key_findings_summary": "riepilogo sintetico dei rilievi principali (1-2 frasi)"
}`;

  const findingsSummary = (findings || [])
    .filter(f => f.status && f.status !== 'COMPLIANT' && f.status !== 'NOT_ANSWERED')
    .map(f => {
      const tag = f.status === 'NON_COMPLIANT' ? 'NC' :
                  f.status === 'OBSERVATION' ? 'OSS' :
                  f.status === 'IMPROVEMENT' ? 'OM' :
                  f.status === 'NOT_VERIFIED' ? 'NV' : f.status;
      const std = f.standardCode ? ` [${f.standardCode.replace(/_/g, ' ')}]` : '';
      const notes = f.notes ? ` — ${f.notes.substring(0, 200)}` : '';
      return `- [${tag}] §${f.clauseRef || '?'}${std}${notes}`;
    })
    .join('\n');

  let byStdBlock = '';
  if (byStandardConclusions && Object.keys(byStandardConclusions).length > 0) {
    byStdBlock = '\n\nConclusioni già scritte per norma:';
    for (const [key, text] of Object.entries(byStandardConclusions)) {
      if (text && text.trim()) {
        byStdBlock += `\n--- ${key.replace(/_/g, ' ')} ---\n${text.trim()}\n`;
      }
    }
  }

  const m = auditMetrics || {};
  const userPrompt = `${auditObject ? 'Oggetto audit: ' + auditObject + '\n' : ''}${auditDescription ? 'Obiettivo: ' + auditDescription + '\n' : ''}Norme verificate: ${labels}

Risultati quantitativi:
- Domande totali: ${m.total || 0}
- Conformi (C): ${m.conformities || 0}
- Non Conformità (NC): ${m.nc || 0}
- Osservazioni (OSS): ${m.oss || 0}
- Opportunità di miglioramento (OM): ${m.om || 0}
- Non verificati (NV): ${m.nv || 0}
${findingsSummary ? '\nRilievi dettagliati:\n' + findingsSummary : '\nNessun rilievo specifico registrato.'}
${hasExisting ? '\nConclusioni già scritte dall\'auditor (da migliorare):\n---\n' + existingConclusions.trim() + '\n---' : ''}${byStdBlock}

${effectiveMode === 'refine' ? 'Migliora le conclusioni dell\'auditor mantenendo il suo stile.' : 'Genera una proposta di conclusioni completa.'}`;

  return {
    systemPrompt,
    userPrompt,
    contextSummary: `Audit conclusions ${effectiveMode} for ${labels}, NC:${m.nc || 0}, OSS:${m.oss || 0}`,
  };
}

/**
 * Build context to extract norm metadata from raw PDF text.
 * The AI returns a JSON object with structured metadata fields.
 * @param {object} params
 * @param {string} params.text - Raw text extracted from a PDF (first ~4000 chars)
 * @returns {{systemPrompt: string, userPrompt: string, contextSummary: string}}
 */
function buildExtractNormMetadataContext({ text }) {
  const snippet = (text || '').substring(0, 4000);

  const systemPrompt = `Sei un esperto di normazione tecnica (ISO, UNI, CEN, IEC).
Analizza il testo estratto da un documento PDF e identifica i metadati della norma.

Rispondi SOLO con JSON valido nel formato:
{
  "norm_title": "titolo completo della norma (senza codice)",
  "standard_code": "codice catalogo (es. ISO/TR 15608:2013, UNI EN ISO 9001:2015, ISO 9606-1:2017)",
  "issuing_body": "ente emittente principale (ISO, UNI, CEN, IEC, ecc.)",
  "edition_year": 2018,
  "language": "it|en|de|fr",
  "scope_summary": "descrizione dell'ambito di applicazione della norma in 2-4 frasi, nella lingua originale del documento"
}

Regole:
- standard_code: formato catalogo ufficiale con spazi, slash per TR/TS e anno dopo i due punti (es. ISO/TR 15608:2013). Non usare underscore.
- Se il documento è una traduzione UNI di una norma ISO, includi il prefisso UNI_EN_ (es. UNI_EN_ISO_9001_2015)
- edition_year: anno di pubblicazione dell'edizione (intero, es. 2018)
- scope_summary: estrai preferibilmente dal campo "Scopo" / "Scope" / "Campo di applicazione" del documento; se non disponibile, sintetizza in 2-4 frasi di cosa tratta la norma
- Se un campo non è determinabile dal testo, usa null
- Non inventare dati: basa tutto esclusivamente sul testo fornito`;

  const userPrompt = `Analizza questo testo estratto da un PDF normativo e restituisci i metadati in JSON:

---
${snippet}
---`;

  return {
    systemPrompt,
    userPrompt,
    contextSummary: `Extract norm metadata from ${snippet.length} chars of PDF text`,
  };
}

module.exports = { buildReviewRequirementsContext, buildAuditConclusionsContext, buildExtractNormMetadataContext };
