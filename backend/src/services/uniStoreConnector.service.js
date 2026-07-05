/**
 * uniStoreConnector.service.js — Catalogo UNI primario (ADR-017)
 * API pubbliche store.uni.com + uni.com search (no captcha ISO.org).
 */

'use strict';

const https = require('https');
const logger = require('../utils/logger');
const {
  normalizeStandardCodeForStorage,
  buildCatalogSearchVariants,
} = require('./standardCodeNormalizer.service');

const FETCH_TIMEOUT_MS = 8000;
const UNI_SEARCH_API = 'https://www.uni.com/wp-json/uni/v1/search/';
const UNI_ES_BASE = 'https://store.uni.com/api/catalog/vue_storefront_magento_2/product/_search';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; SGQ-NormCatalog/1.0)',
  Accept: 'application/json, text/html;q=0.9',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
};

/**
 * @param {string} url
 * @returns {Promise<{ statusCode: number, body: string }>}
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : require('http');
    const req = lib.get(url, { headers: BROWSER_HEADERS }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('error', reject);
    req.setTimeout(FETCH_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('fetch timeout'));
    });
  });
}

/**
 * Slug prodotto UNI: UNI EN ISO 15614-1:2019 → uni-en-iso-15614-1-2019
 * @param {string} code
 */
function codeToUrlKey(code) {
  return String(code || '')
    .trim()
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/:/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * @param {string} statusIt
 * @returns {'active'|'withdrawn'|'unknown'}
 */
function mapUniStatusIt(statusIt) {
  const s = String(statusIt || '').toUpperCase();
  if (!s) return 'unknown';
  if (s.includes('IN VIGORE') || s === 'CURRENT') return 'active';
  if (s.includes('SOSTITUIT') || s.includes('REPLACED BY')) return 'superseded';
  if (s.includes('RITIRATA') || s.includes('ANNULLATA') || s.includes('WITHDRAWN')) return 'withdrawn';
  return 'unknown';
}

/**
 * @param {object} source
 * @returns {{ code: string, titleIt: string|null, status: string, catalogUrl: string, urlKey: string|null }}
 */
function mapEsProduct(source) {
  const code = source.name || source.descri || '';
  const urlKey = source.url_key || null;
  const catalogUrl = urlKey ? `https://store.uni.com/${urlKey}` : null;
  const statusLabel = source.des_ttblva_it || source.des_ttblva_en
    || source.des_tpbloc_it || source.des_tpbloc_en;
  return {
    code: String(code).trim(),
    titleIt: source.titita ? String(source.titita).trim() : null,
    status: mapUniStatusIt(statusLabel),
    catalogUrl,
    urlKey,
    origin: source.origin || null,
  };
}

/**
 * @param {string} urlKey
 */
async function fetchProductByUrlKey(urlKey) {
  const q = encodeURIComponent(`url_key:${urlKey}`);
  const url = `${UNI_ES_BASE}?size=3&q=${q}`;
  const { statusCode, body } = await fetchUrl(url);
  if (statusCode < 200 || statusCode >= 300) {
    return null;
  }
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  const hits = data?.hits?.hits || [];
  for (const hit of hits) {
    const mapped = mapEsProduct(hit._source || {});
    if (mapped.urlKey === urlKey || codeToUrlKey(mapped.code) === urlKey) {
      return mapped;
    }
  }
  if (hits[0]?._source) {
    return mapEsProduct(hits[0]._source);
  }
  return null;
}

/**
 * @param {string} query
 */
async function searchUniComApi(query) {
  const url = `${UNI_SEARCH_API}?q=${encodeURIComponent(query)}&lang=it`;
  const { statusCode, body } = await fetchUrl(url);
  if (statusCode < 200 || statusCode >= 300) return [];

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return [];
  }

  const items = [];
  for (const section of Array.isArray(data) ? data : []) {
    if (section.title !== 'Norme') continue;
    for (const it of section.items || []) {
      items.push({
        code: String(it.title || '').trim(),
        titleIt: String(it.text || '').trim(),
        catalogUrl: it.link || null,
      });
    }
  }
  return items;
}

/**
 * Score candidato vs codice normalizzato e titolo opzionale.
 */
