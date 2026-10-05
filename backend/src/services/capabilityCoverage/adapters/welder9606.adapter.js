/**
 * welder9606.adapter.js — Dominio copertura saldatori ISO 9606 (colonna validità).
 *
 * Dimensioni di match (non dati di prova del patentino):
 *   processo (welding_processes_validity), FW/BW, P/T, spessore, posizioni,
 *   Ø tubo (se T), non scaduta / conferma semestrale attiva.
 *
 * Riusa checkThickness / checkPositions / normalizeGroupList da qualificationCoverage.
 */

'use strict';

const {
    checkThickness,
    checkPositions,
    normalizeGroupList,
} = require('../../../utils/qualificationCoverage');
const { isQualificationOperationallyActive } = require('../../weldingCoordinatorAuth.service');
const { COVERAGE_DOMAINS, MATCH_STATUS } = require('../coverageTypes');
const { isPipeDiameterApplicable } = require('../../../data/jointTypeProfiles');

const REQUIREMENT_FIELDS = [
    {
        key: 'welding_process',
        label: 'Processo (validit\u00e0)',
        type: 'text',
        required: true,
        hint: 'Es. 135, 111 — confrontato con welding_processes_validity',
    },
    {
        key: 'joint_type',
        label: 'Tipo giunto',
        type: 'select',
        options: [
            { value: 'BW', label: 'BW — testa a testa' },
            { value: 'FW', label: 'FW — angolare' },
        ],
        hint: 'Campo di validit\u00e0 FW/BW',
    },
    {
        key: 'product_type',
        label: 'Tipo prodotto',
        type: 'select',
        options: [
            { value: 'P', label: 'P — piastra' },
            { value: 'T', label: 'T — tubo' },
        ],
    },
    {
        key: 'thickness_min_mm',
        label: 'Spessore min (mm)',
        type: 'number',
    },
    {
        key: 'thickness_max_mm',
        label: 'Spessore max (mm)',
        type: 'number',
    },
    {
        key: 'positions',
        label: 'Posizioni',
        type: 'text',
        hint: 'Es. PA, PF — sottoinsieme delle posizioni qualificate',
    },
    {
        key: 'pipe_diameter_mm',
        label: 'Diametro tubo (mm)',
        type: 'number',
        hint: 'Solo se tipo prodotto T (o requisito tubo)',
    },
];

/**
 * Processo: preferisce welding_processes_validity, fallback welding_process.
 * @returns {'ok'|'mismatch'|'unverifiable'}
 */
function checkProcessValidity(qual, reqProcess) {
    if (!reqProcess || String(reqProcess).trim() === '') return 'ok';
    const source = qual.welding_processes_validity || qual.welding_process;
    if (!source || String(source).trim() === '') return 'unverifiable';
    const tokens = normalizeGroupList(source);
    const r = String(reqProcess).toUpperCase().trim();
    const hit = tokens.some((t) => t === r || t.includes(r) || r.includes(t));
    return hit ? 'ok' : 'mismatch';
}

/**
 * FW/BW exact (case-insensitive).
 * @returns {'ok'|'mismatch'|'unverifiable'}
 */
function checkJointType(qualJoint, reqJoint) {
    if (!reqJoint || String(reqJoint).trim() === '') return 'ok';
    if (!qualJoint || String(qualJoint).trim() === '') return 'unverifiable';
    return String(qualJoint).toUpperCase().trim() === String(reqJoint).toUpperCase().trim()
        ? 'ok'
        : 'mismatch';
}

/**
 * Product type: T copre T e P; P copre solo P (ISO 9606-1 product type plate/pipe).
 * @returns {'ok'|'mismatch'|'unverifiable'}
 */
function checkProductType(qualPt, reqPt) {
    if (!reqPt || String(reqPt).trim() === '') return 'ok';
    if (!qualPt || String(qualPt).trim() === '') return 'unverifiable';
    const q = String(qualPt).toUpperCase().trim();
    const r = String(reqPt).toUpperCase().trim();
    if (q === r) return 'ok';
    if (q === 'T' && r === 'P') return 'ok'; // tubo → piastra tipicamente coperto
    return 'mismatch';
}

