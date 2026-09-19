/**
 * Codice canonico degli atti pubblici (D.Lgs., D.L., legge) per import Normattiva.
 * Se il seed di norm_requirements ha già un codice (es. DLgs_81_2008), si usa quello:
 * chunk e lookup non devono inventarne un altro (D_Lgs_81_08, urn_nir_stato_…).
 */

'use strict';

const legislationSeed = require('../../data/legislation_seed.json');
const decreeDates = require('../data/commonDecreeDates');

/** Prefissi di standard_code che sono diritto pubblico già importato, non norme ISO/UNI. */
const PUBLIC_LAW_CODE_PREFIXES = [
  'DLgs_',
  'D_Lgs_',
  'D_L_',
  'DL_',
  'Legge_',
  'DPR_',
  'urn_nir_stato_',
];

const NIR_RE = /(?:^|:)(decreto\.legislativo|decreto\.legge|decreto\.del\.presidente\.della\.repubblica|regolamento|legge):(\d{4})(?:-\d{2}-\d{2})?;(\d+)\b/i;

function loadSeedByNumberYear() {
  const map = new Map();
  for (const decree of legislationSeed.decrees || []) {
    const match = String(decree.standard_code || '').match(/^DLgs_(\d+)_(\d{4})$/);
    if (match) map.set(`${match[1]}/${match[2]}`, decree.standard_code);
  }
  return map;
}

const SEED_DLGS = loadSeedByNumberYear();

function expandYear(year) {
  const raw = String(year || '');
  if (raw.length === 4) return raw;
  if (raw.length === 2) {
    return Number(raw) >= 70 ? `19${raw}` : `20${raw}`;
  }
  return raw;
}

/**
 * @param {string} urn
 * @returns {{ tipo: string, year: string, number: string } | null}
 */
function parseNirUrn(urn) {
  const match = String(urn || '').match(NIR_RE);
  if (!match) return null;
  return {
    tipo: match[1].toLowerCase(),
    year: match[2],
    number: String(Number(match[3])),
  };
}

function parseStoredCode(code) {
  const raw = String(code || '').trim();
  if (!raw) return null;

  const fromUrn = parseNirUrn(raw);
  if (fromUrn) return fromUrn;

  let match = raw.match(/^urn_nir_stato_(decreto_legislativo|decreto_legge|decreto_del_presidente_della_repubblica|regolamento|legge)_(\d{4})(?:_\d{2}_\d{2})?_(\d+)$/i);
  if (match) {
    return {
      tipo: match[1].toLowerCase().replace(/_/g, '.'),
      year: match[2],
      number: String(Number(match[3])),
    };
  }

  match = raw.match(/^DLgs_(\d+)_(\d{4})$/i);
  if (match) {
    return { tipo: 'decreto.legislativo', year: match[2], number: String(Number(match[1])) };
  }

  match = raw.match(/^D_Lgs_(\d+)_(\d{2,4})$/i);
  if (match) {
    return { tipo: 'decreto.legislativo', year: expandYear(match[2]), number: String(Number(match[1])) };
  }

  match = raw.match(/^D_L_(\d+)_(\d{2,4})$/i);
  if (match) {
    return { tipo: 'decreto.legge', year: expandYear(match[2]), number: String(Number(match[1])) };
  }

  match = raw.match(/^DL_(\d+)_(\d{2,4})$/i);
  if (match) {
    return { tipo: 'decreto.legge', year: expandYear(match[2]), number: String(Number(match[1])) };
  }

  match = raw.match(/^Legge_(\d+)_(\d{2,4})$/i);
  if (match) {
    return { tipo: 'legge', year: expandYear(match[2]), number: String(Number(match[1])) };
  }

  match = raw.match(/^DPR_(\d+)_(\d{2,4})$/i);
  if (match) {
    return {
      tipo: 'decreto.del.presidente.della.repubblica',
      year: expandYear(match[2]),
      number: String(Number(match[1])),
    };
  }

  return null;
}

