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
  const raw = (standardCode || '').trim();
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

module.exports = {
  parseItalianActReference,
  isItalianPublicLaw,
  buildVigenteUrl,
  parseNormattivaHtml,
  lookupNormStatus,
};