/**
 * Diametro tubo: vincolante solo se il requisito lo specifica.
 * Qualifica P (solo piastra) → mismatch se si richiede Ø.
 * @returns {'ok'|'out_of_range'|'mismatch'|'unverifiable'|'skipped'}
 */
function checkPipeDiameter(qual, reqDiameterMm) {
    if (reqDiameterMm == null || reqDiameterMm === '') return 'skipped';
    if (!isPipeDiameterApplicable(qual.product_type)) return 'mismatch';
    const qMin = qual.pipe_diameter_min_mm != null ? Number(qual.pipe_diameter_min_mm) : null;
    const qMax = qual.pipe_diameter_max_mm != null ? Number(qual.pipe_diameter_max_mm) : null;
    if (qMin == null && qMax == null) return 'unverifiable';
    const d = Number(reqDiameterMm);
    if (!Number.isFinite(d)) return 'unverifiable';
    if (qMin != null && d < qMin) return 'out_of_range';
    if (qMax != null && d > qMax) return 'out_of_range';
    return 'ok';
}

/**
 * Match puro riga qualifica ↔ criteri requisito (no DB).
 * @param {object} qual
 * @param {object} criteria
 * @param {{ todayIso?: string }} [opts]
 * @returns {import('../coverageTypes').CapabilityMatch}
 */
function matchWelderCapability(qual, criteria = {}, opts = {}) {
    const reasons = [];
    const detail = {};

    if (!isQualificationOperationallyActive(qual, opts.todayIso)) {
        return {
            domain: COVERAGE_DOMAINS.WELDER_9606,
            capability_id: qual.id ?? null,
            status: MATCH_STATUS.NO_MATCH,
            reasons: ['Qualifica non operativa (scaduta, sospesa/revocata o conferma semestrale scaduta)'],
            detail: { operational: 'mismatch' },
            capability: summarizeQual(qual),
        };
    }
    detail.operational = 'ok';

    const processR = checkProcessValidity(qual, criteria.welding_process);
    detail.process = processR;
    if (processR === 'mismatch') reasons.push('Processo fuori validit\u00e0');
    if (processR === 'unverifiable') reasons.push('Processo di validit\u00e0 assente in anagrafica');

    const jointR = checkJointType(qual.joint_type, criteria.joint_type);
    detail.joint_type = jointR;
    if (jointR === 'mismatch') reasons.push('Tipo giunto (FW/BW) non coperto');
    if (jointR === 'unverifiable') reasons.push('Tipo giunto assente in anagrafica');

    const productR = checkProductType(qual.product_type, criteria.product_type);
    detail.product_type = productR;
    if (productR === 'mismatch') reasons.push('Tipo prodotto (P/T) non coperto');
    if (productR === 'unverifiable') reasons.push('Tipo prodotto assente in anagrafica');

    const thickUnlimited = qual.thickness_max_unlimited === true
        || qual.thickness_max_unlimited === 1
        || qual.thickness_max_unlimited === '1';
    const thickR = checkThickness(
        qual.thickness_min_mm,
        qual.thickness_max_mm,
        criteria.thickness_min_mm != null ? Number(criteria.thickness_min_mm) : null,
        criteria.thickness_max_mm != null ? Number(criteria.thickness_max_mm) : null,
        thickUnlimited
    );
    detail.thickness = thickR;
    if (thickR === 'out_of_range') reasons.push('Spessore fuori range di validit\u00e0');
    if (thickR === 'unverifiable') reasons.push('Range spessore di validit\u00e0 incompleto');

    const posR = checkPositions(qual.position_range, criteria.positions);
    detail.positions = posR;
    if (posR === 'mismatch') reasons.push('Posizioni non coperte');
    if (posR === 'unverifiable') reasons.push('Posizioni di validit\u00e0 assenti');

    const pipeR = checkPipeDiameter(qual, criteria.pipe_diameter_mm);
    detail.pipe_diameter = pipeR;
    if (pipeR === 'out_of_range' || pipeR === 'mismatch') {
        reasons.push('Diametro tubo fuori validit\u00e0');
    }
    if (pipeR === 'unverifiable') reasons.push('Diametro tubo di validit\u00e0 incompleto');

    const dims = [processR, jointR, productR, thickR, posR, pipeR]
        .filter((r) => r && r !== 'skipped');
    const hasFail = dims.some((r) => r === 'mismatch' || r === 'out_of_range');
    const hasUnver = dims.some((r) => r === 'unverifiable');

    let status;
    if (hasFail) status = MATCH_STATUS.NO_MATCH;
    else if (hasUnver) status = MATCH_STATUS.PARTIAL;
    else status = MATCH_STATUS.MATCH;

    return {
        domain: COVERAGE_DOMAINS.WELDER_9606,
        capability_id: qual.id ?? null,
        status,
        reasons,
        detail,
        capability: summarizeQual(qual),
    };
}

