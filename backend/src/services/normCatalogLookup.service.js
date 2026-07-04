/**
 * normCatalogLookup.service.js
 * Interroga i cataloghi pubblici degli enti normativi (BSI, ISO, UNI) per determinare
 * lo stato di validità di una norma tecnica (vigente / ritirata / sostituita).
 *
 * Caratteristiche:
 * - Catalogo UNI Store primario per norme tecniche (ADR-017); fallback ISO.org / BSI
 * - Timeout 5 s per non bloccare il flusso principale
 * - Cache in-memory 24 h per norma (key = code + ente)
 * - Fallback graceful: restituisce { status: 'unknown' } in caso di errore
 */

'use strict';

const https = require('https');
const http  = require('http');
const logger = require('../utils/logger');
const { buildCatalogSearchVariants, normalizeStandardCodeForStorage } = require('./standardCodeNormalizer.service');
const uniStoreConnector = require('./uniStoreConnector.service');
const normattivaConnector = require('./normConnectors/normativaConnector');
const eurLexConnector = require('./normConnectors/eurLexConnector');

// ??? Cache in-memory ??????????????????????????????????????????????????????????
const _cache = new Map();
const CACHE_TTL_MS   = 24 * 60 * 60 * 1000; // 24 ore
const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS    = 3;

const BROWSER_HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
    'Accept-Encoding': 'identity',   // evita risposta gzip che richiederebbe decompress
    'Cache-Control':   'no-cache',
};

// ??? HTTP fetch con redirect e timeout ???????????????????????????????????????

/**
 * Esegue HTTP GET con timeout e segue redirect.
 * Restituisce { statusCode, body, finalUrl }.
 */
function fetchPage(url, redirectsLeft = MAX_REDIRECTS) {
    return new Promise((resolve, reject) => {
        let timedOut = false;
        const lib = url.startsWith('https') ? https : http;

        const req = lib.get(url, { headers: BROWSER_HEADERS }, (res) => {
            // Gestione redirect 3xx
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                if (redirectsLeft <= 0) {
                    reject(new Error('Too many redirects'));
                    return;
                }
                // Risolvi URL relativo
                let nextUrl = res.headers.location;
                if (!nextUrl.startsWith('http')) {
                    const base = new URL(url);
                    nextUrl = `${base.origin}${nextUrl.startsWith('/') ? '' : '/'}${nextUrl}`;
                }
                resolve(fetchPage(nextUrl, redirectsLeft - 1));
                return;
            }

            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                if (timedOut) return;
                resolve({
                    statusCode: res.statusCode,
                    body:       Buffer.concat(chunks).toString('utf8'),
                    finalUrl:   url,
                });
            });
            res.on('error', (e) => { if (!timedOut) reject(e); });
        });

        const timer = setTimeout(() => {
            timedOut = true;
            req.destroy();
            reject(new Error('fetch timeout'));
        }, FETCH_TIMEOUT_MS);

        req.on('error', (e) => { clearTimeout(timer); if (!timedOut) reject(e); });
        req.on('close', ()  => clearTimeout(timer));
    });
}

// ??? Parser BSI Group ?????????????????????????????????????????????????????????
/**
 * BSI shop.bsigroup.com:
 * - Pagina di ricerca contiene snippet di prodotto con class "product-list-results"
 * - Stato appare come "Current", "Withdrawn", "Superseded"
 * - I dati sono in attributi data- o in testo plain vicino al risultato
 *
 * Pattern cercati (case-insensitive):
 *   "Withdrawn"  ?  ritirata
 *   "Superseded by XXXX"  ?  sostituita da XXXX
 *   "Current"/"Active"  ?  vigente
 */
