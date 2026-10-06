/**
 * cnd9712.adapter.js — Dominio CND / ISO 9712 (match read-only).
 *
 * COV-1: metodo (+ livello opzionale) + non scaduta.
 * COV-3: settore (Annex A), schema di certificazione (§9.4), tecnica (scope_detail)
 * e idoneita' visiva in corso di validita' (riuso visionStateForPerson del gate CND-2:
 * HITL 23/08/2026, ISO 9712 §7.4.2 e §9.3.1).
 *
 * Nessuna regola inventata: lo scope dei settori industriali (m r a, e s/m verso w)
 * e' definito dall'ente di certificazione (Annex A.3) => `partial`; schema e tecnica
 * sono testo libero => mai `no_match`.
 */

'use strict';

const { isQualificationOperationallyActive } = require('../../weldingCoordinatorAuth.service');
const { visionStateForPerson } = require('../../ndtInspectorGate.service');
const { isVisionFitnessType, visionFitnessSqlInList } = require('../../../constants/occupationalQualificationTypes');
const { COVERAGE_DOMAINS, MATCH_STATUS } = require('../coverageTypes');

const NO_NDT_MESSAGE = 'Nessuna qualifica NDT (ISO 9712) registrata per l\'ambito selezionato: nulla da confrontare con il requisito.';

const PRODUCT_SECTORS = new Set(['c', 'f', 'w', 't', 'wp', 'p']);
const INDUSTRIAL_SECTORS = new Set(['m', 's', 'r', 'a']);

const SECTOR_OPTIONS = [
    { value: 'c', label: 'c \u2014 getti' },
    { value: 'f', label: 'f \u2014 forgiati' },
    { value: 'w', label: 'w \u2014 saldature' },
    { value: 't', label: 't \u2014 tubi' },
    { value: 'wp', label: 'wp \u2014 laminati' },
    { value: 'p', label: 'p \u2014 compositi' },
    { value: 'm', label: 'm \u2014 fabbricazione (industriale)' },
    { value: 's', label: 's \u2014 pre-servizio e in servizio (industriale)' },
    { value: 'r', label: 'r \u2014 manutenzione ferroviaria (industriale)' },
    { value: 'a', label: 'a \u2014 aerospaziale (industriale)' },
];

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
        hint: 'Opzionale: livello minimo richiesto',
    },
    {
        key: 'ndt_sector',
        label: 'Settore',
        type: 'select',
        options: SECTOR_OPTIONS,
        hint: 'Opzionale. Settore industriale posseduto vs settore di prodotto richiesto: verificare lo scope pubblicato dall\'ente (Annex A.3)',
    },
    {
        key: 'certification_scheme',
        label: 'Schema di certificazione',
        type: 'text',
        hint: 'Opzionale. Es. CICPND, PCN, TEC Eurolab \u2014 confronto testuale, schema diverso = parziale (\u00a79.4)',
    },
    {
        key: 'scope_detail',
        label: 'Tecnica',
        type: 'text',
        hint: 'Opzionale. Es. PA, TOFD, DR \u2014 confrontata con lo scope riportato sul certificato',
    },
];

const STATUS_ORDER = {
    [MATCH_STATUS.MATCH]: 0,
    [MATCH_STATUS.PARTIAL]: 1,
    [MATCH_STATUS.NO_MATCH]: 2,
};

