/**
 * normattivaApi.service.js
 * Wrapper API pubblica Normattiva.it per ricerca e download decreti/leggi.
 * 
 * Rate limiting: ~100 req/giorno su Normattiva (cache locale risultati)
 * Endpoint pubblici: https://www.normattiva.it/do/atto/export
 */

const logger = require('../utils/logger');
const COMMON_DECREE_DATES = require('../data/commonDecreeDates');

const NORMATTIVA_BASE = 'https://www.normattiva.it';
const FETCH_TIMEOUT_MS = 15000;
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
  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    logger.debug(`[NormattivaAPI] Cache hit per query: ${query}`);
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
    
    if (results.length === 0) {
      logger.warn(`[NormattivaAPI] Nessun risultato per: ${query}`);
      return [];
    }

    // Verifica esistenza URN
    const verified = [];
    for (const result of results) {
      const exists = await checkUrnExists(result.urn);
      if (exists) {
        verified.push(result);
      }
    }

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
    } finally {
      clearTimeout(timeout);
    }

    return response.ok;
  } catch (err) {
    logger.debug(`[NormattivaAPI] URN ${urn} non verificato:`, err.message);
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
 * Scarica il testo consolidato (XML) di un decreto.
 * @param {string} urn
 * @returns {Promise<string>} Testo XML
 */
async function downloadNormXml(urn) {
  try {
    logger.info(`[NormattivaAPI] Download XML per URN: ${urn}`);
    
    // URL per testo consolidato
    const url = `${NORMATTIVA_BASE}/uri-res/N2Ls?${encodeURIComponent(urn)}!vig=`;
    
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
};
