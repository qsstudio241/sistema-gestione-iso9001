/**
 * cnd9712.adapter.js — Dominio CND / ISO 9712 (hook + match minimo read-only).
 *
 * COV-1: metodo (+ livello opzionale) + non scaduta.
 * Settore industriale / schema / visione = COV-3.
 */

'use strict';

const { isQualificationOperationallyActive } = require('../../weldingCoordinatorAuth.service');
const { COVERAGE_DOMAINS, MATCH_STATUS } = require('../coverageTypes');

const REQUIREMENT_FIELDS = [
    {
        key: 'ndt_method',
        label: 'Metodo NDT',
        type: 'select',
        required: true,
        options: [
            { value: 'VT', label: 'VT' },
            { value: 'PT', label: 'PT' },
            { value: 'MT', label: 'MT' },
            { value: 'UT', label: 'UT' },
            { value: 'RT', label: 'RT' },
            { value: 'ET', label: 'ET' },
        ],
    },
    {
        key: 'ndt_level',
        label: 'Livello',
        type: 'select',
        options: [
            { value: '1', label: '1' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
        ],
        hint: 'Opzionale in COV-1; settore/schema in COV-3',
    },
];

/**
 * Match puro (no DB) — esportato per test.
 * @param {object} qual
 * @param {object} criteria
 * @param {{ todayIso?: string }} [opts]
 */
function matchCndCapability(qual, criteria = {}, opts = {}) {
    const reasons = [];
    const detail = {};

    if (!isQualificationOperationallyActive(qual, opts.todayIso)) {
        return {
            domain: COVERAGE_DOMAINS.CND_9712,
            capability_id: qual.id ?? null,
            status: MATCH_STATUS.NO_MATCH,
            reasons: ['Qualifica NDT non operativa (scaduta o sospesa/revocata)'],
            detail: { operational: 'mismatch' },
            capability: summarize(qual),
        };
    }
    detail.operational = 'ok';

    const reqMethod = criteria.ndt_method ? String(criteria.ndt_method).toUpperCase().trim() : '';
    const qualMethod = qual.ndt_method ? String(qual.ndt_method).toUpperCase().trim() : '';

    if (!reqMethod) {
        detail.ndt_method = 'unverifiable';
        reasons.push('Metodo NDT richiesto assente');
    } else if (!qualMethod) {
        detail.ndt_method = 'unverifiable';
        reasons.push('Metodo NDT assente in anagrafica');
    } else if (qualMethod !== reqMethod) {
        detail.ndt_method = 'mismatch';
        reasons.push(`Metodo ${qualMethod} non copre ${reqMethod}`);
    } else {
        detail.ndt_method = 'ok';
    }

    const reqLevel = criteria.ndt_level != null && criteria.ndt_level !== ''
        ? Number(criteria.ndt_level)
        : null;
    if (reqLevel != null && Number.isFinite(reqLevel)) {
        const qLevel = qual.ndt_level != null ? Number(qual.ndt_level) : null;
        if (qLevel == null) {
            detail.ndt_level = 'unverifiable';
            reasons.push('Livello NDT assente in anagrafica');
        } else if (qLevel < reqLevel) {
            detail.ndt_level = 'mismatch';
            reasons.push(`Livello ${qLevel} inferiore al richiesto ${reqLevel}`);
        } else {
            detail.ndt_level = 'ok';
        }
    } else {
        detail.ndt_level = 'skipped';
    }

    const dims = [detail.ndt_method, detail.ndt_level].filter((r) => r && r !== 'skipped');
    const hasFail = dims.some((r) => r === 'mismatch');
    const hasUnver = dims.some((r) => r === 'unverifiable');

    let status;
    if (hasFail) status = MATCH_STATUS.NO_MATCH;
    else if (hasUnver) status = MATCH_STATUS.PARTIAL;
    else status = MATCH_STATUS.MATCH;

    return {
        domain: COVERAGE_DOMAINS.CND_9712,
        capability_id: qual.id ?? null,
        status,
        reasons,
        detail,
        capability: summarize(qual),
    };
}

function summarize(qual) {
    return {
        id: qual.id,
        person_name: qual.person_name,
        ndt_method: qual.ndt_method,
        ndt_level: qual.ndt_level,
        company_name: qual.company_name || null,
    };
}

/**
 * @param {import('../coverageTypes').Requirement} req
 * @param {import('../coverageTypes').MatchContext} ctx
 */
async function match(req, ctx) {
    const pool = ctx.pool;
    if (!pool) {
        throw new Error('cnd_9712: pool SQL richiesto nel MatchContext');
    }
    const orgId = ctx.organizationId;
    const companyId = req.company_id != null ? req.company_id : ctx.companyId;
    const qReq = pool.request().input('orgId', orgId);
    let where = `
        q.organization_id = @orgId
        AND q.status NOT IN ('revocata','sospesa')
        AND (
            q.qualification_type LIKE '%9712%'
            OR q.qualification_type LIKE '%NDT%'
            OR q.ndt_method IS NOT NULL
        )
    `;
    if (companyId) {
        qReq.input('compId', Number(companyId));
        where += ' AND q.company_id = @compId';
    }
    const qRes = await qReq.query(`
        SELECT q.id, q.person_name, q.person_code, q.qualification_type,
               q.ndt_method, q.ndt_level, q.expiry_date, q.next_confirmation_due,
               q.status, q.company_id, c.name AS company_name
        FROM qualifications q
        LEFT JOIN companies c ON c.id = q.company_id
        WHERE ${where}
        ORDER BY q.person_name
    `);
    return (qRes.recordset || []).map((q) =>
        matchCndCapability(q, req.criteria || {}, { todayIso: ctx.todayIso })
    );
}

const cnd9712Adapter = {
    domain: COVERAGE_DOMAINS.CND_9712,
    label: 'Personale CND (ISO 9712)',
    standard: 'ISO 9712',
    // Match minimo read-only; settore/schema/visione = COV-3
    implemented: true,
    maturity: 'minimal',
    requirementFields: REQUIREMENT_FIELDS,
    match,
    matchCndCapability,
};

module.exports = cnd9712Adapter;
