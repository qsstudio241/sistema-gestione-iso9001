/**
 * Indicatore R = P × G sul record risks (ISO 9001 §6.1, allineato a M03).
 * Scala vincolata dal CHECK DB: P e G interi 1–3 → R in 1–9.
 * M03 ha G fino a 4 e Pagani 1–5: fuori da questa slice (ROO-13).
 */

const PG_MIN = 1;
const PG_MAX = 3;

function parsePgFactor(value, fallback) {
    if (value === undefined || value === null || value === '') {
        if (fallback !== undefined) return { ok: true, value: fallback };
        return { ok: false, error: 'P e G sono obbligatori (interi 1-3).' };
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < PG_MIN || n > PG_MAX) {
        return {
            ok: false,
            error: `P e G devono essere interi tra ${PG_MIN} e ${PG_MAX} (ricevuto ${value}). Scala M03 1-4 / FMEA 1-5 non abilitata.`,
        };
    }
    return { ok: true, value: n };
}

/** P/G residui: vuoto → null (opzionale). Stessa scala 1–3 se valorizzato. */
function parseOptionalPgFactor(value) {
    if (value === undefined || value === null || value === '') {
        return { ok: true, value: null };
    }
    return parsePgFactor(value);
}

function riskScore(probability, impact) {
    return Number(probability) * Number(impact);
}

/** Soglie UI attuali (invariate): 1-3 basso, 4-6 medio, 7-9 alto. */
function riskScoreLevel(score) {
    if (score >= 7) return 'alto';
    if (score >= 4) return 'medio';
    return 'basso';
}

function residualScoreFromRow(row) {
    const p = row?.residual_probability;
    const g = row?.residual_impact;
    if (p == null || g == null || p === '' || g === '') return null;
    return riskScore(p, g);
}

function decorateRiskRow(row) {
    if (!row) return row;
    const score = riskScore(row.probability || 1, row.impact || 1);
    const residual_score = residualScoreFromRow(row);
    return {
        ...row,
        score,
        score_level: riskScoreLevel(score),
        residual_score,
        residual_score_level: residual_score == null ? null : riskScoreLevel(residual_score),
    };
}

module.exports = {
    PG_MIN,
    PG_MAX,
    parsePgFactor,
    parseOptionalPgFactor,
    riskScore,
    riskScoreLevel,
    residualScoreFromRow,
    decorateRiskRow,
};
