/**
 * Ricerca unificata studio/azienda  FTS/LIKE su entit SGQ (Fase C1).
 * Filtro tenant obbligatorio; companyId opzionale con match rigido (no OR NULL).
 */

const { query } = require('../config/database');
const { studioScopeClause } = require('./auditListRbac.service');

const ALL_ENTITY_TYPES = [
    'non_conformity',
    'document',
    'audit',
    'complaint',
    'risk',
    'qualification',
];

const ENTITY_TYPE_ALIASES = {
    nc: 'non_conformity',
    non_conformity: 'non_conformity',
    document: 'document',
    documents: 'document',
    audit: 'audit',
    audits: 'audit',
    complaint: 'complaint',
    complaints: 'complaint',
    risk: 'risk',
    risks: 'risk',
    qualification: 'qualification',
    qualifications: 'qualification',
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

function normalizeEntityTypes(raw) {
    if (!raw) return [...ALL_ENTITY_TYPES];
    const list = Array.isArray(raw) ? raw : String(raw).split(',');
    const normalized = [];
    for (const item of list) {
        const key = String(item || '').trim().toLowerCase();
        if (!key) continue;
        const mapped = ENTITY_TYPE_ALIASES[key];
        if (mapped && !normalized.includes(mapped)) {
            normalized.push(mapped);
        }
    }
    return normalized.length > 0 ? normalized : [...ALL_ENTITY_TYPES];
}

function clampLimit(limit) {
    const n = parseInt(limit, 10);
    if (Number.isNaN(n) || n < 1) return DEFAULT_LIMIT;
    return Math.min(n, MAX_LIMIT);
}

function truncate(text, maxLen = 140) {
    if (!text) return '';
    const s = String(text).replace(/\s+/g, ' ').trim();
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen - 1)}\u2026`;
}

function appendRigidCompanyFilter(conditions, params, companyId, columnExpr) {
    if (companyId == null) return;
    conditions.push(`${columnExpr} = @company_id`);
    params.company_id = companyId;
}

function appendAuditStudioScope(conditions, params, reqUser) {
    const scope = studioScopeClause(reqUser, 'a');
    if (scope.clause) {
        conditions.push(scope.clause);
        Object.assign(params, scope.params);
    }
}

async function searchNonConformities({ organizationId, reqUser, pattern, companyId, limit }) {
    const conditions = [
        'a.organization_id = @organization_id',
        'a.is_deleted = 0',
        `(
            nc.nc_number LIKE @pattern
            OR nc.description LIKE @pattern
            OR nc.root_cause LIKE @pattern
            OR nc.section_code LIKE @pattern
            OR nc.corrective_action LIKE @pattern
        )`,
    ];
    const params = { organization_id: organizationId, pattern, limit };
    appendAuditStudioScope(conditions, params, reqUser);
    appendRigidCompanyFilter(conditions, params, companyId, 'a.company_id');

    const result = await query(`
        SELECT TOP (@limit)
            nc.nc_id AS id,
            nc.nc_uuid,
            nc.nc_number,
            nc.description,
            nc.status,
            nc.severity,
            a.company_id,
            c.name AS company_name
        FROM non_conformities nc
        INNER JOIN audits a ON nc.audit_id = a.audit_id
        LEFT JOIN companies c ON a.company_id = c.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY nc.updated_at DESC, nc.nc_id DESC
    `, params);

    return (result.recordset || []).map((row) => ({
        entityType: 'non_conformity',
        id: row.id,
        uuid: row.nc_uuid || null,
        title: row.nc_number || `NC #${row.id}`,
        snippet: truncate(row.description),
        status: row.status || null,
        companyId: row.company_id ?? null,
        companyName: row.company_name || null,
    }));
}

