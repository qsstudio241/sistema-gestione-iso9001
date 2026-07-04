/**
 * Catalogo gruppi materiali ISO/TR 15608:2013 — fonte unica per UI, ingest e AI.
 * Estratto operativo (codici + descrizioni); testo normativo completo nel Patrimonio Studio.
 */

/** @typedef {'steel'|'aluminium'|'copper'|'nickel'|'titanium'|'zirconium'|'cast_iron'} MaterialFamily */

/**
 * @type {Array<{ code: string, family: MaterialFamily, labelIt: string, labelEn: string, parent?: string }>}
 */
const ISO_TR_15608_GROUPS = [
  // Acciai — gruppo 1
  { code: '1.1', family: 'steel', parent: '1', labelIt: 'Acciai con Re ≤ 275 MPa', labelEn: 'Steels with Re ≤ 275 N/mm²' },
  { code: '1.2', family: 'steel', parent: '1', labelIt: 'Acciai con 275 < Re ≤ 360 MPa', labelEn: 'Steels with 275 < Re ≤ 360 N/mm²' },
  { code: '1.3', family: 'steel', parent: '1', labelIt: 'Acciai a grano fino normalizzati con Re > 360 MPa', labelEn: 'Normalized fine-grain steels with Re > 360 N/mm²' },
  { code: '1.4', family: 'steel', parent: '1', labelIt: 'Acciai resistenti alla corrosione atmosferica', labelEn: 'Steels with improved atmospheric corrosion resistance' },
  { code: '2.1', family: 'steel', parent: '2', labelIt: 'Acciai TMCP a grano fino 360 < Re ≤ 460 MPa', labelEn: 'Thermomechanically treated fine-grain steels 360 < Re ≤ 460 N/mm²' },
  { code: '2.2', family: 'steel', parent: '2', labelIt: 'Acciai TMCP a grano fino con Re > 460 MPa', labelEn: 'Thermomechanically treated fine-grain steels Re > 460 N/mm²' },
  { code: '3.1', family: 'steel', parent: '3', labelIt: 'Acciai temprati e rinvenuti 360 < Re ≤ 690 MPa', labelEn: 'Quenched and tempered fine-grain steels 360 < Re ≤ 690 N/mm²' },
  { code: '3.2', family: 'steel', parent: '3', labelIt: 'Acciai temprati e rinvenuti con Re > 690 MPa', labelEn: 'Quenched and tempered fine-grain steels Re > 690 N/mm²' },
  { code: '3.3', family: 'steel', parent: '3', labelIt: 'Acciai a grano fino induriti per precipitazione (non inox)', labelEn: 'Precipitation-hardened fine-grain steels except stainless' },
  { code: '4.1', family: 'steel', parent: '4', labelIt: 'Acciai bassolegati Cr-Mo-(Ni) Cr ≤ 0,3 %, Ni ≤ 0,7 %', labelEn: 'Low alloy Cr-Mo-(Ni) steels Cr ≤ 0.3 %, Ni ≤ 0.7 %' },
  { code: '4.2', family: 'steel', parent: '4', labelIt: 'Acciai bassolegati Cr-Mo-(Ni) Cr ≤ 0,7 %, Ni ≤ 1,5 %', labelEn: 'Low alloy Cr-Mo-(Ni) steels Cr ≤ 0.7 %, Ni ≤ 1.5 %' },
  { code: '5.1', family: 'steel', parent: '5', labelIt: 'Acciai Cr-Mo 0,75 % ≤ Cr ≤ 1,5 %, Mo ≤ 0,7 %', labelEn: 'Cr-Mo steels 0.75 % ≤ Cr ≤ 1.5 %, Mo ≤ 0.7 %' },
  { code: '5.2', family: 'steel', parent: '5', labelIt: 'Acciai Cr-Mo 1,5 % < Cr ≤ 3,5 %, 0,7 % < Mo ≤ 1,2 %', labelEn: 'Cr-Mo steels 1.5 % < Cr ≤ 3.5 %, 0.7 % < Mo ≤ 1.2 %' },
  { code: '5.3', family: 'steel', parent: '5', labelIt: 'Acciai Cr-Mo 3,5 % < Cr ≤ 7,0 %, 0,4 % < Mo ≤ 0,7 %', labelEn: 'Cr-Mo steels 3.5 % < Cr ≤ 7.0 %, 0.4 % < Mo ≤ 0.7 %' },
  { code: '5.4', family: 'steel', parent: '5', labelIt: 'Acciai Cr-Mo 7,0 % < Cr ≤ 10,0 %, 0,7 % < Mo ≤ 1,2 %', labelEn: 'Cr-Mo steels 7.0 % < Cr ≤ 10.0 %, 0.7 % < Mo ≤ 1.2 %' },
  { code: '6.1', family: 'steel', parent: '6', labelIt: 'Acciai alto V Cr-Mo 0,3 % ≤ Cr ≤ 0,75 %', labelEn: 'High V Cr-Mo steels 0.3 % ≤ Cr ≤ 0.75 %' },
  { code: '6.2', family: 'steel', parent: '6', labelIt: 'Acciai alto V Cr-Mo 0,75 % < Cr ≤ 3,5 %', labelEn: 'High V Cr-Mo steels 0.75 % < Cr ≤ 3.5 %' },
  { code: '6.3', family: 'steel', parent: '6', labelIt: 'Acciai alto V Cr-Mo 3,5 % < Cr ≤ 7,0 %', labelEn: 'High V Cr-Mo steels 3.5 % < Cr ≤ 7.0 %' },
  { code: '6.4', family: 'steel', parent: '6', labelIt: 'Acciai alto V Cr-Mo 7,0 % < Cr ≤ 12,5 %', labelEn: 'High V Cr-Mo steels 7.0 % < Cr ≤ 12.5 %' },
  { code: '7.1', family: 'steel', parent: '7', labelIt: 'Inossidabili ferritici', labelEn: 'Ferritic stainless steels' },
  { code: '7.2', family: 'steel', parent: '7', labelIt: 'Inossidabili martensitici', labelEn: 'Martensitic stainless steels' },
  { code: '7.3', family: 'steel', parent: '7', labelIt: 'Inossidabili induriti per precipitazione', labelEn: 'Precipitation-hardened stainless steels' },
  { code: '8.1', family: 'steel', parent: '8', labelIt: 'Inossidabili austenitici Cr ≤ 19 %', labelEn: 'Austenitic stainless steels Cr ≤ 19 %' },
  { code: '8.2', family: 'steel', parent: '8', labelIt: 'Inossidabili austenitici Cr > 19 %', labelEn: 'Austenitic stainless steels Cr > 19 %' },
  { code: '8.3', family: 'steel', parent: '8', labelIt: 'Inossidabili austenitici al manganese 4 % < Mn ≤ 12 %', labelEn: 'Manganese austenitic stainless steels' },
  { code: '9.1', family: 'steel', parent: '9', labelIt: 'Acciai legati al Ni Ni ≤ 3,0 %', labelEn: 'Nickel alloy steels Ni ≤ 3.0 %' },
  { code: '9.2', family: 'steel', parent: '9', labelIt: 'Acciai legati al Ni 3,0 % < Ni ≤ 8,0 %', labelEn: 'Nickel alloy steels 3.0 % < Ni ≤ 8.0 %' },
  { code: '9.3', family: 'steel', parent: '9', labelIt: 'Acciai legati al Ni 8,0 % < Ni ≤ 10,0 %', labelEn: 'Nickel alloy steels 8.0 % < Ni ≤ 10.0 %' },
  { code: '10.1', family: 'steel', parent: '10', labelIt: 'Duplex austenitico-ferritico Cr ≤ 24 %', labelEn: 'Duplex stainless steels Cr ≤ 24 %' },
  { code: '10.2', family: 'steel', parent: '10', labelIt: 'Duplex austenitico-ferritico Cr > 24 %', labelEn: 'Duplex stainless steels Cr > 24 %' },
  { code: '10.3', family: 'steel', parent: '10', labelIt: 'Duplex austenitico-ferritico Ni ≤ 2 %', labelEn: 'Duplex stainless steels Ni ≤ 2 %' },
  { code: '11.1', family: 'steel', parent: '11', labelIt: 'Acciai gruppo 1 con 0,25 % < C ≤ 0,35 %', labelEn: 'Group 1 steels 0.25 % < C ≤ 0.35 %' },
  { code: '11.2', family: 'steel', parent: '11', labelIt: 'Acciai gruppo 1 con 0,35 % < C ≤ 0,5 %', labelEn: 'Group 1 steels 0.35 % < C ≤ 0.5 %' },
  { code: '11.3', family: 'steel', parent: '11', labelIt: 'Acciai gruppo 1 con 0,5 % < C ≤ 0,85 %', labelEn: 'Group 1 steels 0.5 % < C ≤ 0.85 %' },
  // Alluminio
  { code: '21', family: 'aluminium', labelIt: 'Alluminio puro ≤ 1 % impurità/lega', labelEn: 'Pure aluminium ≤ 1 % impurities' },
  { code: '22.1', family: 'aluminium', parent: '22', labelIt: 'Leghe Al-Mn non trattabili termicamente', labelEn: 'Aluminium-manganese alloys' },
  { code: '22.2', family: 'aluminium', parent: '22', labelIt: 'Leghe Al-Mg con Mg ≤ 1,5 %', labelEn: 'Al-Mg alloys Mg ≤ 1.5 %' },
  { code: '22.3', family: 'aluminium', parent: '22', labelIt: 'Leghe Al-Mg con 1,5 % < Mg ≤ 3,5 %', labelEn: 'Al-Mg alloys 1.5 % < Mg ≤ 3.5 %' },
  { code: '22.4', family: 'aluminium', parent: '22', labelIt: 'Leghe Al-Mg con Mg > 3,5 %', labelEn: 'Al-Mg alloys Mg > 3.5 %' },
  { code: '23.1', family: 'aluminium', parent: '23', labelIt: 'Leghe Al-Mg-Si trattabili termicamente', labelEn: 'Al-Mg-Si heat treatable alloys' },
  { code: '23.2', family: 'aluminium', parent: '23', labelIt: 'Leghe Al-Zn-Mg trattabili termicamente', labelEn: 'Al-Zn-Mg heat treatable alloys' },
  { code: '24.1', family: 'aluminium', parent: '24', labelIt: 'Leghe Al-Si con Cu ≤ 1 %, 5 % < Si ≤ 15 %', labelEn: 'Al-Si cast alloys Cu ≤ 1 %' },
  { code: '24.2', family: 'aluminium', parent: '24', labelIt: 'Leghe Al-Si-Mg da fonderia', labelEn: 'Al-Si-Mg cast alloys' },
  { code: '25', family: 'aluminium', labelIt: 'Leghe Al-Si-Cu da fonderia', labelEn: 'Al-Si-Cu cast alloys' },
  { code: '26', family: 'aluminium', labelIt: 'Leghe Al-Cu con 2 % < Cu ≤ 6 %', labelEn: 'Al-Cu alloys 2 % < Cu ≤ 6 %' },
  // Rame
  { code: '31', family: 'copper', labelIt: 'Rame con fino a 6 % Ag e 3 % Fe', labelEn: 'Copper with up to 6 % Ag and 3 % Fe' },
  { code: '32.1', family: 'copper', parent: '32', labelIt: 'Leghe Cu-Zn binarie', labelEn: 'Binary copper-zinc alloys' },
  { code: '32.2', family: 'copper', parent: '32', labelIt: 'Leghe Cu-Zn complesse', labelEn: 'Complex copper-zinc alloys' },
  { code: '33', family: 'copper', labelIt: 'Leghe Cu-Sn (bronzo)', labelEn: 'Copper-tin alloys' },
  { code: '34', family: 'copper', labelIt: 'Leghe Cu-Ni', labelEn: 'Copper-nickel alloys' },
  { code: '35', family: 'copper', labelIt: 'Leghe Cu-Al', labelEn: 'Copper-aluminium alloys' },
  { code: '36', family: 'copper', labelIt: 'Leghe Cu-Ni-Zn', labelEn: 'Copper-nickel-zinc alloys' },
  { code: '37', family: 'copper', labelIt: 'Leghe di rame a bassa lega (< 5 % altri elementi)', labelEn: 'Low alloyed copper alloys' },
  { code: '38', family: 'copper', labelIt: 'Altre leghe di rame (≥ 5 % altri elementi)', labelEn: 'Other copper alloys' },
  // Nichel
  { code: '41', family: 'nickel', labelIt: 'Nichel puro', labelEn: 'Pure nickel' },
  { code: '42', family: 'nickel', labelIt: 'Leghe Ni-Cu Ni ≥ 45 %, Cu ≥ 10 %', labelEn: 'Nickel-copper alloys' },
  { code: '43', family: 'nickel', labelIt: 'Leghe Ni-Cr-Fe-Mo Ni ≥ 40 %', labelEn: 'Nickel-chromium alloys' },
  { code: '44', family: 'nickel', labelIt: 'Leghe Ni-Mo Ni ≥ 45 %, Mo ≤ 32 %', labelEn: 'Nickel-molybdenum alloys' },
  { code: '45', family: 'nickel', labelIt: 'Leghe Ni-Fe-Cr Ni ≥ 31 %', labelEn: 'Nickel-iron-chromium alloys' },
  { code: '46', family: 'nickel', labelIt: 'Leghe Ni-Cr-Co Ni ≥ 45 %, Co ≥ 10 %', labelEn: 'Nickel-chromium-cobalt alloys' },
  { code: '47', family: 'nickel', labelIt: 'Leghe Ni-Fe-Cr-Cu Ni ≥ 45 %', labelEn: 'Nickel-iron-chromium-copper alloys' },
  { code: '48', family: 'nickel', labelIt: 'Leghe Ni-Fe-Co-Cr-Mo-Cu 31 % ≤ Ni ≤ 45 %', labelEn: 'Nickel-iron-cobalt alloys' },
  // Titanio
  { code: '51.1', family: 'titanium', parent: '51', labelIt: 'Titanio puro O₂ ≤ 0,20 %', labelEn: 'Pure titanium O₂ ≤ 0.20 %' },
  { code: '51.2', family: 'titanium', parent: '51', labelIt: 'Titanio puro 0,20 % < O₂ ≤ 0,25 %', labelEn: 'Pure titanium 0.20 % < O₂ ≤ 0.25 %' },
  { code: '51.3', family: 'titanium', parent: '51', labelIt: 'Titanio puro 0,25 % < O₂ ≤ 0,35 %', labelEn: 'Pure titanium 0.25 % < O₂ ≤ 0.35 %' },
  { code: '51.4', family: 'titanium', parent: '51', labelIt: 'Titanio puro 0,35 % < O₂ ≤ 0,40 %', labelEn: 'Pure titanium 0.35 % < O₂ ≤ 0.40 %' },
  { code: '52', family: 'titanium', labelIt: 'Leghe titanio alfa', labelEn: 'Alpha titanium alloys' },
  { code: '53', family: 'titanium', labelIt: 'Leghe titanio alfa-beta', labelEn: 'Alpha-beta titanium alloys' },
  { code: '54', family: 'titanium', labelIt: 'Leghe titanio near-beta e beta', labelEn: 'Near-beta and beta titanium alloys' },
  // Zirconio
  { code: '61', family: 'zirconium', labelIt: 'Zirconio puro', labelEn: 'Pure zirconium' },
  { code: '62', family: 'zirconium', labelIt: 'Zirconio con 2,5 % Nb', labelEn: 'Zirconium with 2.5 % Nb' },
  // Ghisa
  { code: '71', family: 'cast_iron', labelIt: 'Ghisa grigia con Rm o HB specificati', labelEn: 'Grey cast irons' },
  { code: '72.1', family: 'cast_iron', parent: '72', labelIt: 'Ghisa sferoidale ferritica con impatto', labelEn: 'Spheroidal graphite cast irons ferrite type with impact' },
  { code: '72.2', family: 'cast_iron', parent: '72', labelIt: 'Ghisa sferoidale ferritica Rm/Rp0,2/A o HB', labelEn: 'Spheroidal graphite cast irons ferrite type' },
  { code: '72.3', family: 'cast_iron', parent: '72', labelIt: 'Ghisa sferoidale EN-GJS-500-7 / GJS-450-10', labelEn: 'Spheroidal graphite EN-GJS grades' },
  { code: '72.4', family: 'cast_iron', parent: '72', labelIt: 'Ghisa sferoidale perlite Rm/Rp0,2/A o HB', labelEn: 'Spheroidal graphite perlite type' },
  { code: '73', family: 'cast_iron', labelIt: 'Ghisa malleabile', labelEn: 'Malleable cast irons' },
  { code: '74', family: 'cast_iron', labelIt: 'Ghisa austemperata (ADI)', labelEn: 'Austempered ductile cast irons' },
  { code: '75', family: 'cast_iron', labelIt: 'Ghisa austenitica', labelEn: 'Austenitic cast irons' },
  { code: '76', family: 'cast_iron', labelIt: 'Altre ghise (esclusi 71-75)', labelEn: 'Other cast irons' },
];

