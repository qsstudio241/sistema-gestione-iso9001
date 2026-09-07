/**
 * Score contesto AI vs rubrica versionata (CTX-0). Zero LLM.
 * Contesto scritto ≠ fatti live SQL (`ambitoFacts`).
 */

const {
  STUDIO_CONTEXT_RUBRIC_V1,
  COMPANY_CONTEXT_RUBRIC_V1,
  getDefaultRubric,
  scoreAgainstRubric,
} = require('../data/aiContextRubrics');

/**
 * @param {Record<string, unknown>|null|undefined} orgProfile
 *   Campi tipici: organization_name, vat_number, ai_context_notes, audit_report_prefix
 */
function scoreStudioContext(orgProfile) {
  return scoreAgainstRubric(STUDIO_CONTEXT_RUBRIC_V1, orgProfile || {});
}

/**
 * @param {Record<string, unknown>|null|undefined} company
 *   Campi tipici da `companies`: name, vat_number, sector, address
 */
function scoreCompanyContext(company) {
  return scoreAgainstRubric(COMPANY_CONTEXT_RUBRIC_V1, company || {});
}

/**
 * @param {'studio'|'company'} scope
 * @param {Record<string, unknown>|null|undefined} values
 */
function scoreContext(scope, values) {
  const rubric = getDefaultRubric(scope);
  if (!rubric) {
    return {
      score: 0,
      level: 'incompleto',
      version: 'unknown',
      scope: scope || 'unknown',
      blocks: [],
      missing: [],
      error: 'scope_non_valido',
    };
  }
  return scoreAgainstRubric(rubric, values || {});
}

module.exports = {
  scoreStudioContext,
  scoreCompanyContext,
  scoreContext,
  STUDIO_CONTEXT_RUBRIC_V1,
  COMPANY_CONTEXT_RUBRIC_V1,
};