async function searchDocuments({ organizationId, pattern, companyId, limit }) {
    const conditions = [
        'dr.organization_id = @organization_id',
        "dr.status <> 'obsoleto'",
        '(dr.title LIKE @pattern OR dr.doc_code LIKE @pattern OR dr.notes LIKE @pattern)',
    ];
    const params = { organization_id: organizationId, pattern, limit };
    appendRigidCompanyFilter(conditions, params, companyId, 'dr.company_id');

    const result = await query(`
        SELECT TOP (@limit)
            dr.id,
            dr.title,
            dr.doc_code,
            dr.doc_type,
            dr.status,
            dr.company_id,
            c.name AS company_name
        FROM document_registry dr
        LEFT JOIN companies c ON dr.company_id = c.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY dr.updated_at DESC, dr.id DESC
    `, params);

    return (result.recordset || []).map((row) => ({
        entityType: 'document',
        id: row.id,
        title: row.doc_code ? `${row.doc_code}  ${row.title}` : row.title,
        snippet: truncate(row.title),
        status: row.status || null,
        docType: row.doc_type || null,
        companyId: row.company_id ?? null,
        companyName: row.company_name || null,
    }));
}

async function searchAudits({ organizationId, reqUser, pattern, companyId, limit }) {
    const conditions = [
        'a.organization_id = @organization_id',
        'a.is_deleted = 0',
        `(
            a.audit_number LIKE @pattern
            OR a.client_name LIKE @pattern
            OR JSON_VALUE(a.audit_extra_data, '$.auditOutcome.conclusions') LIKE @pattern
        )`,
    ];
    const params = { organization_id: organizationId, pattern, limit };
    appendAuditStudioScope(conditions, params, reqUser);
    appendRigidCompanyFilter(conditions, params, companyId, 'a.company_id');

    const result = await query(`
        SELECT TOP (@limit)
            a.audit_id AS id,
            a.audit_uuid,
            a.audit_number,
            a.client_name,
            a.status,
            a.company_id,
            c.name AS company_name,
            JSON_VALUE(a.audit_extra_data, '$.auditOutcome.conclusions') AS conclusions
        FROM audits a
        LEFT JOIN companies c ON a.company_id = c.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY a.updated_at DESC, a.audit_id DESC
    `, params);

    return (result.recordset || []).map((row) => ({
        entityType: 'audit',
        id: row.id,
        uuid: row.audit_uuid || null,
        title: row.audit_number || `Audit #${row.id}`,
        snippet: truncate(row.conclusions || row.client_name),
        status: row.status || null,
        companyId: row.company_id ?? null,
        companyName: row.company_name || null,
    }));
}

async function searchComplaints({ organizationId, pattern, companyId, limit }) {
    const conditions = [
        'c.organization_id = @organization_id',
        `(
            c.complaint_number LIKE @pattern
            OR c.title LIKE @pattern
            OR c.description LIKE @pattern
            OR c.customer_name LIKE @pattern
            OR c.root_cause LIKE @pattern
        )`,
    ];
    const params = { organization_id: organizationId, pattern, limit };
    appendRigidCompanyFilter(conditions, params, companyId, 'c.company_id');

    const result = await query(`
        SELECT TOP (@limit)
            c.id,
            c.complaint_number,
            c.title,
            c.description,
            c.status,
            c.complaint_type,
            c.company_id,
            cp.name AS company_name
        FROM complaints c
        LEFT JOIN companies cp ON c.company_id = cp.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY c.updated_at DESC, c.id DESC
    `, params);

    return (result.recordset || []).map((row) => ({
        entityType: 'complaint',
        id: row.id,
        title: row.complaint_number || row.title || `Reclamo #${row.id}`,
        snippet: truncate(row.description || row.title),
        status: row.status || null,
        complaintType: row.complaint_type || null,
        companyId: row.company_id ?? null,
        companyName: row.company_name || null,
    }));
}