const FAMILY_LABELS_IT = {
  steel: 'Acciai',
  aluminium: 'Alluminio e leghe',
  copper: 'Rame e leghe',
  nickel: 'Nichel e leghe',
  titanium: 'Titanio e leghe',
  zirconium: 'Zirconio e leghe',
  cast_iron: 'Ghisa',
};

/** Codici ordinati per match lungo prima (10.3 prima di 10). */
const SORTED_CODES = [...ISO_TR_15608_GROUPS]
  .map((g) => g.code)
  .sort((a, b) => b.length - a.length || b.localeCompare(a));

const CODE_MAP = new Map(ISO_TR_15608_GROUPS.map((g) => [g.code, g]));

/** Euristica designazioni commerciali → gruppo ISO/TR 15608 (acciai comuni). */
const STEEL_DESIGNATION_HINTS = [
  { pattern: /\bS(?:235|275JR?|275N)\b/i, code: '1.1' },
  { pattern: /\bP(?:235|265)GH?\b/i, code: '1.1' },
  { pattern: /\bS(?:355|355JR?|355J2|355N)\b/i, code: '1.2' },
  { pattern: /\bP(?:355|355)GH?\b/i, code: '1.2' },
  { pattern: /\bS(?:420|460)\b/i, code: '1.3' },
  { pattern: /\bX5CrNi18-10\b|1\.4301\b|AISI\s*304\b/i, code: '8.1' },
  { pattern: /\bX2CrNi18-9\b|1\.4307\b|AISI\s*304L\b/i, code: '8.1' },
  { pattern: /\bX2CrNiMo17-12-2\b|1\.4401\b|AISI\s*316\b/i, code: '8.2' },
  { pattern: /\bX2CrNiMo17-12-3\b|1\.4404\b|AISI\s*316L\b/i, code: '8.2' },
  { pattern: /\bX2CrNiMoN22-5-3\b|1\.4462\b/i, code: '10.1' },
  { pattern: /\bX5CrNiMo17-12-2\b/i, code: '8.2' },
];