function parseBsi(html, standardCode) {
    // Limita la ricerca ai primi 120 KB per velocità
    const chunk = html.slice(0, 120000);
    const lo    = chunk.toLowerCase();

    // Testo "withdrawn" nel HTML (esclude "not withdrawn" come falso positivo)
    if (/\bwithdrawn\b/.test(lo) && !/\bnot withdrawn\b/.test(lo)) {
        // Cerca eventuale sostituto nella stessa area
        const supMatch = chunk.match(/superseded\s+by[:\s]+([A-Z]{2}[\w\s\-\/\.\:]+?)(?:<|,|\s{2,}|\n)/i);
        if (supMatch) {
            return { status: 'superseded', supersededBy: supMatch[1].trim() };
        }
        return { status: 'withdrawn', supersededBy: null };
    }

    if (/\bsuperseded\b/.test(lo)) {
        const supMatch = chunk.match(/superseded\s+by[:\s]+([A-Z]{2}[\w\s\-\/\.\:]+?)(?:<|,|\s{2,}|\n)/i);
        return { status: 'superseded', supersededBy: supMatch ? supMatch[1].trim() : null };
    }

    // "current" o "active" oppure presenza del codice nei risultati ? vigente
    if (/\bcurrent\b/.test(lo) || /\bactive\b/.test(lo)) {
        return { status: 'active', supersededBy: null };
    }

    // Presence of product card for the code ? probably active
    const codeBase = standardCode.split(':')[0].replace(/\s+/g, ' ').trim();
    if (chunk.toLowerCase().includes(codeBase.toLowerCase())) {
        return { status: 'active', supersededBy: null };
    }

    return null;
}

// ??? Parser ISO.org ????????????????????????????????????????????????????????????
/**
 * ISO.org search:
 * - La pagina di ricerca contiene div con data-lifecycle="published"/"withdrawn"
 * - Oppure JSON-LD con "lifecycle": "Published"
 * - Testo "Withdrawn" in span.stage / attributi data
 *
 * BS EN ISO 9606-1:2017 ? corrisponde a ISO 9606-1:2017 ? status Published
 */