function seedCodeFor(parsed) {
  if (!parsed || parsed.tipo !== 'decreto.legislativo') return null;
  return SEED_DLGS.get(`${parsed.number}/${parsed.year}`) || null;
}

function fallbackCanonical(parsed) {
  const { tipo, number, year } = parsed;
  if (tipo === 'decreto.legislativo') return `DLgs_${number}_${year}`;
  if (tipo === 'decreto.legge') return `D_L_${number}_${year}`;
  if (tipo === 'legge') return `Legge_${number}_${year}`;
  if (tipo === 'decreto.del.presidente.della.repubblica') return `DPR_${number}_${year}`;
  if (tipo === 'regolamento') return `Reg_${number}_${year}`;
  return `Atto_${number}_${year}`;
}

/**
 * Codice da salvare su document_registry, norm_document_sources e norm_chunks.
 * @param {string} urn
 * @returns {string}
 */
function generateStandardCode(urn) {
  const parsed = parseNirUrn(urn);
  if (!parsed) {
    return String(urn || '').replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
  }
  return seedCodeFor(parsed) || fallbackCanonical(parsed);
}

function sanitizedUrn(tipo, year, number, date) {
  const when = date || year;
  const urn = `urn:nir:stato:${tipo}:${when};${number}`;
  return urn.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Varianti storiche dello stesso atto (codice seed, forma corta, URN sanificata).
 * @param {string} code
 * @returns {string[]}
 */
function codeAliases(code) {
  const raw = String(code || '').trim();
  const set = new Set();
  if (raw) set.add(raw);

  const parsed = parseNirUrn(raw) || parseStoredCode(raw);
  if (!parsed) return [...set];

  const canonical = seedCodeFor(parsed) || fallbackCanonical(parsed);
  set.add(canonical);

  const { tipo, number, year } = parsed;
  const yy = year.slice(2);

  if (tipo === 'decreto.legislativo') {
    set.add(`DLgs_${number}_${year}`);
    set.add(`D_Lgs_${number}_${year}`);
    set.add(`D_Lgs_${number}_${yy}`);
  } else if (tipo === 'decreto.legge') {
    set.add(`D_L_${number}_${year}`);
    set.add(`D_L_${number}_${yy}`);
    set.add(`DL_${number}_${year}`);
  } else if (tipo === 'legge') {
    set.add(`Legge_${number}_${year}`);
    set.add(`Legge_${number}_${yy}`);
  } else if (tipo === 'decreto.del.presidente.della.repubblica') {
    set.add(`DPR_${number}_${year}`);
  }

  const date = (decreeDates[tipo] || {})[`${number}/${year}`] || null;
  set.add(sanitizedUrn(tipo, year, number, null));
  if (date) set.add(sanitizedUrn(tipo, year, number, date));

  return [...set];
}

/**
 * Codici con cui cercare in document_registry / norm_chunks.
 * Non allarga una ISO a tutti i decreti.
 * @param {string} standardCode
 * @returns {string[]}
 */
function expandLookupCodes(standardCode) {
  const raw = String(standardCode || '').trim();
  if (!raw) return [];
  const set = new Set(codeAliases(raw));
  const iso = raw.match(/^(ISO_\d+)(?:_\d{4})?$/i);
  if (iso) set.add(iso[1].toUpperCase());
  return [...set];
}

function isPublicLawChunkCode(code) {
  const value = String(code || '');
  if (!value) return false;
  return PUBLIC_LAW_CODE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function publicLawSqlLikePatterns() {
  return PUBLIC_LAW_CODE_PREFIXES.map((prefix) => `${prefix.replace(/_/g, '[_]')}%`);
}

module.exports = {
  generateStandardCode,
  codeAliases,
  expandLookupCodes,
  isPublicLawChunkCode,
  publicLawSqlLikePatterns,
  PUBLIC_LAW_CODE_PREFIXES,
  parseNirUrn,
};
