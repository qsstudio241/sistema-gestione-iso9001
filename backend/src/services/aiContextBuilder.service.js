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
 * @param {object} params
 * @param {object} params.auditMetrics - { total, nc, oss, om, conformities }
 * @param {string} params.standardCode
 * @param {Array} params.ncList - List of non-conformities found
 * @returns {{systemPrompt: string, userPrompt: string, contextSummary: string}}
 */
function buildAuditConclusionsContext({ auditMetrics, standardCode, ncList }) {
  const systemPrompt = `Sei un auditor ISO esperto. Scrivi una conclusione professionale per un audit ${standardCode.replace('_', ' ')}.
La conclusione deve essere formale, in italiano, coerente con lo stile di un verbale di audit ISO.
Rispondi con un JSON: { "conclusion_text": "...", "recommendation": "conforme|conforme_con_osservazioni|non_conforme" }`;

  const ncSummary = (ncList || [])
    .map(nc => `- §${nc.clauseRef}: ${nc.description || 'NC senza descrizione'}`)
    .join('\n');

  const userPrompt = `Risultati audit:
- Totale domande: ${auditMetrics.total}
- Conformi: ${auditMetrics.conformities}
- Non Conformità: ${auditMetrics.nc}
- Osservazioni: ${auditMetrics.oss}
- Opportunità di miglioramento: ${auditMetrics.om}
${ncSummary ? '\nNon Conformità rilevate:\n' + ncSummary : '\nNessuna Non Conformità rilevata.'}

Genera la conclusione.`;

  return {
    systemPrompt,
    userPrompt,
    contextSummary: `Audit conclusions for ${standardCode}, NC:${auditMetrics.nc}`,
  };
}

module.exports = { buildReviewRequirementsContext, buildAuditConclusionsContext };
