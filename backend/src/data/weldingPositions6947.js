'use strict';

/**
 * Catalogo posizioni di saldatura ISO 6947 — fonte unica per UI, ingest e AI.
 * Mantenere sincronizzato con app/src/data/weldingPositions6947.js
 */

const ISO_6947_POSITIONS = [
  { code: 'PA', labelIt: 'Piana / sotto testa', labelEn: 'Flat / downhand', product: 'both', aliases: ['1g', '1f', 'flat'] },
  { code: 'PB', labelIt: 'Orizzontale su verticale', labelEn: 'Horizontal on vertical', product: 'both', aliases: ['2f'] },
  { code: 'PC', labelIt: 'Orizzontale', labelEn: 'Horizontal', product: 'both', aliases: ['2g'] },
  { code: 'PD', labelIt: 'Sopratesta orizzontale', labelEn: 'Horizontal overhead', product: 'both', aliases: [] },
  { code: 'PE', labelIt: 'Sopratesta', labelEn: 'Overhead', product: 'both', aliases: ['4g', '4f', 'overhead'] },
  { code: 'PF', labelIt: 'Verticale ascendente', labelEn: 'Vertical up', product: 'both', aliases: ['3g', '3f', 'vertical up', 'vert ascendente'] },
  { code: 'PG', labelIt: 'Verticale discendente', labelEn: 'Vertical down', product: 'both', aliases: ['vertical down', 'vert discendente'] },
  { code: 'PH', labelIt: 'Tubo orizzontale fisso', labelEn: 'Pipe fixed horizontal', product: 'pipe', aliases: ['5g'] },
  { code: 'PJ', labelIt: 'Tubo inclinato fisso', labelEn: 'Pipe fixed inclined', product: 'pipe', aliases: ['6g'] },
  { code: 'H-L045', labelIt: 'Tubo inclinato 45° (rotante)', labelEn: 'Pipe inclined 45°', product: 'pipe', aliases: ['6g 45', 'hl045'] },
  { code: 'J-L045', labelIt: 'Tubo inclinato 45° discendente', labelEn: 'Pipe inclined 45° downhill', product: 'pipe', aliases: ['jl045'] },
];

const CODE_MAP = new Map(ISO_6947_POSITIONS.map((p) => [p.code.toUpperCase(), p]));

const SORTED_CODES = [...ISO_6947_POSITIONS]
  .map((p) => p.code)
  .sort((a, b) => b.length - a.length);

function normalizeWeldingPositionCode(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  const withDash = s.replace('HL045', 'H-L045').replace('JL045', 'J-L045');
  if (CODE_MAP.has(withDash)) return withDash;
  if (CODE_MAP.has(s)) return s;
  return null;
}

function normalizeWeldingPositions(raw) {
  if (raw == null) return [];
  let parts = raw;
  if (typeof parts === 'string') {
    parts = parts.split(/[,;/+\s]+/);
  }
  if (!Array.isArray(parts)) return [];
  const out = [];
  for (const item of parts) {
    const code = normalizeWeldingPositionCode(item) || inferSinglePositionFromText(item);
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

function inferSinglePositionFromText(text) {
  const lower = String(text || '').toLowerCase();
  for (const pos of ISO_6947_POSITIONS) {
    if (pos.aliases.some((a) => lower.includes(a))) return pos.code;
  }
  for (const code of SORTED_CODES) {
    const re = new RegExp(`\\b${code.replace('-', '[-\\s]?')}\\b`, 'i');
    if (re.test(text)) return code;
  }
  return null;
}

function extractWeldingPositionsFromText(text) {
  const found = [];
  for (const code of SORTED_CODES) {
    const re = new RegExp(`\\b${code.replace('-', '[-\\s]?')}\\b`, 'gi');
    if (re.test(text)) {
      const norm = normalizeWeldingPositionCode(code);
      if (norm && !found.includes(norm)) found.push(norm);
    }
  }
  if (found.length) return found;
  const single = inferSinglePositionFromText(text);
  return single ? [single] : [];
}

function getWeldingPositionSelectOptions(opts = {}) {
  const { includeAltro = false, product = null } = opts;
  let list = ISO_6947_POSITIONS;
  if (product) {
    list = list.filter((p) => p.product === product || p.product === 'both');
  }
  const options = list.map((p) => ({
    value: p.code,
    label: `${p.code} — ${p.labelIt}`,
  }));
  if (includeAltro) {
    options.push({ value: 'altro', label: 'Altro / non in elenco' });
  }
  return options;
}

function buildWeldingPositionPromptSection(opts = {}) {
  const { maxLines = 15 } = opts;
  const lines = ISO_6947_POSITIONS.slice(0, maxLines).map(
    (p) => `- ${p.code}: ${p.labelEn} (${p.labelIt})`,
  );

  return `
--- POSIZIONI SALDATURA ISO 6947 (welding_positions: array di codici MAIUSCOLI) ---
Regole:
- Restituisci array di codici ISO 6947: PA, PB, PC, PD, PE, PF, PG, PH, PJ, H-L045, J-L045.
- Non confondere PA (piana) con PE (sopratesta) o PF (verticale su).
- Se il certificato elenca posizioni multiple, includile tutte nell'array.
- AWS 1G/2G/… non sono ISO: mappa se possibile (1G→PA, 2G→PC, 3G→PF, 4G→PE, 6G→PJ o H-L045).
Codici:
${lines.join('\n')}
--- FINE POSIZIONI ISO 6947 ---`.trim();
}

module.exports = {
  ISO_6947_POSITIONS,
  normalizeWeldingPositionCode,
  normalizeWeldingPositions,
  inferSinglePositionFromText,
  extractWeldingPositionsFromText,
  getWeldingPositionSelectOptions,
  buildWeldingPositionPromptSection,
};
