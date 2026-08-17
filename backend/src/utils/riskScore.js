/**
 * Indicatore R = P × G sul record risks (ISO 9001 §6.1).
 * CHECK DB: 1–5. Massimo effettivo = companies.risk_pg_max (3|4|5, default 3).
 */

const PG_MIN = 1;
const PG_ABS_MAX = 5;
const DEFAULT_PG_MAX = 3;

function normalizePgMax(value) {
    const n = Number(value);
    if (n === 4 || n === 5) return n;
    return DEFAULT_PG_MAX;
}

function maxScore(pgMax) {
    const m = normalizePgMax(pgMax);
    return m * m;
}

/** Soglia high_priority: 6 su 1–3, 10 su 1–4, 16 su 1–5. */
function highPriorityThreshold(pgMax) {
    return Math.floor(maxScore(pgMax) * 2 / 3);
}

function parsePgFactor(value, fallback, pgMax) {
    const max = normalizePgMax(pgMax);
    if (value === undefined || value === null || value === '') {
        if (fallback !== undefined) return { ok: true, value: fallback };
        return { ok: false, error: `P e G sono obbligatori (interi 1-${max}).` };
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < PG_MIN || n > max) {
        return {
            ok: false,
            error: `P e G devono essere interi tra ${PG_MIN} e ${max} (ricevuto ${value}).`,
        };
    }
    return { ok: true, value: n };
}

function parseOptionalPgFactor(value, pgMax) {
    if (value === undefined || value === null || value === '') {
        return { ok: true, value: null };
    }
    return parsePgFactor(value, undefined, pgMax);
}

function riskScore(probability, impact) {
    return Number(probability) * Number(impact);
}

/** Terzi del R massimo: su 1–3 resta 1-3 basso, 4-6 medio, 7-9 alto. */
function riskScoreLevel(score, pgMax) {
    const mid = highPriorityThreshold(pgMax);
    const low = Math.floor(maxScore(pgMax) / 3);
    if (score > mid) return 'alto';
    if (score > low) return 'medio';
    return 'basso';
}

/** Residuo: o entrambi i fattori, o nessuno. Un solo valore non è un P×G. */
function normalizeResidualPair(probability, impact) {
    const empty = (v) => v == null || v === '';
    if (empty(probability) || empty(impact)) {
        return { residual_probability: null, residual_impact: null };
    }
    return { residual_probability: probability, residual_impact: impact };
}

function residualScoreFromRow(row) {
    const pair = normalizeResidualPair(row?.residual_probability, row?.residual_impact);
    if (pair.residual_probability == null || pair.residual_impact == null) return null;
    return riskScore(pair.residual_probability, pair.residual_impact);
}

const ANALYSIS_METHODS = ['pxg', 'swot_signed', 'fmea_gpr'];

function normalizeMethod(value) {
    const v = String(value || '').trim();
    return ANALYSIS_METHODS.includes(v) ? v : 'pxg';
}

function normalizeSwotQuadrant(value) {
    const v = String(value || '').trim().toUpperCase();
    return ['S', 'W', 'O', 'T'].includes(v) ? v : null;
}

function normalizeImpactSign(value) {
    return Number(value) === -1 ? -1 : 1;
}

function decorateRiskRow(row) {
    if (!row) return row;
    const pgMax = normalizePgMax(row.risk_pg_max);
    const score = riskScore(row.probability || 1, row.impact || 1);
    const residual_score = residualScoreFromRow(row);
    const analysis_method = normalizeMethod(row.analysis_method);
    const impact_sign = normalizeImpactSign(row.impact_sign);
    return {
        ...row,
        risk_pg_max: pgMax,
        analysis_method,
        swot_quadrant: normalizeSwotQuadrant(row.swot_quadrant),
        impact_sign,
        signed_impact: (row.impact || 1) * impact_sign,
        signed_score: score * impact_sign,
        score,
        score_level: riskScoreLevel(score, pgMax),
        residual_score,
        residual_score_level: residual_score == null ? null : riskScoreLevel(residual_score, pgMax),
    };
}

module.exports = {
    PG_MIN,
    PG_ABS_MAX,
    DEFAULT_PG_MAX,
    normalizePgMax,
    maxScore,
    highPriorityThreshold,
    parsePgFactor,
    parseOptionalPgFactor,
    riskScore,
    riskScoreLevel,
    normalizeResidualPair,
    residualScoreFromRow,
    decorateRiskRow,
    ANALYSIS_METHODS,
    normalizeMethod,
    normalizeSwotQuadrant,
    normalizeImpactSign,
};