function parseIso(html) {
    const chunk = html.slice(0, 120000);
    const lo    = chunk.toLowerCase();

    // Attributo data-lifecycle (formato search results ISO.org)
    if (/data-lifecycle="withdrawn"/.test(lo)) {
        const supMatch = chunk.match(/(?:replaced|superseded)\s+by[:\s]+([A-Z0-9][^\s<"]+)/i);
        return { status: 'withdrawn', supersededBy: supMatch ? supMatch[1].trim() : null };
    }
    if (/data-lifecycle="published"/.test(lo)) {
        return { status: 'active', supersededBy: null };
    }

    // JSON-LD o testo
    if (lo.includes('"lifecycle":"withdrawn"') || lo.includes('"status":"withdrawn"')) {
        return { status: 'withdrawn', supersededBy: null };
    }
    if (lo.includes('"lifecycle":"published"') || lo.includes('"status":"published"')) {
        return { status: 'active', supersededBy: null };
    }

    // Testo libero nel HTML
    if (/\bwithdrawn\b/.test(lo) && !/not withdrawn/.test(lo)) {
        const supMatch = chunk.match(/(?:replaced|superseded)\s+by[:\s]+([A-Z0-9][^\s<"]{2,30})/i);
        return {
            status:      supMatch ? 'superseded' : 'withdrawn',
            supersededBy: supMatch ? supMatch[1].trim() : null,
        };
    }
    if (lo.includes('published')) {
        return { status: 'active', supersededBy: null };
    }

    return null;
}

// ??? Parser UNI ???????????????????????????????????????????????????????????????
/**
 * store.uni.com — cerca testo italiano/inglese per stato
 */
function parseUni(html) {
    const chunk = html.slice(0, 120000);
    const lo    = chunk.toLowerCase();

    if (lo.includes('ritirata') || lo.includes('annullata') || lo.includes('withdrawn')) {
        const supMatch = chunk.match(/(?:sostituita da|superseded by)[:\s]+([A-Z]{2}[\w\s\-\/\.\:]+?)(?:<|,|\s{2,}|\n)/i);
        return { status: 'withdrawn', supersededBy: supMatch ? supMatch[1].trim() : null };
    }
    if (lo.includes('sostituita da') || lo.includes('superseded by')) {
        const supMatch = chunk.match(/(?:sostituita da|superseded by)[:\s]+([A-Z]{2}[\w\s\-\/\.\:]+?)(?:<|,|\s{2,}|\n)/i);
        return { status: 'superseded', supersededBy: supMatch ? supMatch[1].trim() : null };
    }
    if (lo.includes('vigente') || lo.includes('in vigore') || lo.includes('add to cart') || lo.includes('aggiungi al carrello')) {
        return { status: 'active', supersededBy: null };
    }
    return null;
}

// ??? Logica principale ????????????????????????????????????????????????????????

function isPublicLawLookup(code, body) {
    return eurLexConnector.isEuLegislation(code, body)
        || normattivaConnector.isItalianPublicLaw(code, body);
}

/**
 * Esegue lookup su un singolo termine di ricerca (con cache).
 */
async function lookupSingleVariant(searchCode, issuingBody, target) {
    const cacheKey = `${(searchCode || '').toUpperCase()}__${(issuingBody || '').toUpperCase()}`;
    const cached   = _cache.get(cacheKey);
    if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
        logger.info('[normCatalog] cache hit', { standardCode: searchCode });
        return { ...cached.result, matchedQuery: searchCode };
    }

    const catalogUrl = target.catalogUrl;

    try {
        if (target.publicLaw && target.lookup) {
            const lawResult = await target.lookup();
            const result = {
                status: lawResult.status || 'unknown',
                supersededBy: lawResult.supersededBy ?? null,
                catalogUrl: lawResult.catalogUrl || catalogUrl,
                checkedAt: lawResult.checkedAt || new Date().toISOString(),
                error: lawResult.error,
                matchedQuery: searchCode,
            };
            _cache.set(cacheKey, { result, cachedAt: Date.now() });
            logger.info('[normCatalog] public law lookup OK', { standardCode: searchCode, status: result.status });
            return result;
        }

        const enc = encodeURIComponent(searchCode);
        const searchUrl = target.searchUrlTemplate
            ? target.searchUrlTemplate(enc)
            : target.searchUrl;
        const parser = target.parser;

        logger.info('[normCatalog] fetching', { standardCode: searchCode, url: searchUrl });
        const { statusCode, body } = await fetchPage(searchUrl);

        if (statusCode < 200 || statusCode >= 500) {
            const result = {
                status: 'unknown',
                error: `http_${statusCode}`,
                supersededBy: null,
                catalogUrl,
                checkedAt: new Date().toISOString(),
                matchedQuery: searchCode,
            };
            _cache.set(cacheKey, { result, cachedAt: Date.now() });
            return result;
        }

        const parsed = parser(body, searchCode);
        const result = {
            status:      parsed?.status       ?? 'unknown',
            supersededBy: parsed?.supersededBy ?? null,
            catalogUrl,
            checkedAt:   new Date().toISOString(),
            matchedQuery: searchCode,
        };

        _cache.set(cacheKey, { result, cachedAt: Date.now() });
        logger.info('[normCatalog] lookup OK', { standardCode: searchCode, status: result.status, supersededBy: result.supersededBy });
        return result;

    } catch (err) {
        logger.warn('[normCatalog] lookup failed', { standardCode: searchCode, issuingBody, error: err.message });
        return {
            status:      'unknown',
            error:       'lookup_failed',
            supersededBy: null,
            catalogUrl,
            checkedAt:   new Date().toISOString(),
            matchedQuery: searchCode,
        };
    }
}

/**
 * Determina quale catalogo interrogare in base a issuing_body e prefisso codice.
 * Restituisce { searchUrlTemplate, catalogUrl, parser } oppure { publicLaw: true, lookup }.
 */
function resolveTarget(standardCode, issuingBody) {
    const body = (issuingBody || '').toUpperCase().trim();
    const code = (standardCode || '').trim();

    if (eurLexConnector.isEuLegislation(code, body)) {
        const catalogUrl = eurLexConnector.buildSearchUrl(code);
        return {
            publicLaw: true,
            catalogUrl,
            lookup: () => eurLexConnector.lookupNormStatus(code),
        };
    }

    if (normattivaConnector.isItalianPublicLaw(code, body)) {
        const catalogUrl = normattivaConnector.parseItalianActReference(code)
            ? normattivaConnector.buildVigenteUrl(normattivaConnector.parseItalianActReference(code))
            : 'https://www.normattiva.it/';
        return {
            publicLaw: true,
            catalogUrl,
            lookup: () => normattivaConnector.lookupNormStatus(code),
        };
    }

    // BSI: ente "BSI" oppure codice che inizia con "BS "
    if (body.includes('BSI') || /^BS\s/i.test(code)) {
        const catalogUrl = `https://shop.bsigroup.com/search?q=${encodeURIComponent(code)}`;
        return {
            searchUrlTemplate: (enc) => `https://shop.bsigroup.com/search?q=${enc}&type=standard`,
            catalogUrl,
            parser: (html, sc) => parseBsi(html, sc),
        };
    }

    // UNI: ente "UNI" oppure codice che inizia con "UNI "
    if (body.includes('UNI') || /^UNI\s/i.test(code)) {
        const catalogUrl = `https://store.uni.com/catalogo/ricerca?text=${encodeURIComponent(code)}`;
        return {
            searchUrlTemplate: (enc) => `https://store.uni.com/catalogo/ricerca?text=${enc}`,
            catalogUrl,
            parser: parseUni,
        };
    }

    // Default: ISO.org (copre ISO, EN ISO, DIN EN ISO, ecc.)
    const catalogUrl = `https://www.iso.org/search.html?q=${encodeURIComponent(code)}`;
    return {
        searchUrlTemplate: (enc) => `https://www.iso.org/search.html?q=${enc}&sort=rel`,
        catalogUrl,
        parser: parseIso,
    };
}

// ??? Funzione pubblica ?????????????????????????????????????????????????????????

/**
 * Interroga il catalogo pubblico dell'ente per la norma richiesta.
 * Prova varianti del codice (normalizzazione underscore, ISO/TR, anno, numero).
 *
 * @param {string} standardCode  - Es. "BS EN ISO 9606-1:2017" o "ISO_TR_15608_2013"
 * @param {string} issuingBody   - Es. "BSI", "ISO", "UNI"
 * @param {number|null} [editionYear]
 * @returns {Promise<{
 *   status:      'active'|'withdrawn'|'superseded'|'unknown',
 *   supersededBy: string|null,
 *   catalogUrl:  string,
 *   checkedAt:   string,
 *   matchedQuery?: string,
 *   error?:      string
 * }>}
 */
async function lookupNormStatus(standardCode, issuingBody, editionYear = null) {
    if (!standardCode || !standardCode.trim()) {
        return { status: 'unknown', error: 'missing_code', supersededBy: null, catalogUrl: null, checkedAt: new Date().toISOString() };
    }

    const normalized = normalizeStandardCodeForStorage(standardCode, editionYear);
    const variants = buildCatalogSearchVariants(standardCode, editionYear, issuingBody);

    const aggregateKey = `${normalized.toUpperCase()}__${(issuingBody || '').toUpperCase()}__AGG`;
    const cachedAgg = _cache.get(aggregateKey);
    if (cachedAgg && (Date.now() - cachedAgg.cachedAt) < CACHE_TTL_MS) {
        logger.info('[normCatalog] aggregate cache hit', { standardCode: normalized });
        return cachedAgg.result;
    }

    if (!isPublicLawLookup(normalized, issuingBody)) {
        try {
            const uniResult = await uniStoreConnector.lookupNormOnUniStore(
                standardCode,
                editionYear,
                null
            );
            if (uniResult.status !== 'unknown') {
                const finalResult = {
                    status: uniResult.status,
                    supersededBy: uniResult.supersededBy ?? null,
                    catalogUrl: uniResult.catalogUrl,
                    checkedAt: uniResult.checkedAt,
                    matchedQuery: uniResult.matchedQuery || uniResult.matchedCode,
                };
                _cache.set(aggregateKey, { result: finalResult, cachedAt: Date.now() });
                logger.info('[normCatalog] UNI store primary OK', { standardCode: normalized, status: finalResult.status });
                return finalResult;
            }
        } catch (uniErr) {
            logger.warn('[normCatalog] UNI store lookup failed', { standardCode: normalized, error: uniErr.message });
        }
    }

    const target = resolveTarget(normalized, issuingBody);
    let lastResult = {
        status: 'unknown',
        error: 'no_match',
        supersededBy: null,
        catalogUrl: target.catalogUrl || null,
        checkedAt: new Date().toISOString(),
    };

    for (const variant of variants) {
        const result = await lookupSingleVariant(variant, issuingBody, target);
        lastResult = result;
        if (result.status !== 'unknown') {
            const finalResult = {
                ...result,
                catalogUrl: result.catalogUrl || target.catalogUrl,
            };
            _cache.set(aggregateKey, { result: finalResult, cachedAt: Date.now() });
            return finalResult;
        }
    }

    return lastResult;
}

/**
 * Svuota la cache (utile per test o reset manuale).
 */
function clearCache() {
    _cache.clear();
}

module.exports = { lookupNormStatus, clearCache, buildCatalogSearchVariants, normalizeStandardCodeForStorage };
