/**
 * Profilo azienda conformità legislativa (ADR-018, slice S2a).
 * GET/PUT /companies/:id/profile — gated da SAL_LEGAL_CONFORMITY.
 * Assenza riga = 200 + defaults (eventuale seed nome/P.IVA da companies, non persistito).
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { hasSalLegalConformityCapability } = require('../services/moduleLicense.service');
const {
    assertCompanyAccess,
    assertCompanyWriteAccess,
    ensureCompanyAccessLoaded,
    hasCompanyAccessRows,
    sendAccessDenied,
} = require('../services/companyAccess.service');
const {
    emptyProfile,
    pickEditableFields,
    mergeSourceMeta,
    rowToProfile,
    EDITABLE_FIELDS,
} = require('../data/companyProfileFields');

function resolveAuditorOrgId(req) {
    const userOrgId = req.user.auditor_org_id;
    const isSuperadmin = req.user.role === 'admin' && !userOrgId;
    const queryOrgId = req.query.auditor_org_id ? parseInt(req.query.auditor_org_id, 10) : null;
    if (isSuperadmin && queryOrgId) return queryOrgId;
    return userOrgId;
}

async function assertCapability(req) {
    const orgId = req.user?.organization_id;
    const ok = await hasSalLegalConformityCapability(orgId, req.user?.role);
    if (!ok) {
        return {
            status: 403,
            body: { error: 'Funzionalità non abilitata', code: 'FEATURE_NOT_ENABLED' },
        };
    }
    return null;
}

async function resolveCompanyScope(companyId, auditorOrgId) {
    const result = await query(`
        SELECT c.id AS company_id, ao.organization_id, c.name, c.vat_number, c.address
        FROM companies c
        INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
        WHERE c.id = @company_id AND c.auditor_org_id = @auditor_org_id
    `, { company_id: companyId, auditor_org_id: auditorOrgId });
    return result.recordset[0] || null;
}

async function resolveProfileScope(req, companyId, level) {
    const companyIdNum = parseInt(companyId, 10);
    if (!Number.isFinite(companyIdNum)) {
        return {
            denied: { status: 400, body: { error: 'companyId non valido', code: 'INVALID_COMPANY_ID' } },
        };
    }

    const accessList = await ensureCompanyAccessLoaded(req.user);
    if (hasCompanyAccessRows(accessList)) {
        const denied = level === 'write'
            ? await assertCompanyWriteAccess(req.user, companyIdNum)
            : await assertCompanyAccess(req.user, companyIdNum, 'read');
        if (denied) return { denied };

        const result = await query(`
            SELECT c.id AS company_id, ao.organization_id, c.name, c.vat_number, c.address
            FROM companies c
            INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE c.id = @company_id
        `, { company_id: companyIdNum });
        const scope = result.recordset[0];
        if (!scope) {
            return { denied: { status: 403, body: { error: 'Azienda non accessibile', code: 'FORBIDDEN' } } };
        }
        return { scope };
    }

    const auditorOrgId = resolveAuditorOrgId(req);
    if (!auditorOrgId) {
        return {
            denied: {
                status: 403,
                body: {
                    error: 'Specificare auditor_org_id (superadmin) o appartenere a un auditor_org',
                    code: 'AUDITOR_ORG_REQUIRED',
                },
            },
        };
    }

    const scope = await resolveCompanyScope(companyIdNum, auditorOrgId);
    if (!scope) {
        return { denied: { status: 403, body: { error: 'Azienda non accessibile', code: 'FORBIDDEN' } } };
    }
    return { scope };
}

function seedFromAnagrafica(profile, scope) {
    const seeded = [];
    if (!profile.legal_name && scope.name) {
        profile.legal_name = scope.name;
        seeded.push('legal_name');
    }
    if (!profile.vat_number && scope.vat_number) {
        profile.vat_number = scope.vat_number;
        seeded.push('vat_number');
    }
    return seeded;
}

function serializeProfile(row, scope, exists) {
    const profile = rowToProfile(row);
    const seededFromAnagrafica = exists ? [] : seedFromAnagrafica(profile, scope);
    return {
        ...profile,
        company_id: scope.company_id,
        organization_id: scope.organization_id,
        source_meta: row?.source_meta || null,
        profile_completeness: row?.profile_completeness ?? null,
        exists,
        seededFromAnagrafica,
        address_anagrafica: scope.address || null,
        updated_at: row?.updated_at || null,
    };
}

async function loadProfileRow(companyId) {
    const result = await query(`
        SELECT * FROM company_profile WHERE company_id = @company_id
    `, { company_id: companyId });
    return result.recordset[0] || null;
}

/**
 * GET /api/v1/companies/:id/profile
 */