function findMaterialGroup(code) {
  if (code == null || code === '') return null;
  const normalized = normalizeMaterialGroupCode(code);
  return normalized ? CODE_MAP.get(normalized) || null : null;
}

/**
 * Normalizza un codice gruppo verso il catalogo ISO/TR 15608.
 * @param {unknown} val
 * @returns {string|null}
 */
function normalizeMaterialGroupCode(val) {
  const raw = String(val ?? '').trim();
  if (!raw) return null;

  const upper = raw.toUpperCase().replace(/\s+/g, '');
  if (upper === 'ALTRO' || upper === 'OTHER') return 'altro';

  for (const code of SORTED_CODES) {
    const re = new RegExp(`(?:^|[^0-9])${code.replace('.', '\\.')}(?:[^0-9]|$)`);
    if (re.test(raw) || upper === code.replace('.', '') || upper === code) {
      return code;
    }
  }

  const m = raw.match(/\b(\d{1,2}(?:\.\d{1,2})?)\b/);
  if (m && CODE_MAP.has(m[1])) return m[1];

  const inferred = inferMaterialGroupFromText(raw);
  return inferred;
}

/**
 * @param {string} text
 * @returns {string|null}
 */
function inferMaterialGroupFromText(text) {
  const s = String(text || '');
  for (const { pattern, code } of STEEL_DESIGNATION_HINTS) {
    if (pattern.test(s)) return code;
  }
  return null;
}