async function searchRisks({ organizationId, pattern, companyId, limit }) {
    const conditions = [
        'r.organization_id = @organization_id',
        'r.is_deleted = 0',
        '(r.title LIKE @pattern OR r.description LIKE @pattern OR r.category LIKE @pattern)',
    ];
    const params = { organization_id: organizationId, pattern, limit };
    appendRigidCompanyFilter(conditions, params, companyId, 'r.company_id');

    const result = await query(`
        SELECT TOP (@limit)
            r.risk_id AS id,
            r.title,
            r.description,
            r.status,
            r.company_id
        FROM risks r
        WHERE ${conditions.join(' AND ')}
        ORDER BY r.updated_at DESC, r.risk_id DESC
    `, params);

    return (result.recordset || []).map((row) => ({
        entityType: 'risk',
        id: row.id,
        title: row.title || `Rischio #${row.id}`,
        snippet: truncate(row.description),
        status: row.status || null,
        companyId: row.company_id ?? null,
        companyName: null,
    }));
}

async function searchQualifications({ organizationId, pattern, companyId, limit }) {
    const conditions = [
        'q.organization_id = @organization_id',
        `(
            q.person_name LIKE @pattern
            OR q.qualification_type LIKE @pattern
            OR q.certificate_number LIKE @pattern
            OR q.standard_ref LIKE @pattern
            OR q.scope_detail LIKE @pattern
        )`,
    ];
    const params = { organization_id: organizationId, pattern, limit };
    appendRigidCompanyFilter(conditions, params, companyId, 'q.company_id');

    const result = await query(`
        SELECT TOP (@limit)
            q.id,
            q.person_name,
            q.qualification_type,
            q.certificate_number,
            q.status,
            q.company_id,
            c.name AS company_name
        FROM qualifications q
        LEFT JOIN companies c ON q.company_id = c.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY q.updated_at DESC, q.id DESC
    `, params);

    return (result.recordset || []).map((row) => ({
        entityType: 'qualification',
        id: row.id,
        title: row.person_name
            ? `${row.person_name}  ${row.qualification_type || 'Qualifica'}`
            : (row.qualification_type || `Qualifica #${row.id}`),
        snippet: truncate(row.certificate_number || row.qualification_type),
        status: row.status || null,
        companyId: row.company_id ?? null,
        companyName: row.company_name || null,
    }));
}

const SEARCH_HANDLERS = {
    non_conformity: searchNonConformities,
    document: searchDocuments,
    audit: searchAudits,
    complaint: searchComplaints,
    risk: searchRisks,
    qualification: searchQualifications,
};

/**
 * @param {object} options
 * @param {number} options.organizationId
 * @param {object} options.reqUser - JWT user (RBAC studio su audit/NC)
 * @param {string} options.q - testo ricerca (min 2 char, già validato)
 * @param {number|null} [options.companyId]
 * @param {string|string[]|null} [options.entityTypes]
 * @param {number|string} [options.limit]
 */
async function unifiedSearch(options) {
    const {
        organizationId,
        reqUser,
        q,
        companyId = null,
        entityTypes = null,
        limit = DEFAULT_LIMIT,
    } = options;

    const pattern = `%${q}%`;
    const perTypeLimit = clampLimit(limit);
    const types = normalizeEntityTypes(entityTypes);
    const groups = {};
    let totalCount = 0;

    const tasks = types.map(async (type) => {
        const handler = SEARCH_HANDLERS[type];
        if (!handler) return;
        const items = await handler({
            organizationId,
            reqUser,
            pattern,
            companyId,
            limit: perTypeLimit,
        });
        groups[type] = items;
        totalCount += items.length;
    });

    await Promise.all(tasks);

    for (const type of ALL_ENTITY_TYPES) {
        if (!groups[type]) {
            groups[type] = [];
        }
    }

    return {
        query: q,
        companyId,
        limit: perTypeLimit,
        entityTypes: types,
        groups,
        totalCount,
    };
}

module.exports = {
    ALL_ENTITY_TYPES,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    normalizeEntityTypes,
    clampLimit,
    unifiedSearch,
};
