'use strict';

/**
 * Connettore Normattiva.it — verifica vigore atti italiani (leggi, D.Lgs., D.P.R., ecc.)
 * Usa URN NIR con data anno (es. decreto.legislativo:2008;81!vig=).
 */

const logger = require('../../utils/logger');
const { fetchPage } = require('./publicLawHttp');

const BASE = 'https://www.normattiva.it/uri-res/N2Ls';

const ACT_PATTERNS = [
  { re: /(?:d\.?\s*lgs\.?|dlgs|decreto\s+legislativo)\s*\.?\s*(\d+)\s*[/\s-]+\s*(\d{4})/i, urnType: 'decreto.legislativo' },
  { re: /(?:d\.?\s*l\.?|dl|decreto[\s-]*legge)\s*\.?\s*(\d+)\s*[/\s-]+\s*(\d{4})/i, urnType: 'decreto.legge' },
  { re: /(?:d\.?\s*p\.?\s*r\.?|dpr|decreto\s+del\s+presidente)\s*\.?\s*(\d+)\s*[/\s-]+\s*(\d{4})/i, urnType: 'decreto.del.presidente.della.repubblica' },
  { re: /(?:legge|l\.)\s*\.?\s*(\d+)\s*[/\s-]+\s*(\d{4})/i, urnType: 'legge' },
  { re: /(?:regolamento|reg\.)\s*\.?\s*(\d+)\s*[/\s-]+\s*(\d{4})/i, urnType: 'regolamento' },
];

/**
 * @param {string} standardCode
 * @returns {{ urnType: string, number: string, year: string } | null}
 */
function parseItalianActReference(standardCode) {
  // Normalizza il formato usato come standard_code nel DB (es. "DLgs_81_2008")
  // sostituendo gli underscore con spazi, mantenendo il supporto ai formati
  // testuali (es. "D.Lgs. 81/2008").
  const raw = (standardCode || '').trim().replace(/_/g, ' ');
  if (!raw) return null;

  for (const { re, urnType } of ACT_PATTERNS) {
    const m = raw.match(re);
    if (m) {
      return { urnType, number: m[1], year: m[2] };
    }
  }

  // Formato compatto: 81/2008 con hint D.Lgs nel testo
  const compact = raw.match(/(\d+)\s*\/\s*(\d{4})/);
  if (compact) {
    const lo = raw.toLowerCase();
    let urnType = 'legge';
    if (/d\.?\s*lgs|dlgs|legislativo/.test(lo)) urnType = 'decreto.legislativo';
    else if (/d\.?\s*l\.|decreto[\s-]*legge/.test(lo)) urnType = 'decreto.legge';
    else if (/d\.?\s*p\.?\s*r|dpr/.test(lo)) urnType = 'decreto.del.presidente.della.repubblica';
    else if (/regolamento/.test(lo)) urnType = 'regolamento';
    return { urnType, number: compact[1], year: compact[2] };
  }

  return null;
}

/**
 * True se il codice/descrizione sembra un atto di diritto italiano.
 */
function isItalianPublicLaw(standardCode, issuingBody) {
  const body = (issuingBody || '').toUpperCase();
  if (body.includes('NORMATTIVA') || body.includes('STATO') || body.includes('ITALIA')) return true;

  const code = (standardCode || '').trim();
  if (!code) return false;
  if (parseItalianActReference(code)) return true;

  const lo = code.toLowerCase();
  return /d\.?\s*lgs|dlgs|decreto\s+legislativo|d\.?\s*l\.|decreto[\s-]*legge|d\.?\s*p\.?\s*r|legge\s+\d|regolamento/.test(lo);
}

function buildVigenteUrl(parsed) {
  const urn = `urn:nir:stato:${parsed.urnType}:${parsed.year};${parsed.number}`;
  return `${BASE}?${encodeURIComponent(urn)}!vig=`;
}

/**
 * @param {string} html
 * @returns {{ status: 'active'|'withdrawn'|'superseded', supersededBy: string|null } | null}
 */
function parseNormattivaHtml(html) {
  const chunk = (html || '').slice(0, 150000);
  const lo = chunk.toLowerCase();

  if (/\babrogat[oaie]?\b/.test(lo) && !/\bnon\s+abrogat/.test(lo)) {
    return { status: 'withdrawn', supersededBy: null };
  }

  if (/\bnon\s+pi[uù]\s+vigent[ea]\b/.test(lo) || /\bnon\s+vigent[ea]\b/.test(lo)) {
    return { status: 'withdrawn', supersededBy: null };
  }

  const supMatch = chunk.match(/sostituit[oa]\s+dal?\s+([^<.\n]{5,120})/i);
  if (supMatch || /\bsostituit[oa]\s+dal?\b/.test(lo)) {
    return {
      status: 'superseded',
      supersededBy: supMatch ? supMatch[1].replace(/\s+/g, ' ').trim() : null,
    };
  }

  if (/\brevocat[oa]\b/.test(lo)) {
    return { status: 'withdrawn', supersededBy: null };
  }

  if (lo.includes('normattiva') && (lo.includes('decreto') || lo.includes('legge') || lo.includes('regolamento'))) {
    return { status: 'active', supersededBy: null };
  }

  return null;
}