function norm(value) {
    return String(value == null ? '' : value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function tokens(value) {
    return norm(value).split(/[\s,;/]+/).filter(Boolean);
}

function evalSector(reqRaw, qualRaw) {
    const req = norm(reqRaw);
    if (!req) return { result: 'skipped' };
    const have = new Set(tokens(qualRaw).filter((t) => PRODUCT_SECTORS.has(t) || INDUSTRIAL_SECTORS.has(t)));
    if (!norm(qualRaw)) {
        return { result: 'unverifiable', reason: 'Settore assente in anagrafica' };
    }
    if (have.size === 0) {
        return { result: 'unverifiable', reason: `Settore "${String(qualRaw).trim()}" non riconosciuto: verificare sul certificato` };
    }
    if (have.has(req)) return { result: 'ok' };
    if (req === 'm' && have.has('s')) return { result: 'ok' };
    if (!PRODUCT_SECTORS.has(req) && !INDUSTRIAL_SECTORS.has(req)) {
        return { result: 'unverifiable', reason: `Settore richiesto "${req}" non riconosciuto` };
    }
    const haveIndustrial = [...have].some((t) => INDUSTRIAL_SECTORS.has(t));
    if (PRODUCT_SECTORS.has(req) && haveIndustrial) {
        return {
            result: 'unverifiable',
            reason: `Settore industriale (${[...have].join(', ')}) vs settore di prodotto ${req}: scope definito dall'ente (A.3), verificare sul certificato`,
        };
    }
    return { result: 'mismatch', reason: `Settore ${[...have].join(', ')} non copre ${req}` };
}

function evalScheme(reqRaw, qualRaw) {
    const req = norm(reqRaw);
    if (!req) return { result: 'skipped' };
    const have = norm(qualRaw);
    if (!have) return { result: 'unverifiable', reason: 'Schema di certificazione assente in anagrafica' };
    if (have === req) return { result: 'ok' };
    return {
        result: 'unverifiable',
        reason: `Schema diverso (${String(qualRaw).trim()} vs ${String(reqRaw).trim()}): verificare accettazione/riconoscimento (\u00a79.4)`,
    };
}

function evalTechnique(reqRaw, qualRaw) {
    const req = [...new Set(tokens(reqRaw))];
    if (req.length === 0) return { result: 'skipped' };
    const have = new Set(tokens(qualRaw));
    if (have.size === 0) return { result: 'unverifiable', reason: 'Tecnica/scope assente in anagrafica: verificare sul certificato' };
    const missing = req.filter((t) => !have.has(t));
    if (missing.length === 0) return { result: 'ok' };
    return {
        result: 'unverifiable',
        reason: `Tecnica ${missing.join(', ')} non riportata nello scope del certificato: verificare`,
    };
}

function formatIso(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}


/**
 * Match puro (no DB) — esportato per test.
 * Senza `opts.visionRows` l'idoneita' visiva non viene valutata (`skipped`, contratto COV-1).
 * @param {object} qual
 * @param {object} criteria
 * @param {{ todayIso?: string, visionRows?: object[] }} [opts]
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

    const extra = [
        ['ndt_sector', evalSector(criteria.ndt_sector, qual.ndt_sector)],
        ['certification_scheme', evalScheme(criteria.certification_scheme, qual.certification_scheme)],
        ['scope_detail', evalTechnique(criteria.scope_detail, qual.scope_detail)],
    ];
    for (const [key, ev] of extra) {
        detail[key] = ev.result;
        if (ev.reason) reasons.push(ev.reason);
    }

    let visionSummary = null;
    if (Array.isArray(opts.visionRows)) {
        const todayIso = opts.todayIso || new Date().toISOString().slice(0, 10);
        const vision = visionStateForPerson(
            opts.visionRows,
            qual.person_name,
            qual.personnel_id,
            qual.company_id,
            new Date(`${todayIso}T00:00:00`),
        );
        visionSummary = vision;
        if (vision.state === 'ok') {
            detail.vision = 'ok';
            if (!vision.expiry_date) detail.vision_note = 'senza_scadenza';
        } else if (vision.state === 'expired') {
            detail.vision = 'mismatch';
            reasons.push(`Idoneit\u00e0 visiva scaduta il ${formatIso(vision.expiry_date) || 'data sconosciuta'}`);
        } else {
            detail.vision = 'mismatch';
            reasons.push('Idoneit\u00e0 visiva assente: certificato non supportato da verifica vista corrente (\u00a79.3.1)');
        }
    } else {
        detail.vision = 'skipped';
    }

    const dims = [
        detail.ndt_method,
        detail.ndt_level,
        detail.ndt_sector,
        detail.certification_scheme,
        detail.scope_detail,
        detail.vision,
    ].filter((r) => r && r !== 'skipped');
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
        capability: summarize(qual, visionSummary),
    };
}

function summarize(qual, vision) {
    return {
        id: qual.id,
        person_name: qual.person_name,
        ndt_method: qual.ndt_method,
        ndt_level: qual.ndt_level,
        ndt_sector: qual.ndt_sector || null,
        certification_scheme: qual.certification_scheme || null,
        scope_detail: qual.scope_detail || null,
        certificate_number: qual.certificate_number || null,
        vision_state: vision ? vision.state : null,
        vision_expiry_date: vision ? formatIso(vision.expiry_date) : null,
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
        SELECT q.id, q.person_name, q.personnel_id, q.person_code, q.qualification_type,
               q.ndt_method, q.ndt_level, q.ndt_sector, q.certification_scheme,
               q.scope_detail, q.certificate_number, q.expiry_date, q.next_confirmation_due,
               q.status, q.company_id, c.name AS company_name
        FROM qualifications q
        LEFT JOIN companies c ON c.id = q.company_id
        WHERE ${where}
        ORDER BY q.person_name
    `);
    const ndtQuals = (qRes.recordset || []).filter((q) => !isVisionFitnessType(q.qualification_type));
    if (ndtQuals.length === 0) return [];

    const vReq = pool.request().input('orgId', orgId);
    let vWhere = `
        q.organization_id = @orgId
        AND q.status NOT IN ('revocata','sospesa')
        AND q.qualification_type IN (${visionFitnessSqlInList()})
    `;
    if (companyId) {
        vReq.input('compId', Number(companyId));
        vWhere += ' AND q.company_id = @compId';
    }
    const vRes = await vReq.query(`
        SELECT q.id, q.person_name, q.personnel_id, q.qualification_type,
               q.expiry_date, q.status, q.company_id
        FROM qualifications q
        WHERE ${vWhere}
    `);
    const visionRows = vRes.recordset || [];

    return ndtQuals
        .map((q) => matchCndCapability(q, req.criteria || {}, { todayIso: ctx.todayIso, visionRows }))
        .map((m, idx) => ({ m, idx }))
        .sort((x, y) => (STATUS_ORDER[x.m.status] - STATUS_ORDER[y.m.status]) || (x.idx - y.idx))
        .map(({ m }) => m);
}

const cnd9712Adapter = {
    domain: COVERAGE_DOMAINS.CND_9712,
    label: 'Personale CND (ISO 9712)',
    standard: 'ISO 9712',
    implemented: true,
    maturity: 'full',
    requirementFields: REQUIREMENT_FIELDS,
    emptyMessage: NO_NDT_MESSAGE,
    match,
    matchCndCapability,
};

module.exports = cnd9712Adapter;