async function getProfile(req, res) {
    try {
        const capDenied = await assertCapability(req);
        if (capDenied) return res.status(capDenied.status).json(capDenied.body);

        const { denied, scope } = await resolveProfileScope(req, req.params.id, 'read');
        if (denied) return sendAccessDenied(res, denied);

        const row = await loadProfileRow(scope.company_id);
        return res.json({
            success: true,
            data: serializeProfile(row, scope, !!row),
        });
    } catch (err) {
        logger.error(`[companyProfile] GET: ${err.message}`);
        return res.status(500).json({ error: 'Errore lettura profilo', code: 'PROFILE_GET_FAILED' });
    }
}

/**
 * PUT /api/v1/companies/:id/profile
 */
async function putProfile(req, res) {
    try {
        const capDenied = await assertCapability(req);
        if (capDenied) return res.status(capDenied.status).json(capDenied.body);

        const { denied, scope } = await resolveProfileScope(req, req.params.id, 'write');
        if (denied) return sendAccessDenied(res, denied);

        const fields = pickEditableFields(req.body);
        const touched = Object.keys(fields);
        if (touched.length === 0) {
            return res.status(400).json({
                error: 'Nessun campo profilo da salvare',
                code: 'EMPTY_PROFILE_BODY',
            });
        }

        const existing = await loadProfileRow(scope.company_id);
        const userId = req.user?.user_id || null;
        const sourceMeta = mergeSourceMeta(existing?.source_meta, touched, userId);

        if (!existing) {
            const cols = ['company_id', 'organization_id', 'source_meta', 'updated_by_user_id', ...touched];
            const values = cols.map((c) => `@${c}`);
            await query(
                `INSERT INTO company_profile (${cols.join(', ')}) VALUES (${values.join(', ')})`,
                {
                    company_id: scope.company_id,
                    organization_id: scope.organization_id,
                    source_meta: sourceMeta,
                    updated_by_user_id: userId,
                    ...fields,
                }
            );
        } else {
            const sets = [
                ...touched.map((c) => `${c} = @${c}`),
                'source_meta = @source_meta',
                'updated_at = SYSUTCDATETIME()',
                'updated_by_user_id = @updated_by_user_id',
            ];
            await query(
                `UPDATE company_profile SET ${sets.join(', ')}
                 WHERE company_id = @company_id AND organization_id = @organization_id`,
                {
                    company_id: scope.company_id,
                    organization_id: scope.organization_id,
                    source_meta: sourceMeta,
                    updated_by_user_id: userId,
                    ...fields,
                }
            );
        }

        const row = await loadProfileRow(scope.company_id);
        return res.json({
            success: true,
            data: serializeProfile(row, scope, true),
        });
    } catch (err) {
        logger.error(`[companyProfile] PUT: ${err.message}`);
        return res.status(500).json({ error: 'Errore salvataggio profilo', code: 'PROFILE_PUT_FAILED' });
    }
}

module.exports = {
    getProfile,
    putProfile,
    resolveProfileScope,
    serializeProfile,
    EDITABLE_FIELDS,
};