/**
 * @param {string} standardCode
 * @returns {Promise<{ status: string, supersededBy: string|null, catalogUrl: string, checkedAt: string, error?: string }>}
 */
async function lookupNormStatus(standardCode) {
  const checkedAt = new Date().toISOString();
  const parsed = parseItalianActReference(standardCode);

  if (!parsed) {
    return {
      status: 'unknown',
      supersededBy: null,
      catalogUrl: 'https://www.normattiva.it/',
      checkedAt,
      error: 'unparsed_italian_act',
    };
  }

  const catalogUrl = buildVigenteUrl(parsed);

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

    const parsedStatus = parseNormattivaHtml(body);
    if (!parsedStatus) {
      return {
        status: 'unknown',
        supersededBy: null,
        catalogUrl,
        checkedAt,
        error: 'parse_failed',
      };
    }

    logger.info('[normattivaConnector] lookup OK', {
      standardCode,
      status: parsedStatus.status,
      catalogUrl,
    });

    return {
      status: parsedStatus.status,
      supersededBy: parsedStatus.supersededBy,
      catalogUrl,
      checkedAt,
    };
  } catch (err) {
    logger.warn('[normattivaConnector] lookup failed', { standardCode, error: err.message });
    return {
      status: 'unknown',
      supersededBy: null,
      catalogUrl,
      checkedAt,
      error: 'lookup_failed',
    };
  }
}

/**
 * Permalink URN Normattiva del singolo articolo (fonte verificabile).
 * @param {{ urnType: string, number: string, year: string }} parsed
 * @param {string|number} articleNumber
 * @returns {string}
 */
function buildArticleUrl(parsed, articleNumber) {
  const num = String(articleNumber).replace(/\D/g, '');
  const urn = `urn:nir:stato:${parsed.urnType}:${parsed.year};${parsed.number}~art${num}!vig=`;
  return `${BASE}?${encodeURIComponent(urn)}`;
}

/**
 * Estrae il testo di un articolo dal frammento HTML Normattiva (contenitore
 * ".bodyTesto"). Ritorna null se il testo non e' presente (es. shell JS della
 * home): NON inventa mai il contenuto.
 * @param {string} html
 * @returns {string|null}
 */
function parseArticleText(html) {
  if (!html || typeof html !== 'string') return null;

  const m = html.match(/class=["'][^"']*bodyTesto[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!m) return null;

  const decoded = m[1]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Guard anti-cruft: un articolo reale ha una lunghezza minima e cita "art".
  if (decoded.length < 20 || !/art/i.test(decoded)) return null;
  return decoded;
}

/**
 * Recupera il testo di un articolo di legge italiana da Normattiva.
 * Fallback del broker (step publicLaw): usato solo se la clausola non e' in
 * cache locale (norm_requirements). Graceful degradation: ritorna null se
 * l'estrazione non e' affidabile (es. pagina servita via JS senza testo).
 *
 * @param {string} standardCode - es. 'DLgs_81_2008'
 * @param {string} clauseRef - es. 'art.28'
 * @returns {Promise<{ text: string, title: string, fullRef: string, source: string, sourceUrl: string } | null>}
 */
async function getClauseText(standardCode, clauseRef) {
  const parsed = parseItalianActReference(standardCode);
  if (!parsed) return null;

  const artMatch = String(clauseRef || '').match(/\d+/);
  if (!artMatch) return null;
  const artNum = artMatch[0];

  const url = buildArticleUrl(parsed, artNum);

  try {
    const { statusCode, body } = await fetchPage(url);
    if (statusCode < 200 || statusCode >= 400) {
      logger.warn('[normativaConnector] getClauseText http error', { standardCode, clauseRef, statusCode });
      return null;
    }

    const text = parseArticleText(body);
    if (!text) {
      logger.info('[normativaConnector] getClauseText: testo non estraibile (pagina JS?)', {
        standardCode,
        clauseRef,
        url,
      });
      return null;
    }

    return {
      text,
      title: '',
      fullRef: `${standardCode} ${clauseRef}`,
      source: 'normattiva',
      sourceUrl: url,
    };
  } catch (err) {
    logger.warn('[normativaConnector] getClauseText failed', {
      standardCode,
      clauseRef,
      error: err.message,
    });
    return null;
  }
}

/**
 * Elenco articoli di una legge. L'estrazione integrale live da Normattiva
 * richiede rendering JS (non disponibile server-side): ritorna [] e demanda
 * l'ingestione allo script dedicato (seed da Normattiva). Documentato in
 * docs/GUIDA_CONSOLIDATA.md.
 * @param {string} standardCode
 * @returns {Promise<Array>}
 */
async function getFullNorm(standardCode) {
  const parsed = parseItalianActReference(standardCode);
  if (!parsed) return [];
  logger.info('[normativaConnector] getFullNorm non disponibile live (richiede seed)', { standardCode });
  return [];
}

module.exports = {
  parseItalianActReference,
  isItalianPublicLaw,
  buildVigenteUrl,
  buildArticleUrl,
  parseNormattivaHtml,
  parseArticleText,
  lookupNormStatus,
  getClauseText,
  getFullNorm,
};
