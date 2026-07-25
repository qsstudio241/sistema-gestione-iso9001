/**
 * Catalogo processi di saldatura ISO 4063 — fonte unica per UI, ingest e AI.
 * Estratto operativo; testo normativo completo nel Patrimonio Studio.
 */

/**
 * @type {Array<{ code: string, labelIt: string, labelEn: string, aliases: string[] }>}
 */
const ISO_4063_PROCESSES = [
  { code: '111', labelIt: 'Elettrodo rivestito (MMA/SMAW)', labelEn: 'Manual metal arc welding', aliases: ['mma', 'smaw', 'elettrodo', 'stick', 'arco elettrico manuale'] },
  { code: '114', labelIt: 'Elettrodo con polvere di ferro', labelEn: 'MMA with iron powder', aliases: ['114'] },
  { code: '121', labelIt: 'Arco sommerso filo (SAW)', labelEn: 'Submerged arc welding', aliases: ['saw', 'sommerso', 'submerged'] },
  { code: '122', labelIt: 'Arco sommerso nastro', labelEn: 'SAW with strip', aliases: [] },
  { code: '131', labelIt: 'MIG filo solido (GMAW)', labelEn: 'MIG solid wire', aliases: ['mig', 'gmaw', '131 mig'] },
  { code: '135', labelIt: 'MAG filo solido (GMAW)', labelEn: 'MAG solid wire', aliases: ['mag', '135 mag', 'co2', 'mig mag'] },
  { code: '136', labelIt: 'MAG filo animato (FCAW)', labelEn: 'MAG flux cored wire', aliases: ['fcaw', 'filo animato', 'tubolare'] },
  { code: '138', labelIt: 'MAG filo animato metallico (MCAW)', labelEn: 'Metal cored arc welding', aliases: ['mcaw', 'metal cored'] },
  { code: '141', labelIt: 'TIG elettrodo tungsteno (GTAW)', labelEn: 'TIG / GTAW', aliases: ['tig', 'gtaw', 'wolframio', 'tungsten'] },
  { code: '142', labelIt: 'TIG filo tubolare', labelEn: 'TIG with tubular wire', aliases: [] },
  { code: '145', labelIt: 'TIG + filo freddo', labelEn: 'TIG with cold wire feed', aliases: ['tig cw', 'filo freddo'] },
  { code: '15', labelIt: 'Saldatura al plasma', labelEn: 'Plasma arc welding', aliases: ['paw', 'plasma'] },
  { code: '311', labelIt: 'Ossiacetilenica (OAW)', labelEn: 'Oxy-fuel gas welding', aliases: ['oaw', 'ossiacetilenica', 'ossigas'] },
  { code: '312', labelIt: 'Ossigas con filo', labelEn: 'Oxy-fuel with wire', aliases: [] },
];

const CODE_MAP = new Map(ISO_4063_PROCESSES.map((p) => [p.code, p]));

/** Codici ordinati per lunghezza decrescente (match 136 prima di 13). */
const SORTED_CODES = [...ISO_4063_PROCESSES]
  .map((p) => p.code)
  .sort((a, b) => b.length - a.length || b.localeCompare(a));

/**
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
function normalizeWeldingProcessCode(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (CODE_MAP.has(s)) return s;
  const digits = s.match(/\b(\d{2,3})\b/);
  if (digits && CODE_MAP.has(digits[1])) return digits[1];
  return inferWeldingProcessFromText(s);
}

/**
 * Ricava il codice ISO 4063 dal testo, con priorità:
 * 1. Codice numerico esplicitamente etichettato ("Welding process: 135", "ISO 4063: 135").
 * 2. Codice numerico "nudo" isolato nel testo.
 * 3. Alias testuale — ultima risorsa (evita falsi positivi tipo "elettrodo" su WPQR non-111).
 * @param {string} text
 * @returns {string|null}
 */
function inferWeldingProcessFromText(text) {
  const body = String(text || '');

  const labeledRe = /\b(?:welding\s+process|process(?:o)?(?:\s+di)?(?:\s+saldatura)?|proc\.?)\s*[:.]?\s*(\d{2,3})\b/i;
  const isoRe = /\bISO\s*4063\s*[:.]?\s*(\d{2,3})\b/i;
  const labeled = body.match(labeledRe) || body.match(isoRe);
  if (labeled && CODE_MAP.has(labeled[1])) return labeled[1];

  for (const code of SORTED_CODES) {
    const re = new RegExp(`\\b${code.replace('.', '\\.')}\\b`);
    if (re.test(body)) return code;
  }

  const lower = body.toLowerCase();
  for (const proc of ISO_4063_PROCESSES) {
    if (proc.aliases.some((a) => lower.includes(a))) return proc.code;
  }
  return null;
}

/**
 * @param {{ includeAltro?: boolean }} [opts]
 * @returns {Array<{ value: string, label: string }>}
 */
function getWeldingProcessSelectOptions(opts = {}) {
  const { includeAltro = true } = opts;
  const options = ISO_4063_PROCESSES.map((p) => ({
    value: p.code,
    label: `${p.code} — ${p.labelIt}`,
  }));
  if (includeAltro) {
    options.push({ value: 'altro', label: 'Altro / non in elenco' });
  }
  return options;
}

/**
 * @param {{ maxLines?: number }} [opts]
 * @returns {string}
 */
function buildWeldingProcessPromptSection(opts = {}) {
  const { maxLines = 20 } = opts;
  const lines = ISO_4063_PROCESSES.slice(0, maxLines).map(
    (p) => `- ${p.code}: ${p.labelEn} (alias: ${p.aliases.slice(0, 4).join(', ') || '—'})`,
  );
  const more = ISO_4063_PROCESSES.length > maxLines
    ? `\n[... altri ${ISO_4063_PROCESSES.length - maxLines} codici nel catalogo SGQ ...]`
    : '';

  return `
--- PROCESSI SALDATURA ISO 4063 (welding_process: SOLO codici numerici elencati) ---
Regole:
- Restituisci il codice ISO 4063 (es. "135", "141"), non il nome commerciale.
- MIG/MAG con filo solido → 135; filo animato → 136; TIG → 141; MMA/elettrodo → 111; SAW → 121.
- Se il certificato indica solo "MAG" senza dettaglio, preferisci 135 salvo evidenza di filo animato (136).
Codici principali:
${lines.join('\n')}${more}
--- FINE PROCESSI ISO 4063 ---`.trim();
}

export {
  ISO_4063_PROCESSES,
  normalizeWeldingProcessCode,
  inferWeldingProcessFromText,
  getWeldingProcessSelectOptions,
  buildWeldingProcessPromptSection,
};

export default {
  ISO_4063_PROCESSES,
  normalizeWeldingProcessCode,
  inferWeldingProcessFromText,
  getWeldingProcessSelectOptions,
  buildWeldingProcessPromptSection,
};
