/**
 * Loader Knowledge Base Material Compliance (MC-2, ADR-023).
 * Legge Markdown versionato, restituisce snapshot + hash. Zero rete, zero LLM.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TUBE_FORMS = new Set(['tube', 'hollow_section']);
const LONG_ONLY_FAMILIES = new Set(['S460', 'S500']);

function defaultKbRoot() {
  if (process.env.SGQ_MATERIAL_KB_ROOT) {
    return path.resolve(process.env.SGQ_MATERIAL_KB_ROOT);
  }
  const repoKb = path.resolve(__dirname, '../../../knowledge/material-compliance');
  if (fs.existsSync(path.join(repoKb, 'dictionary', 'fields.md'))) {
    return repoKb;
  }
  return path.resolve(__dirname, '../../data/material-compliance');
}

function listMarkdownFiles(root) {
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name.toLowerCase().endsWith('.md')) out.push(full);
    }
  }
  walk(root);
  return out.sort();
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function relPosix(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function parseNumberCell(raw) {
  const s = String(raw || '').trim();
  if (!s || s === '—' || s === '-' || s === '–') return null;
  const range = s.match(/^(\d+(?:[.,]\d+)?)\s*[–\-]\s*(\d+(?:[.,]\d+)?)$/);
  if (range) {
    return {
      min: Number(range[1].replace(',', '.')),
      max: Number(range[2].replace(',', '.')),
    };
  }
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parsePipeTable(block) {
  const lines = block.split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return null;
  const split = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
  const headers = split(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]);
    if (cells.every((c) => /^[-:]+$/.test(c.replace(/\s/g, '')))) continue;
    if (cells.length < 2) continue;
    rows.push(cells);
  }
  return { headers, rows };
}

function tablesAfterHeadings(md) {
  const parts = md.split(/\n(?=## )/);
  const map = {};
  for (const part of parts) {
    const m = part.match(/^##\s+(.+)\n/);
    if (!m) continue;
    const table = parsePipeTable(part);
    if (table) map[m[1].trim()] = table;
  }
  return map;
}

function parseBandHeader(header) {
  const raw = String(header || '').trim();
  const s = raw
    .replace(/°C/g, '')
    .replace(/\s/g, '')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/[–−]/g, '-');
  if (/^T\(/i.test(s) || /^Grado$/i.test(raw)) return null;
  let m = s.match(/^<=(-?\d+(?:[.,]\d+)?)$/);
  if (m) return { min: 0, max: Number(m[1].replace(',', '.')), minInc: true, maxInc: true };
  m = s.match(/^<(-?\d+(?:[.,]\d+)?)$/);
  if (m) return { min: 0, max: Number(m[1].replace(',', '.')), minInc: true, maxInc: false };
  m = s.match(/^>(-?\d+(?:[.,]\d+)?)$/);
  if (m) {
    return { min: Number(m[1].replace(',', '.')), max: Infinity, minInc: false, maxInc: true };
  }
  m = s.match(/^(-?\d+(?:[.,]\d+)?)-(-?\d+(?:[.,]\d+)?)$/);
  if (m) {
    const a = Number(m[1].replace(',', '.'));
    const b = Number(m[2].replace(',', '.'));
    return { min: a, max: b, minInc: a === 3, maxInc: true };
  }
  return null;
}

function inBand(band, t) {
  if (!band || !Number.isFinite(t)) return false;
  const geMin = band.minInc ? t >= band.min : t > band.min;
  const leMax = band.maxInc ? t <= band.max : t < band.max;
  return geMin && leMax;
}

function pickBandValue(bands, thicknessMm) {
  if (!Number.isFinite(thicknessMm)) return { skip: true, reason: 'spessore assente' };
  for (const b of bands) {
    if (inBand(b.band, thicknessMm)) {
      if (b.value == null) return { skip: true, reason: 'nessun limite in questa fascia di spessore' };
      return { skip: false, value: b.value, band: b.band };
    }
  }
  return { skip: true, reason: 'spessore fuori dalle fasce seedate' };
}

function parseGradeKeyedNumericTable(table, { skipCols = 1, asRange = false } = {}) {
  const out = {};
  if (!table) return out;
  const bands = table.headers.slice(skipCols).map(parseBandHeader);
  for (const row of table.rows) {
    const grade = String(row[0] || '').replace(/\s+lunghi$/i, '').trim();
    if (!grade) continue;
    const values = row.slice(skipCols).map((cell) => parseNumberCell(cell));
    out[grade] = bands.map((band, i) => ({
      band,
      value: asRange && values[i] && typeof values[i] === 'object' ? values[i] : values[i],
    })).filter((x) => x.band);
  }
  return out;
}

function parseChemistryTable(table) {
  const out = {};
  if (!table) return out;
  const headers = table.headers;
  for (const row of table.rows) {
    const grade = String(row[0] || '').trim();
    if (!grade) continue;
    const rec = { C: [], other: {} };
    for (let i = 1; i < headers.length; i++) {
      const h = headers[i];
      const val = parseNumberCell(row[i]);
      const band = parseBandHeader(h.replace(/^C\s+/i, ''));
      if (/^C\b/i.test(h) && band) {
        rec.C.push({ band, max: val });
      } else {
        rec.other[h] = val;
      }
    }
    out[grade] = rec;
  }
  return out;
}

function parseKvTable(table) {
  const out = {};
  if (!table) return out;
  const bands = table.headers.slice(2).map(parseBandHeader);
  for (const row of table.rows) {
    const grade = String(row[0] || '').trim();
    const temp = parseNumberCell(row[1]);
    const values = row.slice(2).map(parseNumberCell);
    out[grade] = {
      tempC: typeof temp === 'number' ? temp : null,
      bands: bands.map((band, i) => ({ band, minJ: values[i] })).filter((x) => x.band),
    };
  }
  return out;
}

function parseDictionary(md) {
  const table = parsePipeTable(md);
  const keys = {};
  if (!table) return keys;
  for (const row of table.rows) {
    const key = row[0];
    if (!key || key === 'key') continue;
    keys[key] = {
      en10168: row[1] || null,
      synonyms: String(row[2] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }
  return keys;
}

function parseCoverage(md) {
  const fence = md.match(/```yaml\n([\s\S]*?)```/);
  const covered = [];
  const missing = [];
  let startOn = '';
  if (fence) {
    let section = null;
    for (const line of fence[1].split('\n')) {
      const t = line.trim();
      if (t.startsWith('covered:')) { section = 'covered'; continue; }
      if (t.startsWith('missing:')) { section = 'missing'; continue; }
      if (t.startsWith('start_on:')) {
        startOn = t.slice('start_on:'.length).trim();
        section = null;
        continue;
      }
      const item = t.match(/^-\s+(.*)$/);
      if (item && section === 'covered') covered.push(item[1].trim());
      if (item && section === 'missing') missing.push(item[1].trim());
    }
  }
  return { covered, missing, startOn };
}

function parseDesignation(raw) {
  const s = String(raw || '').toUpperCase().replace(/\s+/g, '');
  const m = s.match(/S(\d{3})(JR|J0|J2|K2|JO)?/);
  if (!m) return null;
  const family = `S${m[1]}`;
  const quality = m[2] === 'JO' ? 'J0' : (m[2] || '');
  const grade = quality ? `${family}${quality}` : family;
  return { family, quality, grade };
}

function findTable(tables, re) {
  const key = Object.keys(tables).find((k) => re.test(k));
  return key ? tables[key] : null;
}

function loadEn10025(md) {
  const tables = tablesAfterHeadings(md);
  return {
    heatChemistry: parseChemistryTable(findTable(tables, /Tabella 1/i)),
    cev: parseGradeKeyedNumericTable(findTable(tables, /Tabella 5/i), { skipCols: 1 }),
    reh: parseGradeKeyedNumericTable(findTable(tables, /Tabella 6 — ReH/i), { skipCols: 1 }),
    rm: parseGradeKeyedNumericTable(findTable(tables, /Tabella 6b/i), { skipCols: 1, asRange: true }),
    kv: parseKvTable(findTable(tables, /Tabella 8/i)),
    longProductsOnly: [...LONG_ONLY_FAMILIES],
    notApplicableProductForms: [...TUBE_FORMS],
  };
}

/**
 * @param {{ kbRoot?: string }} [opts]
 */
