/**
 * ISO 13916:2025 — regole temperature saldatura (Tp/Ti/Tm) per prompt ingest.
 * Non è un catalogo di simboli discreti (diverso da ISO 14175 gas).
 * Mirror: app/src/data/weldingTemperatures13916.js
 * Estratto: docs/reference/ISO-13916-temperature-saldatura.md
 */

/** @type {Record<string, string>} */
const TEMPERATURE_SYMBOLS = {
  Tp: 'preheating temperature (minimo tipico, subito prima della saldatura)',
  Ti: 'interpass temperature (massimo tipico, prima della passata successiva)',
  Tm: 'preheat maintenance temperature (minimo da mantenere se saldatura interrotta)',
};

/** @type {Record<string, string>} */
const EQUIPMENT_CODES = {
  TS: 'temperature sensitive materials (crayons/paints)',
  CT: 'contact thermometer',
  TE: 'thermocouple',
  TB: 'optical/electrical contactless measurement',
};

/**
 * Sezione prompt AI per WPS/WPQR (campi preheat_temp / interpass_temp).
 * @returns {string}
 */
function buildWeldingTemperaturePromptSection() {
  const symbols = Object.entries(TEMPERATURE_SYMBOLS)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  const equipment = Object.entries(EQUIPMENT_CODES)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return `
--- TEMPERATURE SALDATURA ISO 13916 (preheat_temp / interpass_temp) ---
Simboli norma:
${symbols}
Attrezzatura (se citata in designazione, es. "— CT"):
${equipment}
Regole estrazione:
- preheat_temp ← Tp (preriscaldo). Esempio designazione: "Temperature ISO 13916:2025 Tp 155 — CT" → "155 °C" (o "155").
- interpass_temp ← Ti. Range multi-rilievo "Ti 130/160" → "130/160 °C" o "max 160 °C" se il documento usa max.
- Tm (mantenimento): non c'è campo dedicato; se presente, warning o nota, non confondere con Tp/Ti.
- Non usare questi campi per PWHT (post weld heat treatment).
- Unità default °C; se °F, segnalare in warnings.
--- FINE TEMPERATURE ISO 13916 ---`.trim();
}

module.exports = {
  TEMPERATURE_SYMBOLS,
  EQUIPMENT_CODES,
  buildWeldingTemperaturePromptSection,
};
