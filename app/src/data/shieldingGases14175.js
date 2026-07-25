/**
 * Catalogo gas di protezione ISO 14175:2008 — fonte unica per UI, ingest e AI.
 * Mantenere sincronizzato con backend/src/data/shieldingGases14175.js
 * Estratto operativo; testo normativo completo in docs/Normative/ NORMA_00012.
 */

/**
 * @type {Array<{ code: string, group: string, labelIt: string, labelEn: string, aliases: string[] }>}
 */
const ISO_14175_GASES = [
  { code: 'I1', group: 'I', labelIt: 'Argon 100 %', labelEn: 'Argon 100%', aliases: ['argon', 'ar 100', 'puro ar'] },
  { code: 'I2', group: 'I', labelIt: 'Elio 100 %', labelEn: 'Helium 100%', aliases: ['elio', 'helium', 'he 100'] },
  { code: 'I3', group: 'I', labelIt: 'Ar + He (0,5–95 % He)', labelEn: 'Ar + He mix', aliases: ['ar/he', 'ar+he'] },
  { code: 'M11', group: 'M1', labelIt: 'Ar + CO₂ basso + H₂', labelEn: 'Ar + low CO2 + H2', aliases: [] },
  { code: 'M12', group: 'M1', labelIt: 'Ar + CO₂ 0,5–5 %', labelEn: 'Ar + CO2 0.5-5%', aliases: [] },
  { code: 'M13', group: 'M1', labelIt: 'Ar + O₂ 0,5–3 %', labelEn: 'Ar + O2 0.5-3%', aliases: [] },
  { code: 'M14', group: 'M1', labelIt: 'Ar + CO₂ + O₂ bassi', labelEn: 'Ar + low CO2 + O2', aliases: [] },
  { code: 'M20', group: 'M2', labelIt: 'Ar + CO₂ 5–15 %', labelEn: 'Ar + CO2 5-15%', aliases: [] },
  { code: 'M21', group: 'M2', labelIt: 'Ar + CO₂ 15–25 %', labelEn: 'Ar + CO2 15-25%', aliases: ['ar+18%co2', 'ar+20%co2', 'corgon'] },
  { code: 'M22', group: 'M2', labelIt: 'Ar + O₂ 3–10 %', labelEn: 'Ar + O2 3-10%', aliases: [] },
  { code: 'M23', group: 'M2', labelIt: 'Ar + CO₂ basso + O₂ 3–10 %', labelEn: 'Ar + low CO2 + O2 3-10%', aliases: [] },
  { code: 'M24', group: 'M2', labelIt: 'Ar + CO₂ 5–15 % + O₂ basso', labelEn: 'Ar + CO2 5-15% + low O2', aliases: [] },
  { code: 'M25', group: 'M2', labelIt: 'Ar + CO₂ 5–15 % + O₂ 3–10 %', labelEn: 'Ar + CO2 5-15% + O2 3-10%', aliases: [] },
  { code: 'M26', group: 'M2', labelIt: 'Ar + CO₂ 15–25 % + O₂ basso', labelEn: 'Ar + CO2 15-25% + low O2', aliases: [] },
  { code: 'M27', group: 'M2', labelIt: 'Ar + CO₂ 15–25 % + O₂ 3–10 %', labelEn: 'Ar + CO2 15-25% + O2 3-10%', aliases: [] },
  { code: 'M31', group: 'M3', labelIt: 'Ar + CO₂ 25–50 %', labelEn: 'Ar + CO2 25-50%', aliases: [] },
  { code: 'M32', group: 'M3', labelIt: 'Ar + O₂ 10–15 %', labelEn: 'Ar + O2 10-15%', aliases: [] },
  { code: 'M33', group: 'M3', labelIt: 'Ar + CO₂ alto + O₂', labelEn: 'Ar + high CO2 + O2', aliases: [] },
  { code: 'M34', group: 'M3', labelIt: 'Ar + CO₂ medio + O₂ alto', labelEn: 'Ar + mid CO2 + high O2', aliases: [] },
  { code: 'M35', group: 'M3', labelIt: 'Ar + CO₂ alto + O₂ alto', labelEn: 'Ar + high CO2 + high O2', aliases: [] },
  { code: 'C1', group: 'C', labelIt: 'CO₂ 100 %', labelEn: 'CO2 100%', aliases: ['co2', 'anidride carbonica', 'co2 puro'] },
  { code: 'C2', group: 'C', labelIt: 'CO₂ + O₂ (fino 30 %)', labelEn: 'CO2 + O2 up to 30%', aliases: [] },
  { code: 'R1', group: 'R', labelIt: 'Ar + H₂ 0,5–15 %', labelEn: 'Ar + H2 0.5-15%', aliases: [] },
  { code: 'R2', group: 'R', labelIt: 'Ar + H₂ 15–50 %', labelEn: 'Ar + H2 15-50%', aliases: [] },
  { code: 'N1', group: 'N', labelIt: 'N₂ 100 %', labelEn: 'Nitrogen 100%', aliases: ['azoto', 'nitrogen', 'n2'] },
  { code: 'N2', group: 'N', labelIt: 'Ar + N₂ 0,5–5 %', labelEn: 'Ar + N2 0.5-5%', aliases: [] },
  { code: 'N3', group: 'N', labelIt: 'Ar + N₂ 5–50 %', labelEn: 'Ar + N2 5-50%', aliases: [] },
  { code: 'N4', group: 'N', labelIt: 'Ar + H₂ + N₂ bassi', labelEn: 'Ar + low H2 + N2', aliases: [] },
  { code: 'N5', group: 'N', labelIt: 'H₂ + N₂ (balance N₂)', labelEn: 'H2 + N2 balance', aliases: [] },
  { code: 'O1', group: 'O', labelIt: 'O₂ 100 %', labelEn: 'Oxygen 100%', aliases: ['ossigeno', 'oxygen'] },
  { code: 'Z', group: 'Z', labelIt: 'Fuori tabella / componente non elencato', labelEn: 'Outside Table 2 / unlisted', aliases: [] },
];