function loadMaterialKbSnapshot(opts = {}) {
  const kbRoot = opts.kbRoot || defaultKbRoot();
  if (!fs.existsSync(kbRoot)) {
    throw new Error(`KB Material Compliance non trovata: ${kbRoot}`);
  }
  const files = listMarkdownFiles(kbRoot);
  if (!files.length) {
    throw new Error(`KB Material Compliance vuota: ${kbRoot}`);
  }
  const fileEntries = files.map((full) => {
    const content = fs.readFileSync(full, 'utf8');
    const rel = relPosix(kbRoot, full);
    return { path: rel, sha256: sha256(content), content };
  });
  const hash = sha256(fileEntries.map((f) => `${f.path}\0${f.content}`).join('\n'));

  const byPath = Object.fromEntries(fileEntries.map((f) => [f.path, f.content]));
  const coverage = parseCoverage(byPath['COVERAGE.md'] || '');
  const dictionary = parseDictionary(byPath['dictionary/fields.md'] || '');
  const en10025 = loadEn10025(byPath['standards/en-10025-2.md'] || '');

  return {
    kbRoot,
    hash,
    files: fileEntries.map(({ path: p, sha256: h }) => ({ path: p, sha256: h })),
    coverage,
    dictionary,
    inspectionDocumentTypes: ['2.1', '2.2', '3.1', '3.2'],
    en10025_2: en10025,
    skip: {
      tubes: 'EN 10210-1 / EN 10219-1 Markdown assente',
      fillerProduct: 'ISO 2560 / 17632 / 14174 Markdown assente',
      iso14341LotChemistry: 'ISO 14341 tabelle 3A/3B non seedate (classificazione sì)',
    },
  };
}

