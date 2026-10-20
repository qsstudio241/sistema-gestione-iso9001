'use strict';

/**
 * Range² passate WPS (ISO 15609-1 Annex A) — copia CJS del helper FE.
 * ±10 % I/U/filo/velocità di avanzamento; −25 % / +25 % apporto termico (ISO 15614-1 §8.4.8).
 */

const IU_WIRE_PCT = 0.10;
const HEAT_PCT = 0.25;

function num(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function roundAnnexNum(n) {
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100) / 100;
}

function formatAnnexNum(n) {
    const r = roundAnnexNum(n);
    if (r == null) return '';
    if (Number.isInteger(r)) return String(r);
    return String(r);
}

function formatAnnexRange(range, unit) {
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

function currentRangeFromRuns(runs = []) {
    const values = (Array.isArray(runs) ? runs : [])
        .map((r) => num(r.current_a))
        .filter((n) => n != null);
    if (!values.length) return '';
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    return formatAnnexRange({
        min: roundAnnexNum(lo * (1 - IU_WIRE_PCT)),
        max: roundAnnexNum(hi * (1 + IU_WIRE_PCT)),
    }, 'A');
}

function voltageRangeFromRuns(runs = []) {
    const values = (Array.isArray(runs) ? runs : [])
        .map((r) => num(r.voltage_v))
        .filter((n) => n != null);
    if (!values.length) return '';
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    return formatAnnexRange({
        min: roundAnnexNum(lo * (1 - IU_WIRE_PCT)),
        max: roundAnnexNum(hi * (1 + IU_WIRE_PCT)),
    }, 'V');
}

module.exports = {
    IU_WIRE_PCT,
    HEAT_PCT,
    currentRangeFromRuns,
    voltageRangeFromRuns,
    formatAnnexRange,
    roundAnnexNum,
};
