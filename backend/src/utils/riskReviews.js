'use strict';

const {
    normalizeMethod,
    normalizeSwotQuadrant,
    normalizeImpactSign,
} = require('./riskScore');

const SIGNIFICANT_FIELDS = [
    'probability',
    'impact',
    'impact_sign',
    'analysis_method',
    'swot_quadrant',
    'residual_probability',
    'residual_impact',
    'effectiveness_note',
    'current_actions',
    'further_actions',
    'nature',
];

function emptyToNull(v) {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
}

function normSignificant(field, value) {
    if (field === 'analysis_method') return normalizeMethod(value);
    if (field === 'swot_quadrant') return normalizeSwotQuadrant(value);
    if (field === 'impact_sign') return normalizeImpactSign(value);
    if (field === 'nature') return emptyToNull(value) || 'risk';
    if (
        field === 'probability'
        || field === 'impact'
        || field === 'residual_probability'
        || field === 'residual_impact'
    ) {
        if (value === undefined || value === null || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    return emptyToNull(value);
}

function isSignificantReviewChange(prev, next) {
    if (!prev || !next) return true;
    return SIGNIFICANT_FIELDS.some(
        (field) => normSignificant(field, prev[field]) !== normSignificant(field, next[field]),
    );
}

function mergeRiskReviewState(prev, patch) {
    const base = prev || {};
    const src = patch || {};
    const out = { ...base };
    Object.keys(src).forEach((key) => {
        if (src[key] !== undefined) out[key] = src[key];
    });
    return out;
}

function buildRiskReviewSnapshot(row, extras = {}) {
    return {
        risk_id: row.risk_id,
        organization_id: extras.organization_id ?? row.organization_id,
        company_id: extras.company_id !== undefined ? extras.company_id : row.company_id,
        title: emptyToNull(row.title),
        evaluated_element: emptyToNull(row.evaluated_element),
        nature: emptyToNull(row.nature) || 'risk',
        probability: normSignificant('probability', row.probability),
        impact: normSignificant('impact', row.impact),
        impact_sign: normalizeImpactSign(row.impact_sign),
        analysis_method: normalizeMethod(row.analysis_method),
        swot_quadrant: normalizeSwotQuadrant(row.swot_quadrant),
        residual_probability: normSignificant('residual_probability', row.residual_probability),
        residual_impact: normSignificant('residual_impact', row.residual_impact),
        effectiveness_note: emptyToNull(row.effectiveness_note),
        current_actions: emptyToNull(row.current_actions),
        further_actions: emptyToNull(row.further_actions),
        recorded_by: extras.recorded_by ?? row.recorded_by ?? null,
    };
}

async function insertRiskReview(pool, snapshot) {
    await pool.request()
        .input('risk_id', snapshot.risk_id)
        .input('organization_id', snapshot.organization_id)
        .input('company_id', snapshot.company_id || null)
        .input('title', snapshot.title)
        .input('evaluated_element', snapshot.evaluated_element)
        .input('nature', snapshot.nature)
        .input('probability', snapshot.probability)
        .input('impact', snapshot.impact)
        .input('impact_sign', snapshot.impact_sign)
        .input('analysis_method', snapshot.analysis_method)
        .input('swot_quadrant', snapshot.swot_quadrant)
        .input('residual_probability', snapshot.residual_probability)
        .input('residual_impact', snapshot.residual_impact)
        .input('effectiveness_note', snapshot.effectiveness_note)
        .input('current_actions', snapshot.current_actions)
        .input('further_actions', snapshot.further_actions)
        .input('recorded_by', snapshot.recorded_by)
        .query(`
            INSERT INTO risk_reviews (
                risk_id, organization_id, company_id, title, evaluated_element, nature,
                probability, impact, impact_sign, analysis_method, swot_quadrant,
                residual_probability, residual_impact, effectiveness_note,
                current_actions, further_actions, recorded_by
            ) VALUES (
                @risk_id, @organization_id, @company_id, @title, @evaluated_element, @nature,
                @probability, @impact, @impact_sign, @analysis_method, @swot_quadrant,
                @residual_probability, @residual_impact, @effectiveness_note,
                @current_actions, @further_actions, @recorded_by
            )
        `);
}

module.exports = {
    SIGNIFICANT_FIELDS,
    emptyToNull,
    isSignificantReviewChange,
    mergeRiskReviewState,
    buildRiskReviewSnapshot,
    insertRiskReview,
};