/**
 * Lookup limiti EN 10025-2 già parsati. Non valuta pass/fail (MC-3).
 * @param {object} snapshot
 * @param {{ materialRole?: string, productForm?: string, designation?: string, thicknessMm?: number }} query
 */
function lookupEn10025Limits(snapshot, query = {}) {
  const role = query.materialRole || 'base';
  if (role === 'filler') {
    return { skip: true, source: 'filler_product', reason: snapshot.skip.fillerProduct };
  }
  const form = query.productForm || '';
  if (TUBE_FORMS.has(form)) {
    return { skip: true, source: 'en10210', reason: snapshot.skip.tubes };
  }
  const parsed = parseDesignation(query.designation);
  if (!parsed) {
    return { skip: true, source: 'en10025', reason: 'designazione non riconosciuta (seed Sxxx)' };
  }
  if (LONG_ONLY_FAMILIES.has(parsed.family) && (form === 'plate' || form === 'sheet')) {
    return { skip: true, source: 'en10025', reason: 'S460/S500 solo prodotti lunghi' };
  }
  const t = query.thicknessMm;
  const reh = pickBandValue(snapshot.en10025_2.reh[parsed.family] || [], t);
  const rm = pickBandValue(snapshot.en10025_2.rm[parsed.family] || [], t);
  const cev = pickBandValue(snapshot.en10025_2.cev[parsed.grade] || snapshot.en10025_2.cev[parsed.family] || [], t);
  const chem = snapshot.en10025_2.heatChemistry[parsed.grade];
  let cMax = null;
  if (chem && Number.isFinite(t)) {
    const cHit = pickBandValue(chem.C.map((c) => ({ band: c.band, value: c.max })), t);
    if (!cHit.skip) cMax = cHit.value;
  }
  const kv = snapshot.en10025_2.kv[parsed.grade];
  let kvMin = null;
  if (kv && Number.isFinite(t)) {
    const kvHit = pickBandValue(kv.bands.map((b) => ({ band: b.band, value: b.minJ })), t);
    if (!kvHit.skip) kvMin = { tempC: kv.tempC, minJ: kvHit.value };
  }
  return {
    skip: false,
    source: 'en10025-2',
    designation: parsed,
    rehMin: reh.skip ? null : reh.value,
    rm: rm.skip ? null : rm.value,
    cevMax: cev.skip ? null : cev.value,
    cHeatMax: cMax,
    kv: kvMin,
    reasons: [reh, rm, cev].filter((x) => x.skip).map((x) => x.reason),
  };
}

module.exports = {
  defaultKbRoot,
  loadMaterialKbSnapshot,
  lookupEn10025Limits,
  parseDesignation,
};
