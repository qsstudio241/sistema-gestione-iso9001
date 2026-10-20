/**
 * Range² per la tabella passate WPS (ISO 15609-1:2019 Annex A).
 *
 * Se la passata non ha già min/max, si derivano dal valore misurato WPQR:
 *   corrente / tensione / avanzamento filo / velocità: ±10 %
 *   apporto termico / energia d'arco: −25 % / +25 % (ISO 15614-1:2017+A1:2019 §8.4.8)
 *
 * Nessun valore inventato: se manca il misurato, la cella resta vuota.
 */

export const IU_WIRE_PCT = 0.10;
export const HEAT_PCT = 0.25;

export const ANNEX_A_RANGE_NOTE =
  'Range\u00B2: corrente, tensione e avanzamento filo \u00B110 % del valore misurato WPQR; apporto termico \u221225 % / +25 % (ISO 15614-1:2017+A1:2019 \u00A78.4.8).';

export function isMag135Family(process) {
  const tokens = String(process || '').match(/\d{3}/g) || [];
  if (!tokens.length) {
    return /^\s*13[568]\s*$/.test(String(process || ''));
  }
  return tokens.some((t) => t === '135' || t === '136' || t === '138');
}

export function roundAnnexNum(n) {
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n * 100) / 100;
  return r;
}

export function formatAnnexNum(n) {
  const r = roundAnnexNum(n);
  if (r == null) return '';
  if (Number.isInteger(r)) return String(r);
  return String(r);
}

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {number|string|null} measured
 * @param {number} pct 0.10 | 0.25
 * @param {{ min?: number|string|null, max?: number|string|null }} [stored]
 * @returns {{ min: number, max: number } | null}
 */
export function rangeFromMeasured(measured, pct, stored = {}) {
  const storedMin = num(stored.min);
  const storedMax = num(stored.max);
  if (storedMin != null || storedMax != null) {
    return {
      min: storedMin != null ? storedMin : storedMax,
      max: storedMax != null ? storedMax : storedMin,
    };
  }
  const n = num(measured);
  if (n == null) return null;
  const p = Number(pct);
  if (!Number.isFinite(p) || p < 0) return { min: n, max: n };
  return {
    min: roundAnnexNum(n * (1 - p)),
    max: roundAnnexNum(n * (1 + p)),
  };
}

export function formatAnnexRange(range, unit) {
  if (!range || (range.min == null && range.max == null)) return '';
  const a = formatAnnexNum(range.min);
  const b = formatAnnexNum(range.max);
  let body = '';
  if (a && b && a === b) body = a;
  else if (a && b) body = `${a} \u2013 ${b}`;
  else body = a || b;
  if (!body) return '';
  return unit ? `${body} ${unit}` : body;
}

export function formatAnnexPair(min, max, unit) {
  return formatAnnexRange({ min: num(min), max: num(max) }, unit);
}

/**
 * Celle della riga passata Annex A (9 colonne).
 * Polarità e filo restano i valori WPQR (C6 non è ²; C7 sì).
 */
export function annexARunCells(run = {}) {
  const unitWire = run.wire_feed_unit || '';
  const unitSpeed = run.travel_speed_unit || '';
  const unitHeat = run.heat_input_unit || '';
  const fillerDia = run.filler_diameter_mm;
  const fillerDes = run.filler_designation;
  let filler = '';
  if (fillerDia != null && fillerDes) filler = `${fillerDia} mm ${fillerDes}`;
  else if (fillerDia != null) filler = `${fillerDia} mm`;
  else filler = fillerDes ? String(fillerDes) : '';

  const current = formatAnnexRange(rangeFromMeasured(run.current_a, IU_WIRE_PCT), '');
  const voltage = formatAnnexRange(rangeFromMeasured(run.voltage_v, IU_WIRE_PCT), '');
  const wire = formatAnnexRange(
    rangeFromMeasured(run.wire_feed_speed, IU_WIRE_PCT),
    unitWire
  );
  const speed = formatAnnexRange(
    rangeFromMeasured(run.travel_speed, IU_WIRE_PCT),
    unitSpeed
  );
  const heat = formatAnnexRange(
    rangeFromMeasured(run.heat_input_value, HEAT_PCT),
    unitHeat
  );

  return {
    run: run.run_label || run.run_no != null ? String(run.run_label || run.run_no) : '',
    process: run.welding_process != null ? String(run.welding_process) : '',
    filler,
    current,
    voltage,
    polarity: run.current_polarity != null ? String(run.current_polarity) : '',
    wire,
    speed,
    heat,
  };
}

export function currentRangeFromRuns(runs = []) {
  const values = (Array.isArray(runs) ? runs : [])
    .map((r) => num(r.current_a))
    .filter((n) => n != null);
  if (!values.length) return '';
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = {
    min: roundAnnexNum(lo * (1 - IU_WIRE_PCT)),
    max: roundAnnexNum(hi * (1 + IU_WIRE_PCT)),
  };
  return formatAnnexRange(range, 'A');
}
