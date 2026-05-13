const logger = require('../utils/logger');

let localConnector = null;

function getLocalConnector() {
  if (!localConnector) localConnector = require('./normConnectors/localStoreConnector');
  return localConnector;
}

/**
 * Search for a clause in a specific standard.
 * @param {string} standardCode - e.g. 'ISO_9001_2015'
 * @param {string} clauseRef - e.g. '8.4.2'
 * @returns {Promise<{text, title, fullRef, source} | null>}
 */
async function getClauseText(standardCode, clauseRef) {
  const local = await getLocalConnector().getClauseText(standardCode, clauseRef);
  if (local) return { ...local, source: 'local_db' };

  logger.info(`[NormBroker] Clause ${standardCode} ref=${clauseRef} not found in any source`);
  return null;
}

/**
 * Get all clauses for a standard.
 * @param {string} standardCode
 * @returns {Promise<Array<{clause_ref, clause_title, requirement_text}>>}
 */
async function getFullNorm(standardCode) {
  return getLocalConnector().getFullNorm(standardCode);
}

/**
 * Search clauses by keyword across all standards or a specific one.
 * @param {string} keyword
 * @param {string} [standardCode] - optional filter
 * @returns {Promise<Array<{standard_code, clause_ref, clause_title, requirement_text}>>}
 */
async function searchClauses(keyword, standardCode) {
  return getLocalConnector().searchClauses(keyword, standardCode);
}

/**
 * List all available standards in the local store.
 * @returns {Promise<Array<{standard_code, clause_count}>>}
 */
async function listAvailableStandards() {
  return getLocalConnector().listAvailableStandards();
}

module.exports = { getClauseText, getFullNorm, searchClauses, listAvailableStandards };
