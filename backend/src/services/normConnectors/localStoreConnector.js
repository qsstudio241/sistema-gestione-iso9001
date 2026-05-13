const { query } = require('../../config/database');
const logger = require('../../utils/logger');

function escapeSqlLikeFragment(keyword) {
  return keyword.replace(/\[/g, '[[]').replace(/%/g, '[%]').replace(/_/g, '[_]');
}

function buildLikePattern(keyword) {
  const trimmed = typeof keyword === 'string' ? keyword.trim() : '';
  if (!trimmed) return null;
  return `%${escapeSqlLikeFragment(trimmed)}%`;
}

/**
 * @param {string} standardCode
 * @param {string} clauseRef
 * @returns {Promise<{text: string, title: string, fullRef: string} | null>}
 */
async function getClauseText(standardCode, clauseRef) {
  try {
    const sqlText = `
      SELECT TOP (1)
        requirement_text AS requirement_text,
        clause_title AS clause_title,
        clause_ref AS clause_ref
      FROM norm_requirements
      WHERE standard_code = @standardCode
        AND clause_ref = @clauseRef
        AND is_current = 1
    `;
    const result = await query(sqlText, {
      standardCode,
      clauseRef,
    });
    const row = result.recordset && result.recordset[0];
    if (!row) return null;
    return {
      text: row.requirement_text,
      title: row.clause_title || '',
      fullRef: `${standardCode} ${row.clause_ref}`,
    };
  } catch (err) {
    logger.error('[localStoreConnector] getClauseText failed', { error: err.message });
    throw Object.assign(err, { code: 'NORM_LOCAL_STORE_QUERY_FAILED' });
  }
}

/**
 * @param {string} standardCode
 * @returns {Promise<Array<{clause_ref, clause_title, requirement_text}>>}
 */
async function getFullNorm(standardCode) {
  try {
    const sqlText = `
      SELECT clause_ref, clause_title, requirement_text
      FROM norm_requirements
      WHERE standard_code = @standardCode
        AND is_current = 1
      ORDER BY clause_ref ASC
    `;
    const result = await query(sqlText, { standardCode });
    return result.recordset || [];
  } catch (err) {
    logger.error('[localStoreConnector] getFullNorm failed', { error: err.message });
    throw Object.assign(err, { code: 'NORM_LOCAL_STORE_QUERY_FAILED' });
  }
}

/**
 * @param {string} keyword
 * @param {string} [standardCode]
 */
async function searchClauses(keyword, standardCode) {
  try {
    const pattern = buildLikePattern(keyword);
    if (!pattern) return [];

    const sqlText = `
      SELECT TOP (50)
        standard_code,
        clause_ref,
        clause_title,
        requirement_text
      FROM norm_requirements
      WHERE is_current = 1
        AND requirement_text LIKE @pattern
        AND (@filterStandard IS NULL OR standard_code = @filterStandard)
      ORDER BY standard_code ASC, clause_ref ASC
    `;
    const result = await query(sqlText, {
      pattern,
      filterStandard: standardCode || null,
    });
    return result.recordset || [];
  } catch (err) {
    logger.error('[localStoreConnector] searchClauses failed', { error: err.message });
    throw Object.assign(err, { code: 'NORM_LOCAL_STORE_QUERY_FAILED' });
  }
}

async function listAvailableStandards() {
  try {
    const sqlText = `
      SELECT standard_code, COUNT(*) AS clause_count
      FROM norm_requirements
      WHERE is_current = 1
      GROUP BY standard_code
      ORDER BY standard_code ASC
    `;
    const result = await query(sqlText, {});
    return result.recordset || [];
  } catch (err) {
    logger.error('[localStoreConnector] listAvailableStandards failed', { error: err.message });
    throw Object.assign(err, { code: 'NORM_LOCAL_STORE_QUERY_FAILED' });
  }
}

module.exports = {
  getClauseText,
  getFullNorm,
  searchClauses,
  listAvailableStandards,
};
