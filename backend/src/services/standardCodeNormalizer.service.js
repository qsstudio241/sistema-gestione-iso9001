/**
 * standardCodeNormalizer.service.js
 * Parsing e normalizzazione codici norma (ISO, UNI EN, TR/TS, ecc.)
 * per storage canonico e ricerca su cataloghi pubblici.
 */

'use strict';

const ORG_TOKENS = new Set([
  'UNI', 'EN', 'ISO', 'IEC', 'BS', 'DIN', 'AWS', 'ASME', 'CEN', 'AFNOR', 'ANSI', 'NF', 'JIS',
]);

const DOC_TYPE_TOKENS = new Set(['TR', 'TS', 'PAS', 'GUIDE']);

/**
 * @typedef {object} ParsedStandardCode
 * @property {string[]} prefixes - es. ['UNI','EN','ISO'] o ['ISO']
 * @property {string|null} docType - TR, TS, ...
 * @property {string} number - es. '15608', '9606-1'
 * @property {number|null} year
 * @property {string} canonical - formato catalogo, es. ISO/TR 15608:2013
 */

/**
 * Estrae anno da codice grezzo (fine stringa o dopo ':').
 * @param {string} raw
 * @returns {{ rest: string, year: number|null }}
 */
function extractYear(raw) {
  let s = raw;
  const colon = s.match(/:(\d{4})\b/);
  if (colon) {
    return { rest: s.replace(/:\d{4}\b/, '').trim(), year: parseInt(colon[1], 10) };
  }
  const tail = s.match(/(?:^|[\s_])(\d{4})\s*$/);
  if (tail) {
    return { rest: s.replace(/(?:^|[\s_])\d{4}\s*$/, '').trim(), year: parseInt(tail[1], 10) };
  }
  return { rest: s, year: null };
}

/**
 * @param {string} raw
 * @param {number|null} [editionYear]
 * @returns {ParsedStandardCode|null}
 */
function parseStandardCode(raw, editionYear = null) {
  const input = String(raw || '').trim();
  if (!input) return null;

  let s = input
    .replace(/_/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();

  const { rest, year: parsedYear } = extractYear(s);
  const year = editionYear != null && editionYear !== ''
    ? parseInt(editionYear, 10) || parsedYear
    : parsedYear;

  let work = rest.replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = work.split(' ').filter(Boolean);
  if (tokens.length === 0) return null;

  const prefixes = [];
  let docType = null;
  const numberParts = [];

  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (!numberParts.length && (ORG_TOKENS.has(upper) || DOC_TYPE_TOKENS.has(upper))) {
      if (DOC_TYPE_TOKENS.has(upper)) {
        docType = upper;
      } else {
        prefixes.push(upper);
      }
      continue;
    }
    if (/^\d/.test(token) || numberParts.length > 0) {
      numberParts.push(token);
    }
  }

  if (numberParts.length === 0) return null;

  let number = numberParts.join('-').replace(/--+/g, '-');
  number = number.replace(/^(\d+)-(\d+)$/, '$1-$2');

  const hasIso = prefixes.includes('ISO');
  const hasUni = prefixes.includes('UNI');

  let canonical = '';

  if (hasUni && prefixes.includes('EN') && hasIso) {
    const base = `UNI EN ISO ${number}`;
    canonical = year ? `${base}:${year}` : base;
  } else if (prefixes.includes('BS') && prefixes.includes('EN') && hasIso) {
    const base = `BS EN ISO ${number}`;
    canonical = year ? `${base}:${year}` : base;
  } else if (prefixes.includes('EN') && hasIso && !hasUni) {
    const base = `EN ISO ${number}`;
    canonical = year ? `${base}:${year}` : base;
  } else if (hasIso && docType) {
    const base = `ISO/${docType} ${number}`;
    canonical = year ? `${base}:${year}` : base;
  } else if (hasIso) {
    const base = `ISO ${number}`;
    canonical = year ? `${base}:${year}` : base;
  } else if (prefixes.length > 0) {
    const base = `${prefixes.join(' ')} ${number}`;
    canonical = year ? `${base}:${year}` : base;
  } else {
    canonical = year ? `${number}:${year}` : number;
  }

  return {
    prefixes,
    docType,
    number,
    year: year || null,
    canonical: canonical.replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Normalizza codice per storage in document_registry.
 * @param {string} raw
 * @param {number|null} [editionYear]
 * @returns {string}
 */
function normalizeStandardCodeForStorage(raw, editionYear = null) {
  const parsed = parseStandardCode(raw, editionYear);
  if (parsed) return parsed.canonical;
  return String(raw || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Genera varianti di ricerca dal più specifico al più generico.
 * @param {string} raw
 * @param {number|null} [editionYear]
 * @param {string} [issuingBody]
 * @returns {string[]}
 */
function buildCatalogSearchVariants(raw, editionYear = null, issuingBody = '') {
  const parsed = parseStandardCode(raw, editionYear);
  const variants = [];
  const seen = new Set();

  const add = (v) => {
    const t = String(v || '').trim();
    if (!t || seen.has(t.toUpperCase())) return;
    seen.add(t.toUpperCase());
    variants.push(t);
  };

  if (!parsed) {
    add(String(raw || '').replace(/_/g, ' ').trim());
    return variants;
  }

  const { prefixes, docType, number, year, canonical } = parsed;
  const hasIso = prefixes.includes('ISO');
  const hasUni = prefixes.includes('UNI');

  add(canonical);

  if (year) {
    add(canonical.replace(`:${year}`, ''));
    add(canonical.replace(':', ' '));
  }

  if (hasIso && docType) {
    add(`ISO ${docType} ${number}${year ? `:${year}` : ''}`);
    add(`ISO ${docType} ${number}`);
    add(`ISO/${docType} ${number}`);
  }

  if (hasUni && prefixes.includes('EN') && hasIso) {
    add(`UNI EN ISO ${number}${year ? `:${year}` : ''}`);
    add(`UNI EN ISO ${number}`);
    add(`EN ISO ${number}${year ? `:${year}` : ''}`);
    add(`ISO ${number}${year ? `:${year}` : ''}`);
  } else if (hasIso) {
    add(`ISO ${number}${year ? `:${year}` : ''}`);
    add(`ISO ${number}`);
  }

  if (docType && hasIso) {
    add(`${docType} ${number}`);
  }

  add(number);
  if (number.includes('-')) {
    add(number.split('-')[0]);
  }

  const body = String(issuingBody || '').toUpperCase();
  if (body === 'UNI' && !hasUni) {
    add(`UNI ${canonical}`);
  }

  return variants;
}

module.exports = {
  parseStandardCode,
  normalizeStandardCodeForStorage,
  buildCatalogSearchVariants,
};
