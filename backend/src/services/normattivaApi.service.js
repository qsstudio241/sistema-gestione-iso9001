/**
 * normattivaApi.service.js
 * Wrapper API pubblica Normattiva.it per ricerca e download decreti/leggi.
 * 
 * Rate limiting: ~100 req/giorno su Normattiva (cache locale risultati)
 * Endpoint XML: GET /do/atto/caricaAKN (Akoma Ntoso), dopo la pagina pubblica dell'atto.
 * Il POST nudo su /do/atto/export senza il form completo restituisce HTML di errore, non XML.
 */

const logger = require('../utils/logger');
const COMMON_DECREE_DATES = require('../data/commonDecreeDates');

const NORMATTIVA_BASE = 'https://www.normattiva.it';
const FETCH_TIMEOUT_MS = 15000;
const PAGE_TIMEOUT_MS = 25000;
const XML_TIMEOUT_MS = 90000;
const USER_AGENT = 'SGQ-NormIngest/1.0';

// Cache risultati search in memoria (5 min TTL)
const searchCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Cerca un decreto/legge su Normattiva.
 * @param {string} query - es. "D.Lgs. 81/2008" o "D.Lgs. 152/2006"
 * @returns {Promise<Array<{urn: string, title: string, vigenza: string}>>}
 */
async function searchNorm(query) {
  logger.info('[DEBUG] searchNorm() START, query: ' + query);
  
  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    logger.debug(`[NormattivaAPI] Cache hit per query: ${query}`);
    logger.info('[DEBUG] Cache HIT, returning: ' + cached.results.length + ' results');
    return cached.results;
  }

  try {
    logger.info(`[NormattivaAPI] Ricerca: ${query}`);
    
    // Normattiva non ha API REST pubbliche documentate per search.
    // Due approcci:
    // 1. Parsing HTML della pagina di ricerca
    // 2. Usare URL diretti se l'utente conosce URN
    
    // Per ora implementiamo approccio 2: costruzione URN da pattern noto
    // Pattern comune: D.Lgs. 81/2008 → urn:nir:stato:decreto.legislativo:2008-04-09;81
    // D.L. → decreto.legge
    // Legge → legge
    
    const results = parseQueryToUrn(query);
    logger.info('[DEBUG] parseQueryToUrn() returned: ' + JSON.stringify(results));
    
    if (results.length === 0) {
      logger.warn(`[NormattivaAPI] Nessun risultato per: ${query}`);
      logger.info('[DEBUG] No pattern match, returning []');
      return [];
    }

    // Verifica esistenza URN
    const verified = [];
    for (const result of results) {
      logger.info('[DEBUG] Verifico URN: ' + result.urn);
      const exists = await checkUrnExists(result.urn);
      logger.info('[DEBUG] checkUrnExists() returned: ' + exists);
      if (exists) {
        verified.push(result);
      }
    }

    logger.info('[DEBUG] verified.length: ' + verified.length);
    searchCache.set(cacheKey, { results: verified, ts: Date.now() });
    return verified;
  } catch (err) {
    logger.error('[NormattivaAPI] Errore ricerca:', err.message);
    throw new Error(`Errore connessione Normattiva: ${err.message}`);
  }
}

/**
 * Costruisce URN da query testuale (pattern comuni italiani).
 * @param {string} query
 * @returns {Array<{urn: string, title: string, vigenza: string}>}
 */
function parseQueryToUrn(query) {
  const results = [];
  
  // Pattern: D.Lgs. 81/2008 o D.Lgs 81/2008
  const dlgsMatch = query.match(/D\.?\s*Lgs\.?\s*(\d+)\s*\/\s*(\d{4})/i);
  if (dlgsMatch) {
    const [, numero, anno] = dlgsMatch;
    // URN standard: urn:nir:stato:decreto.legislativo:YYYY-MM-DD;numero
    const key = `${numero}/${anno}`;
    const date = COMMON_DECREE_DATES['decreto.legislativo'][key] || `${anno}-01-01`;
    const urn = `urn:nir:stato:decreto.legislativo:${date};${numero}`;
    results.push({
      urn,
      title: `D.Lgs. ${numero}/${anno}`,
      vigenza: 'Vigente', // Placeholder — verificare dopo
    });
  }

  // Pattern: D.L. 119/2018
  const dlMatch = query.match(/D\.?\s*L\.?\s*(\d+)\s*\/\s*(\d{4})/i);
  if (dlMatch) {
    const [, numero, anno] = dlMatch;
    const key = `${numero}/${anno}`;
    const date = COMMON_DECREE_DATES['decreto.legge'][key] || `${anno}-01-01`;
    const urn = `urn:nir:stato:decreto.legge:${date};${numero}`;
    results.push({
      urn,
      title: `D.L. ${numero}/${anno}`,
      vigenza: 'Vigente',
    });
  }

  // Pattern: Legge 300/2000
  const leggeMatch = query.match(/Legge\s+(\d+)\s*\/\s*(\d{4})/i);
  if (leggeMatch) {
    const [, numero, anno] = leggeMatch;
    const key = `${numero}/${anno}`;
    const date = COMMON_DECREE_DATES['legge'][key] || `${anno}-01-01`;
    const urn = `urn:nir:stato:legge:${date};${numero}`;
    results.push({
      urn,
      title: `Legge ${numero}/${anno}`,
      vigenza: 'Vigente',
    });
  }

  return results;
}