/**
 * Opzioni select { value, label } per UI.
 * @param {{ families?: MaterialFamily[], includeAltro?: boolean }} [opts]
 */
function getMaterialGroupSelectOptions(opts = {}) {
  const { families = null, includeAltro = true } = opts;
  const list = families
    ? ISO_TR_15608_GROUPS.filter((g) => families.includes(g.family))
    : ISO_TR_15608_GROUPS;

  const options = list.map((g) => ({
    value: g.code,
    label: `${g.code} — ${g.labelIt}`,
  }));

  if (includeAltro) {
    options.push({ value: 'altro', label: 'Altro / non in elenco' });
  }
  return options;
}

/**
 * Blocco compatto per prompt AI (ingest patentini, WPS, assistente saldatura).
 * @param {{ families?: MaterialFamily[], maxLines?: number }} [opts]
 */
function buildMaterialGroupPromptSection(opts = {}) {
  const { families = ['steel'], maxLines = 40 } = opts;
  const list = families
    ? ISO_TR_15608_GROUPS.filter((g) => families.includes(g.family))
    : ISO_TR_15608_GROUPS;

  const lines = list.slice(0, maxLines).map((g) => `- ${g.code}: ${g.labelEn}`);
  const more = list.length > maxLines ? `\n[... altri ${list.length - maxLines} codici nel catalogo SGQ ...]` : '';

  return `
--- GRUPPI MATERIALE ISO/TR 15608:2013 (usa SOLO codici elencati per material_group) ---
Regole:
- material_group = codice gruppo base (es. "1.2", "8.1", "21") — NON confondere con FM1-FM6 (materiale d'apporto).
- Se il certificato indica solo la designazione acciaio (es. S355, P265GH), mappa al gruppo corretto.
- Se ambiguo, null + warning nel JSON.
Codici principali:
${lines.join('\n')}${more}
--- FINE GRUPPI MATERIALE ---`.trim();
}

export {
  ISO_TR_15608_GROUPS,
  FAMILY_LABELS_IT,
  findMaterialGroup,
  normalizeMaterialGroupCode,
  inferMaterialGroupFromText,
  getMaterialGroupSelectOptions,
  buildMaterialGroupPromptSection,
};

export default {
  ISO_TR_15608_GROUPS,
  FAMILY_LABELS_IT,
  findMaterialGroup,
  normalizeMaterialGroupCode,
  inferMaterialGroupFromText,
  getMaterialGroupSelectOptions,
  buildMaterialGroupPromptSection,
};