const CODE_MAP = new Map(ISO_14175_GASES.map((g) => [g.code.toUpperCase(), g]));

/** Codici ordinati per lunghezza decrescente (M21 prima di M2). */
const SORTED_CODES = [...ISO_14175_GASES]
  .map((g) => g.code)
  .sort((a, b) => b.length - a.length || b.localeCompare(a));

/**
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
function normalizeShieldingGasCode(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  const upper = s.toUpperCase().replace(/\s+/g, '');

  const longDesig = upper.match(/ISO\s*14175[-–]?\s*([IMCRNOZ]\d{0,2})/i);
  if (longDesig) {
    const code = longDesig[1].toUpperCase();
    if (CODE_MAP.has(code)) return code;
  }

  if (CODE_MAP.has(upper)) return upper;

  const bare = upper.match(/\b([IMCRNOZ]\d{1,2})\b/);
  if (bare && CODE_MAP.has(bare[1])) return bare[1];

  if (upper === 'Z' || /\bZ\b/.test(upper)) return 'Z';

  return inferShieldingGasFromText(s);
}

/**
 * @param {string} text
 * @returns {string|null}
 */
function inferShieldingGasFromText(text) {
  const lower = String(text || '').toLowerCase();
  for (const gas of ISO_14175_GASES) {
    if (gas.aliases.some((a) => a && lower.includes(a))) return gas.code;
  }
  for (const code of SORTED_CODES) {
    const re = new RegExp(`\\b${code}\\b`, 'i');
    if (re.test(text) || new RegExp(`ISO\\s*14175[:\\s–-]*${code}`, 'i').test(text)) {
      return code;
    }
  }
  return null;
}

/**
 * @param {{ includeAltro?: boolean }} [opts]
 * @returns {Array<{ value: string, label: string }>}
 */
function getShieldingGasSelectOptions(opts = {}) {
  const { includeAltro = true } = opts;
  const options = ISO_14175_GASES.map((g) => ({
    value: g.code,
    label: `${g.code} — ${g.labelIt}`,
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
function buildShieldingGasPromptSection(opts = {}) {
  const { maxLines = 16 } = opts;
  const frequent = ['I1', 'I3', 'M12', 'M13', 'M20', 'M21', 'M22', 'M24', 'C1', 'R1', 'N1', 'Z'];
  const preferred = ISO_14175_GASES.filter((g) => frequent.includes(g.code));
  const lines = preferred.slice(0, maxLines).map(
    (g) => `- ${g.code}: ${g.labelEn} (${g.labelIt})`,
  );

  return `
--- GAS DI PROTEZIONE ISO 14175 (shielding_gas: SOLO simboli di classificazione) ---
Regole:
- Restituisci il simbolo corto (es. "M21", "I1", "C1"), non la designazione lunga né il nome commerciale.
- Se compare "ISO 14175 – M21 – ArC – 18", salva "M21".
- Processi senza gas (111 MMA, 121 SAW tipici) → null.
- Miscele fuori Tabella 2 → "Z".
Simboli frequenti:
${lines.join('\n')}
--- FINE GAS ISO 14175 ---`.trim();
}

export {
  ISO_14175_GASES,
  normalizeShieldingGasCode,
  inferShieldingGasFromText,
  getShieldingGasSelectOptions,
  buildShieldingGasPromptSection,
};

export default {
  ISO_14175_GASES,
  normalizeShieldingGasCode,
  inferShieldingGasFromText,
  getShieldingGasSelectOptions,
  buildShieldingGasPromptSection,
};
