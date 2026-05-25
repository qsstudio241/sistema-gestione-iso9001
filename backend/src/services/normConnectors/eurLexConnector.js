'use strict';

/**
 * Connettore EUR-Lex (HTML search) — direttive/regolamenti UE.
 */

const logger = require('../../utils/logger');
const { fetchPage } = require('./publicLawHttp');

const SEARCH_BASE = 'https://eur-lex.europa.eu/search.html';

/**
 * @param {string} standardCode
 * @returns {boolean}
 */
function isEuLegislation(standardCode, issuingBody) {
  const body = (issuingBody || '').toUpperCase();
  if (body.includes('EUR') || body.includes('UE') || body.includes('EU ')) return true;

  const code = (standardCode || '').trim();
  if (!code) return false;

  return /(?:reg\.?\s*(?:ue|ce|eu)|regolamento\s*(?:ue|ce)?|direttiva|directive|\d{4}\/\d+\/ue|\d{4}\/\d+\/ce|celex)/i.test(code);
}

function buildSearchUrl(standardCode) {
  const q = encodeURIComponent(standardCode.trim());
  return `${SEARCH_BASE}?type=quick&lang=it&q=${q}`;
}

/**
 * @param {string} html
 */
function parseEurLexHtml(html) {
  const chunk = (html || '').slice(0, 120000);
  const lo = chunk.toLowerCase();

  if (/\brepelled\b|\babrogat[oa]\b|\bno longer in force\b/.test(lo)) {
    return { status: 'withdrawn', supersededBy: null };
  }

  if (/\bsuperseded\b|\bsostituit[oa]\b|\breplaced by\b|\bconsolidated version\b.*\bnot\b/.test(lo)) {
    const supMatch = chunk.match(/(?:replaced by|sostituit[oa] da)[:\s]+([^<.\n]{5,80})/i);
    return {
      status: 'superseded',
      supersededBy: supMatch ? supMatch[1].trim() : null,
    };
  }

  if (/\bin force\b|\bvigent[ea]\b|\bcurrently in force\b|\bentry into force\b/.test(lo)) {
    return { status: 'active', supersededBy: null };
  }

  if (lo.includes('eur-lex') && lo.includes('result')) {
    return { status: 'active', supersededBy: null };
  }

  return null;
}

/**
 * @param {string} standardCode
 */
async function lookupNormStatus(standardCode) {
  const checkedAt = new Date().toISOString();
  const catalogUrl = buildSearchUrl(standardCode);

  try {
    const { statusCode, body } = await fetchPage(catalogUrl);

    if (statusCode < 200 || statusCode >= 400) {
      return {
        status: 'unknown',
        supersededBy: null,
        catalogUrl,
        checkedAt,
        error: `http_${statusCode}`,
      };
    }

    const parsed = parseEurLexHtml(body);
    if (!parsed) {
      return {
        status: 'unknown',
        supersededBy: null,
        catalogUrl,
        checkedAt,
        error: 'parse_failed',
      };
    }

    logger.info('[eurLexConnector] lookup OK', { standardCode, status: parsed.status });
    return {
      status: parsed.status,
      supersededBy: parsed.supersededBy,
      catalogUrl,
      checkedAt,
    };
  } catch (err) {
    logger.warn('[eurLexConnector] lookup failed', { standardCode, error: err.message });
    return {
      status: 'unknown',
      supersededBy: null,
      catalogUrl,
      checkedAt,
      error: 'lookup_failed',
    };
  }
}

module.exports = {
  isEuLegislation,
  buildSearchUrl,
  parseEurLexHtml,
  lookupNormStatus,
};