function summarizeQual(qual) {
    return {
        id: qual.id,
        person_name: qual.person_name,
        person_code: qual.person_code,
        certificate_number: qual.certificate_number,
        welding_processes_validity: qual.welding_processes_validity || qual.welding_process,
        joint_type: qual.joint_type,
        product_type: qual.product_type,
        thickness_min_mm: qual.thickness_min_mm,
        thickness_max_mm: qual.thickness_max_mm,
        position_range: qual.position_range,
        company_name: qual.company_name || null,
    };
}

const SELECT_COLS = `
    q.id, q.person_name, q.person_code, q.qualification_type, q.certificate_number,
    q.welding_process, q.welding_processes_validity, q.joint_type, q.product_type,
    q.material_group, q.position_range,
    q.thickness_min_mm, q.thickness_max_mm, q.thickness_max_unlimited, q.thickness_range,
    q.pipe_diameter_min_mm, q.pipe_diameter_max_mm, q.pipe_diameter,
    q.expiry_date, q.next_confirmation_due, q.status, q.company_id,
    c.name AS company_name
`;

/**
 * @param {import('../coverageTypes').Requirement} req
 * @param {import('../coverageTypes').MatchContext} ctx
 * @returns {Promise<import('../coverageTypes').CapabilityMatch[]>}
 */
async function match(req, ctx) {
    const pool = ctx.pool;
    if (!pool) {
        throw new Error('welder_9606: pool SQL richiesto nel MatchContext');
    }
    const orgId = ctx.organizationId;
    const companyId = req.company_id != null ? req.company_id : ctx.companyId;
    const qReq = pool.request().input('orgId', orgId);
    let where = `
        q.organization_id = @orgId
        AND q.status NOT IN ('revocata','sospesa')
        AND (q.qualification_type LIKE '%9606%' OR q.qualification_type LIKE '%14732%')
    `;
    if (companyId) {
        qReq.input('compId', Number(companyId));
        where += ' AND q.company_id = @compId';
    }
    const qRes = await qReq.query(`
        SELECT ${SELECT_COLS}
        FROM qualifications q
        LEFT JOIN companies c ON c.id = q.company_id
        WHERE ${where}
        ORDER BY q.person_name
    `);
    const rows = qRes.recordset || [];
    const criteria = req.criteria || {};
    return rows.map((q) => matchWelderCapability(q, criteria, { todayIso: ctx.todayIso }));
}

const welder9606Adapter = {
    domain: COVERAGE_DOMAINS.WELDER_9606,
    label: 'Qualifiche saldatori (ISO 9606)',
    standard: 'ISO 9606',
    implemented: true,
    requirementFields: REQUIREMENT_FIELDS,
    match,
    // esposti per test unitari puri
    matchWelderCapability,
    checkProcessValidity,
    checkJointType,
    checkProductType,
    checkPipeDiameter,
};

module.exports = welder9606Adapter;