function scoreCandidate(normalizedCode, editionYear, normTitle, candidate) {
  let score = 0;
  const candCode = String(candidate.code || '').trim();
  const norm = normalizedCode.toUpperCase();
  const cc = candCode.toUpperCase();

  if (cc === norm) score += 50;
  else if (cc.replace(/\s/g, '') === norm.replace(/\s/g, '')) score += 45;

  if (editionYear && candCode.includes(String(editionYear))) score += 20;

  const normParts = norm.match(/(\d{3,6}(?:-\d+)?)/);
  const candParts = cc.match(/(\d{3,6}(?:-\d+)?)/);
  if (normParts && candParts && normParts[1] === candParts[1]) score += 15;

  if (normTitle && candidate.titleIt) {
    const a = normTitle.toLowerCase().slice(0, 40);
    const b = candidate.titleIt.toLowerCase().slice(0, 80);
    if (a.length > 10 && b.includes(a.slice(0, 20))) score += 15;
  }

  return score;
}

/**
 * Lookup vigore norma tecnica su UNI Store (primario ADR-017).
 *
 * @param {string} standardCode
 * @param {number|null} [editionYear]
 * @param {string} [normTitle]
 * @returns {Promise<{
 *   status: 'active'|'withdrawn'|'superseded'|'unknown',
 *   supersededBy: string|null,
 *   catalogUrl: string|null,
 *   matchedCode: string|null,
 *   matchedQuery: string|null,
 *   checkedAt: string,
 *   error?: string
 * }>}
 */
async function lookupNormOnUniStore(standardCode, editionYear = null, normTitle = null) {
  const checkedAt = new Date().toISOString();
  const normalized = normalizeStandardCodeForStorage(standardCode, editionYear);
  if (!normalized) {
    return { status: 'unknown', error: 'missing_code', supersededBy: null, catalogUrl: null, matchedCode: null, matchedQuery: null, checkedAt };
  }

  const variants = buildCatalogSearchVariants(standardCode, editionYear, 'UNI');

  for (const variant of variants) {
    const urlKey = codeToUrlKey(variant);
    if (!urlKey) continue;
    try {
      const product = await fetchProductByUrlKey(urlKey);
      if (product && product.status !== 'unknown') {
        return {
          status: product.status,
          supersededBy: null,
          catalogUrl: product.catalogUrl,
          matchedCode: product.code,
          matchedQuery: urlKey,
          checkedAt,
        };
      }
    } catch (err) {
      logger.debug('[uniStore] url_key miss', { urlKey, error: err.message });
    }
  }

  let best = null;
  let bestScore = 0;
  for (const variant of variants.slice(0, 6)) {
    try {
      const items = await searchUniComApi(variant);
      for (const item of items) {
        const sc = scoreCandidate(normalized, editionYear, normTitle, item);
        if (sc > bestScore) {
          bestScore = sc;
          best = { ...item, score: sc };
        }
      }
    } catch (err) {
      logger.debug('[uniStore] search api miss', { variant, error: err.message });
    }
  }

  if (best && bestScore >= 50) {
    const urlKey = best.catalogUrl ? best.catalogUrl.split('/').pop() : codeToUrlKey(best.code);
    let status = 'unknown';
    if (urlKey) {
      try {
        const product = await fetchProductByUrlKey(urlKey);
        if (product?.status && product.status !== 'unknown') {
          status = product.status;
        }
      } catch (_) { /* graceful */ }
    }
    if (status === 'unknown' && /RITIRATA/i.test(best.titleIt || '')) {
      status = 'withdrawn';
    }
    if (status === 'unknown' && bestScore >= 65) {
      status = 'active';
    }
    return {
      status,
      supersededBy: null,
      catalogUrl: best.catalogUrl,
      matchedCode: best.code,
      matchedQuery: variants[0],
      checkedAt,
    };
  }

  return {
    status: 'unknown',
    error: bestScore > 0 ? 'ambiguous_match' : 'no_match',
    supersededBy: null,
    catalogUrl: best?.catalogUrl || `https://store.uni.com/catalogo/ricerca?text=${encodeURIComponent(normalized)}`,
    matchedCode: null,
    matchedQuery: variants[0] || normalized,
    checkedAt,
  };
}

module.exports = {
  codeToUrlKey,
  mapUniStatusIt,
  mapEsProduct,
  lookupNormOnUniStore,
  fetchProductByUrlKey,
  searchUniComApi,
  scoreCandidate,
};