/**
 * Verifica se URN esiste su Normattiva (HEAD request).
 * @param {string} urn
 * @returns {Promise<boolean>}
 */
async function checkUrnExists(urn) {
  try {
    // Usa /do/atto/export che è l'endpoint pubblico stabile per verificare URN
    const url = `${NORMATTIVA_BASE}/do/atto/export?urn=${encodeURIComponent(urn)}`;
    logger.info('[DEBUG] checkUrnExists() URL: ' + url);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
      logger.info('[DEBUG] Fetch response status: ' + response.status + ' ok: ' + response.ok);
    } finally {
      clearTimeout(timeout);
    }

    return response.ok;
  } catch (err) {
    logger.debug(`[NormattivaAPI] URN ${urn} non verificato:`, err.message);
    logger.info('[DEBUG] checkUrnExists() ERROR: ' + err.message);
    return false;
  }
}

/**
 * Recupera metadati completi di un decreto da URN.
 * @param {string} urn
 * @returns {Promise<{urn: string, title: string, vigenza: string, dataInizioVigore: string|null, dataFineVigore: string|null}>}
 */
async function getNormDetails(urn) {
  try {
    logger.info(`[NormattivaAPI] Recupero metadati per URN: ${urn}`);
    
    // URL per metadata XML
    const url = `${NORMATTIVA_BASE}/uri-res/N2Ls?${encodeURIComponent(urn)}!metadata`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} per URN ${urn}`);
    }

    const xml = await response.text();
    
    // Parsing XML minimo (in produzione usare libreria XML parser)
    const titleMatch = xml.match(/<dc:title>([^<]+)<\/dc:title>/i);
    const vigenzaMatch = xml.match(/<vigenza>([^<]+)<\/vigenza>/i);
    const inizioMatch = xml.match(/<dataInizioVigore>([^<]+)<\/dataInizioVigore>/i);
    const fineMatch = xml.match(/<dataFineVigore>([^<]+)<\/dataFineVigore>/i);

    return {
      urn,
      title: titleMatch ? titleMatch[1].trim() : urn,
      vigenza: vigenzaMatch ? vigenzaMatch[1].trim() : 'Vigente',
      dataInizioVigore: inizioMatch ? inizioMatch[1].trim() : null,
      dataFineVigore: fineMatch ? fineMatch[1].trim() : null,
    };
  } catch (err) {
    logger.error('[NormattivaAPI] Errore recupero metadati:', err.message);
    throw new Error(`Impossibile recuperare metadati per URN ${urn}: ${err.message}`);
  }
}

/**
 * Permalink pubblico dell'atto (pagina da cui Normattiva espone il link XML).
 * @param {string} urn
 * @returns {string}
 */
function buildActPageUrl(urn) {
  return `${NORMATTIVA_BASE}/uri-res/N2Ls?${urn}`;
}

/**
 * Link ufficiale export Akoma Ntoso (`/do/atto/caricaAKN`) presente nella pagina atto.
 * Il POST nudo su `/do/atto/export` senza il form completo restituisce HTML di errore.
 * @param {string} html
 * @returns {string|null}
 */
function extractOfficialXmlUrl(html) {
  const match = String(html || '').match(/href="([^"]*\/do\/atto\/caricaAKN\?[^"]+)"/i);
  if (!match) return null;
  let href = match[1].replace(/&amp;/g, '&');
  if (href.startsWith('https://') || href.startsWith('http://')) return href;
  if (!href.startsWith('/')) href = `/${href}`;
  return `${NORMATTIVA_BASE}${href}`;
}

/**
 * Vero XML (dichiarazione o radice NIR/Akoma), non la shell HTML del portale.
 * @param {string} text
 * @returns {boolean}
 */
function isOfficialXml(text) {
  const head = String(text || '').replace(/^\uFEFF/, '').trimStart().slice(0, 1200);
  if (/^<!DOCTYPE\s+html/i.test(head) || /^<html[\s>]/i.test(head)) return false;
  if (/captcha|recaptcha/i.test(head)) return false;
  return /^<\?xml/i.test(head)
    || /<akomaNtoso[\s>]/i.test(head)
    || /<(?:nir|articolo|article)\b/i.test(head);
}

function readSetCookies(headers) {
  if (!headers || typeof headers.getSetCookie !== 'function') return [];
  try {
    return headers.getSetCookie() || [];
  } catch {
    return [];
  }
}

function mergeCookies(existing, setCookieHeaders) {
  const jar = new Map();
  for (const part of String(existing || '').split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq > 0) jar.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }
  for (const raw of setCookieHeaders || []) {
    const pair = String(raw).split(';')[0];
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

/**
 * Fetch con cookie di sessione. Normattiva consegna il file XML solo dopo la pagina atto.
 * @param {string} url
 * @param {{ timeoutMs?: number, cookie?: string, headers?: object, method?: string }} [opts]
 */
async function fetchWithSession(url, opts = {}) {
  const timeoutMs = opts.timeoutMs || FETCH_TIMEOUT_MS;
  let current = url;
  let cookie = opts.cookie || '';

  for (let hop = 0; hop < 6; hop += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(current, {
        method: opts.method || 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/xml,text/xml,text/html;q=0.8,*/*;q=0.5',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(opts.headers || {}),
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    cookie = mergeCookies(cookie, readSetCookies(response.headers));
    const status = response.status || 0;
    if (status >= 300 && status < 400) {
      const location = response.headers && typeof response.headers.get === 'function'
        ? response.headers.get('location')
        : null;
      if (!location) break;
      current = new URL(location, current).href;
      continue;
    }

    const text = response.ok && typeof response.text === 'function' ? await response.text() : '';
    return { response, text, cookie };
  }

  throw new Error('Troppi redirect Normattiva');
}

/**
 * Scarica il testo consolidato XML (Akoma Ntoso) di un decreto.
 * Non usa la pagina HTML `!vig=`: quella non contiene gli articoli.
 * @param {string} urn
 * @returns {Promise<string>} Testo XML
 */
async function downloadNormXml(urn) {
  try {
    logger.info(`[NormattivaAPI] Download XML ufficiale per URN: ${urn}`);
    const pageUrl = buildActPageUrl(urn);
    const page = await fetchWithSession(pageUrl, { timeoutMs: PAGE_TIMEOUT_MS });

    if (!page.response.ok) {
      throw new Error(`HTTP ${page.response.status} per URN ${urn}`);
    }

    const xmlUrl = extractOfficialXmlUrl(page.text);
    if (!xmlUrl) {
      throw new Error('Export XML ufficiale non trovato (caricaAKN assente)');
    }

    const xmlRes = await fetchWithSession(xmlUrl, {
      timeoutMs: XML_TIMEOUT_MS,
      cookie: page.cookie,
      headers: { Referer: pageUrl, Accept: 'application/xml,text/xml,*/*' },
    });

    if (!xmlRes.response.ok) {
      throw new Error(`HTTP ${xmlRes.response.status} export XML per URN ${urn}`);
    }

    const xml = xmlRes.text;
    if (!isOfficialXml(xml)) {
      throw new Error('Export ufficiale non ha restituito XML');
    }
    if (!xml || xml.length < 100) {
      throw new Error('Testo XML troppo corto o vuoto');
    }

    logger.info(`[NormattivaAPI] XML scaricato: ${xml.length} caratteri`);
    return xml;
  } catch (err) {
    logger.error('[NormattivaAPI] Errore download XML:', err.message);

    if (err.name === 'AbortError') {
      throw new Error('Timeout connessione Normattiva (15s)');
    }

    throw new Error(`Impossibile scaricare testo per URN ${urn}: ${err.message}`);
  }
}

/**
 * Pulisce cache ricerche (manutenzione).
 */
function clearCache() {
  searchCache.clear();
  logger.info('[NormattivaAPI] Cache pulita');
}

module.exports = {
  searchNorm,
  getNormDetails,
  downloadNormXml,
  clearCache,
  buildActPageUrl,
  extractOfficialXmlUrl,
  isOfficialXml,
};
