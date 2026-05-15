const logger = require('../utils/logger');

/**
 * Build context for contract review requirements analysis.
 * @param {object} params
 * @param {string} params.capitolatoText - Extracted text from the uploaded RFQ/spec document
 * @param {number} params.companyId - Company being reviewed
 * @param {number} params.organizationId - Tenant scope
 * @param {string[]} [params.standardCodes] - Specific standards to check against
 * @returns {Promise<{systemPrompt: string, userPrompt: string, contextSummary: string}>}
 */
async function buildReviewRequirementsContext({
  capitolatoText,
  companyId,
  organizationId,
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

  // 2. Load company profile (basic info from companies table)
  let companyContext = '';
  try {
    const { query } = require('../config/database');
    const result = await query(
      'SELECT name, vat_number, sector, address FROM companies WHERE id = @id AND organization_id = @orgId',
      { id: companyId, orgId: organizationId }
    );
    if (result.recordset.length > 0) {
      const c = result.recordset[0];
      companyContext = `\nAzienda: ${c.name} (P.IVA: ${c.vat_number || 'N/D'}, Settore: ${c.sector || 'N/D'}, Sede: ${c.address || 'N/D'})`;
    }
  } catch (err) {
    logger.warn('[AI_CONTEXT] Company lookup failed:', err.message);
  }

  // 3. Build prompts
  const systemPrompt = `Sei un esperto di sistemi di gestione qualità ISO e riesame requisiti contrattuali (ISO 9001:2015 §8.2).
Il tuo compito è analizzare un capitolato/richiesta d'offerta e:
1. Identificare tutti i requisiti tecnici espliciti
2. Identificare le norme e standard citati o applicabili
3. Per ogni requisito, valutare se l'azienda ha le capacità/documentazione necessaria
4. Segnalare i GAP (requisiti non soddisfatti o da verificare)
5. Suggerire azioni per colmare i gap

Rispondi SEMPRE in italiano. Rispondi SOLO con JSON valido nel formato specificato.
${normContext ? '\nHai accesso ai seguenti requisiti normativi come riferimento:' + normContext : ''}
${companyContext ? '\nProfilo azienda:' + companyContext : ''}`;

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

  return {
    systemPrompt,
    userPrompt,
    contextSummary: `Review requirements for company ${companyId}, standards: ${(standardCodes || ['auto']).join(',')}`,
  };
}

/**
 * Build context for audit conclusions suggestion.
 * Accepts the full audit context: metrics, NC/OSS details, existing conclusions,
 * and per-standard breakdown. Supports two modes:
 *   - existingConclusions present → AI refines/improves what the auditor wrote
 *   - existingConclusions empty   → AI generates a proposal from scratch
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
 * @returns {{systemPrompt: string, userPrompt: string, contextSummary: string}}
 */
function buildAuditConclusionsContext({
  auditMetrics,
  standardCodes,
  findings,
  existingConclusions,
  byStandardConclusions,
  auditObject,
  auditDescription,
  mode,
}) {
  const codes = standardCodes || ['ISO_9001_2015'];
  const labels = codes.map(c => c.replace(/_/g, ' ')).join(', ');
  const hasExisting = !!(existingConclusions && existingConclusions.trim());
  const effectiveMode = mode || (hasExisting ? 'refine' : 'generate');

  const systemPrompt = `Sei un lead auditor ISO esperto con 15+ anni di esperienza su ${labels}.
Scrivi conclusioni di audit formali, professionali, in italiano, coerenti con lo stile di un verbale di audit ISO 19011.

Regole:
- Le conclusioni devono essere specifiche, mai generiche. Cita i numeri reali (quante NC, quante OSS, quali clausole).
- Se ci sono NC, indica chiaramente che il sistema non è pienamente conforme e quali aree richiedono azioni correttive.
- Se ci sono solo OSS, il giudizio è positivo ma con raccomandazioni di miglioramento.
- Se tutto è conforme, esprimi un giudizio positivo ma professionale (mai enfatico).
- Usa un linguaggio da verbale ufficiale, non da chat.
${effectiveMode === 'refine' ? '\nL\'auditor ha già scritto una bozza di conclusioni. Migliorala: mantieni il suo stile e le informazioni corrette, arricchisci con dettagli dalle evidenze, correggi eventuali imprecisioni, rendi il testo più completo e professionale.' : ''}

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

module.exports = { buildReviewRequirementsContext, buildAuditConclusionsContext };
