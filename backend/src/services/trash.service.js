'use strict';

/**
 * Cestino e ripristino (migrazione 176). Solo admin e superadmin della stessa
 * organizzazione. Scope azienda come A4: altra org 404, azienda non consentita 403.
 */

const { query } = require('../config/database');
const {
    ensureCompanyAccessLoaded,
    hasCompanyAccessRows,
    companyAccessSqlFilter,
    assertCompanyRead,
    sendAccessDenied,
} = require('./companyAccess.service');
const {
    isTrashAdmin,
    strictPositiveInt,
    logEntityChange,
    restoreSql,
} = require('./entityChangeLog.service');
const { attachmentScopeSync } = require('../controllers/attachment.controller');

const ENTITIES = {
    qualifications: {
        label: 'Qualifica',
        table: 'qualifications',
        idColumn: 'id',
        hasOrg: true,
        title: 't.person_name',
        code: 't.certificate_number',
        status: 't.status',
    },
    welding_procedures: {
        label: 'WPS',
        table: 'welding_procedures',
        idColumn: 'id',
        hasOrg: true,
        title: 't.wps_code',
        code: 't.wps_code',
        status: 't.status',
    },
    wpqr_records: {
        label: 'WPQR',
        table: 'wpqr_records',
        idColumn: 'id',
        hasOrg: true,
        title: 't.wpqr_code',
        code: 't.certificate_number',
        status: 't.status',
    },
    wpqr_test_runs: {
        label: 'Passata WPQR',
        table: 'wpqr_test_runs',
        idColumn: 'id',
        hasOrg: true,
        title: 't.run_label',
        code: 'CAST(t.wpqr_id AS NVARCHAR(32))',
        status: 'NULL',
    },
    wps_wpqr_links: {
        label: 'Legame WPS-WPQR',
        table: 'wps_wpqr_links',
        idColumn: 'id',
        hasOrg: true,
        title: 'CAST(t.wps_id AS NVARCHAR(32))',
        code: 'CAST(t.wpqr_id AS NVARCHAR(32))',
        status: 'NULL',
        companySelect: 'w.company_id',
        join: 'INNER JOIN welding_procedures w ON w.id = t.wps_id AND w.organization_id = t.organization_id',
        companyAlias: 'w',
    },
    wps_welders: {
        label: 'Saldatore su WPS',
        table: 'wps_welders',
        idColumn: 'id',
        hasOrg: true,
        title: 'CAST(t.qualification_id AS NVARCHAR(32))',
        code: 'CAST(t.wps_id AS NVARCHAR(32))',
        status: 'NULL',
        companySelect: 'w.company_id',
        join: 'INNER JOIN welding_procedures w ON w.id = t.wps_id AND w.organization_id = t.organization_id',
        companyAlias: 'w',
    },
    projects: {
        label: 'Commessa',
        table: 'projects',
        idColumn: 'id',
        hasOrg: true,
        title: 't.project_code',
        code: 't.project_code',
        status: 't.status',
    },
    project_welders: {
        label: 'Saldatore su commessa',
        table: 'project_welders',
        idColumn: 'id',
        hasOrg: true,
        title: 'CAST(t.qualification_id AS NVARCHAR(32))',
        code: 'CAST(t.project_id AS NVARCHAR(32))',
        status: 'NULL',
        companySelect: 'p.company_id',
        join: 'INNER JOIN projects p ON p.id = t.project_id AND p.organization_id = t.organization_id',
        companyAlias: 'p',
    },
    non_conformities: {
        label: 'Non conformità',
        table: 'non_conformities',
        idColumn: 'nc_id',
        hasOrg: true,
        title: 't.nc_number',
        code: 't.nc_number',
        status: 't.status',
    },
};

function forbid(res) {
    return res.status(403).json({
        error: 'Accesso negato: cestino riservato ad admin e superadmin',
        code: 'AUTH_FORBIDDEN',
    });
}

async function companyDenied(user, companyId) {
    const accessList = await ensureCompanyAccessLoaded(user);
    if (!hasCompanyAccessRows(accessList)) return null;
    if (companyId == null || companyId === '') {
        return { status: 403, body: { error: 'Azienda non accessibile', code: 'FORBIDDEN' } };
    }
    return assertCompanyRead(user, companyId);
}

async function listTrash(req, res) {
    try {
        if (!isTrashAdmin(req.user)) return forbid(res);
        const organizationId = req.user.organization_id;
        const requested = req.query.entity ? String(req.query.entity) : null;
        const keys = requested
            ? [requested]
            : [...Object.keys(ENTITIES), 'attachments', 'nc_actions'];
        if (requested && !ENTITIES[requested] && requested !== 'attachments' && requested !== 'nc_actions') {
            return res.status(404).json({ error: 'Entità non nel cestino', code: 'TRASH_ENTITY_NOT_FOUND' });
        }

        const accessList = await ensureCompanyAccessLoaded(req.user);
        const rows = [];
        for (const key of keys) {
            if (key === 'attachments') {
                rows.push(...await listTrashedAttachments(req.user, organizationId));
                continue;
            }
            if (key === 'nc_actions') {
                rows.push(...await listTrashedNcActions(organizationId, accessList));
                continue;
            }
            const spec = ENTITIES[key];
            if (!spec) continue;
            const companyAlias = spec.companyAlias || 't';
            const companyFilter = companyAccessSqlFilter(accessList, companyAlias);
            const where = ['t.organization_id = @organization_id', 't.deleted_at IS NOT NULL'];
            if (companyFilter.clause) where.push(companyFilter.clause);
            const companySelect = spec.companySelect || 't.company_id';
            const result = await query(`
                SELECT TOP 200
                    t.${spec.idColumn} AS id,
                    ${companySelect} AS company_id,
                    t.deleted_at,
                    t.deleted_by,
                    ${spec.title} AS title,
                    ${spec.code} AS code,
                    ${spec.status} AS status
                FROM ${spec.table} t
                ${spec.join || ''}
                WHERE ${where.join(' AND ')}
                ORDER BY t.deleted_at DESC
            `, { organization_id: organizationId, ...companyFilter.params });
            for (const row of result.recordset || []) {
                rows.push({ ...row, entity: key, entity_label: spec.label });
            }
        }
        rows.sort((a, b) => String(b.deleted_at || '').localeCompare(String(a.deleted_at || '')));
        res.json({ success: true, data: rows });
    } catch (err) {
        return res.status(500).json({ error: 'Errore durante la lettura del cestino', code: 'TRASH_LIST_ERROR' });
    }
}

async function listTrashedAttachments(user, organizationId) {
    const scope = await scopedAttachmentList(user);
    const result = await query(`
        SELECT TOP 200
            att.attachment_id AS id,
            COALESCE(a.company_id, nc.company_id, ndt_r.company_id, rdp_r.company_id, wb.company_id) AS company_id,
            att.deleted_at,
            att.deleted_by,
            att.file_name AS title,
            att.category AS code,
            NULL AS status
        FROM attachments att
        ${scope.joinSql}
        WHERE att.deleted_at IS NOT NULL
          AND ${scope.orgClause}
          ${scope.rbacClause}
        ORDER BY att.deleted_at DESC
    `, { organization_id: organizationId, ...scope.scopeParams });
    return (result.recordset || []).map((row) => ({
        ...row, entity: 'attachments', entity_label: 'Allegato',
    }));
}

async function scopedAttachmentList(user) {
    const base = attachmentScopeSync(user);
    const accessList = await ensureCompanyAccessLoaded(user);
    if (!hasCompanyAccessRows(accessList)) return base;
    const filter = companyAccessSqlFilter(
        accessList,
        'x',
        'company_id',
        'att_co',
    );
    const companyExpr = 'COALESCE(a.company_id, nc.company_id, ndt_r.company_id, rdp_r.company_id, wb.company_id)';
    const clause = filter.clause.replace('x.company_id', companyExpr);
    return {
        ...base,
        rbacClause: `${base.rbacClause}${clause ? ` AND ${clause}` : ''}`,
        scopeParams: { ...base.scopeParams, ...filter.params },
    };
}

async function listTrashedNcActions(organizationId, accessList) {
    const companyFilter = companyAccessSqlFilter(accessList, 'nc');
    const where = [
        'a.deleted_at IS NOT NULL',
        'COALESCE(nc.organization_id, au.organization_id) = @organization_id',
    ];
    if (companyFilter.clause) where.push(companyFilter.clause);
    const result = await query(`
        SELECT TOP 200
            a.action_id AS id,
            nc.company_id,
            a.deleted_at,
            a.deleted_by,
            a.description AS title,
            nc.nc_number AS code,
            a.status AS status
        FROM nc_actions a
        INNER JOIN non_conformities nc ON nc.nc_id = a.nc_id
        LEFT JOIN audits au ON au.audit_id = nc.audit_id
        WHERE ${where.join(' AND ')}
        ORDER BY a.deleted_at DESC
    `, { organization_id: organizationId, ...companyFilter.params });
    return (result.recordset || []).map((row) => ({
        ...row, entity: 'nc_actions', entity_label: 'Azione NC',
    }));
}

async function loadTrashRow(entity, id, organizationId) {
    if (entity === 'attachments') {
        const scope = attachmentScopeSync({ role: 'admin' });
        const result = await query(`
            SELECT
                att.attachment_id AS id,
                att.deleted_at,
                att.file_name AS title,
                COALESCE(a.organization_id, nc.organization_id, ndt_r.organization_id, rdp_r.organization_id, wb.organization_id) AS organization_id,
                COALESCE(a.company_id, nc.company_id, ndt_r.company_id, rdp_r.company_id, wb.company_id) AS company_id
            FROM attachments att
            ${scope.joinSql}
            WHERE att.attachment_id = @id
        `, { id });
        const row = result.recordset?.[0];
        if (!row || Number(row.organization_id) !== Number(organizationId)) return null;
        return row;
    }
    if (entity === 'nc_actions') {
        const result = await query(`
            SELECT
                a.action_id AS id,
                a.deleted_at,
                a.description AS title,
                a.status,
                COALESCE(nc.organization_id, au.organization_id) AS organization_id,
                COALESCE(nc.company_id, au.company_id) AS company_id
            FROM nc_actions a
            INNER JOIN non_conformities nc ON nc.nc_id = a.nc_id
            LEFT JOIN audits au ON au.audit_id = nc.audit_id
            WHERE a.action_id = @id
        `, { id });
        const row = result.recordset?.[0];
        if (!row || Number(row.organization_id) !== Number(organizationId)) return null;
        return row;
    }
    const spec = ENTITIES[entity];
    if (!spec) return undefined;
    const result = await query(`
        SELECT
            t.${spec.idColumn} AS id,
            ${spec.companySelect || 't.company_id'} AS company_id,
            t.deleted_at,
            ${spec.status} AS status,
            ${spec.title} AS title
        FROM ${spec.table} t
        ${spec.join || ''}
        WHERE t.${spec.idColumn} = @id AND t.organization_id = @organization_id
    `, { id, organization_id: organizationId });
    return result.recordset?.[0] || null;
}

const NC_ORG = 'COALESCE(nc.organization_id, au.organization_id) = @organization_id';

/** Il figlio non torna in elenco finché il padre è nel cestino. */
async function parentStillTrashed(entity, id, organizationId) {
    const sqlByEntity = {
        wpqr_records: `SELECT w.deleted_at AS parent_deleted
            FROM wpqr_records t
            INNER JOIN welding_procedures w ON w.id = t.wps_id AND w.organization_id = t.organization_id
            WHERE t.id = @id AND t.organization_id = @organization_id`,
        wpqr_test_runs: `SELECT COALESCE(wq.deleted_at, w.deleted_at) AS parent_deleted
            FROM wpqr_test_runs t
            INNER JOIN wpqr_records wq ON wq.id = t.wpqr_id AND wq.organization_id = t.organization_id
            LEFT JOIN welding_procedures w ON w.id = wq.wps_id AND w.organization_id = wq.organization_id
            WHERE t.id = @id AND t.organization_id = @organization_id`,
        wps_wpqr_links: `SELECT w.deleted_at AS parent_deleted
            FROM wps_wpqr_links t
            INNER JOIN welding_procedures w ON w.id = t.wps_id AND w.organization_id = t.organization_id
            WHERE t.id = @id AND t.organization_id = @organization_id`,
        wps_welders: `SELECT w.deleted_at AS parent_deleted
            FROM wps_welders t
            INNER JOIN welding_procedures w ON w.id = t.wps_id AND w.organization_id = t.organization_id
            WHERE t.id = @id AND t.organization_id = @organization_id`,
        project_welders: `SELECT p.deleted_at AS parent_deleted
            FROM project_welders t
            INNER JOIN projects p ON p.id = t.project_id AND p.organization_id = t.organization_id
            WHERE t.id = @id AND t.organization_id = @organization_id`,
        nc_actions: `SELECT nc.deleted_at AS parent_deleted
            FROM nc_actions t
            INNER JOIN non_conformities nc ON nc.nc_id = t.nc_id
            LEFT JOIN audits au ON au.audit_id = nc.audit_id
            WHERE t.action_id = @id AND ${NC_ORG}`,
    };
    const sql = entity === 'attachments'
        ? `SELECT nc.deleted_at AS parent_deleted
            FROM attachments t
            INNER JOIN non_conformities nc ON nc.nc_id = t.nc_id
            LEFT JOIN audits au ON au.audit_id = nc.audit_id
            WHERE t.attachment_id = @id AND t.nc_id IS NOT NULL AND ${NC_ORG}`
        : sqlByEntity[entity];
    if (!sql) return false;
    const result = await query(sql, { id, organization_id: organizationId });
    return Boolean(result.recordset?.[0]?.parent_deleted);
}

function childRestoreSql(entity) {
    if (entity === 'non_conformities') {
        return [
            `UPDATE a SET deleted_at = NULL, deleted_by = NULL
             FROM nc_actions a
             INNER JOIN non_conformities nc ON nc.nc_id = a.nc_id
             LEFT JOIN audits au ON au.audit_id = nc.audit_id
             WHERE a.nc_id = @id AND a.deleted_at IS NOT NULL AND ${NC_ORG}`,
            `UPDATE att SET deleted_at = NULL, deleted_by = NULL
             FROM attachments att
             INNER JOIN non_conformities nc ON nc.nc_id = att.nc_id
             LEFT JOIN audits au ON au.audit_id = nc.audit_id
             WHERE att.nc_id = @id AND att.deleted_at IS NOT NULL AND ${NC_ORG}`,
        ];
    }
    if (entity === 'welding_procedures') {
        return [
            `UPDATE wpqr_records SET deleted_at = NULL, deleted_by = NULL
             WHERE wps_id = @id AND organization_id = @organization_id AND deleted_at IS NOT NULL`,
            `UPDATE r SET deleted_at = NULL, deleted_by = NULL
             FROM wpqr_test_runs r
             INNER JOIN wpqr_records wq ON wq.id = r.wpqr_id AND wq.organization_id = r.organization_id
             WHERE wq.wps_id = @id AND r.organization_id = @organization_id AND r.deleted_at IS NOT NULL`,
            `UPDATE wps_wpqr_links SET deleted_at = NULL, deleted_by = NULL
             WHERE wps_id = @id AND organization_id = @organization_id AND deleted_at IS NOT NULL`,
            `UPDATE wps_welders SET deleted_at = NULL, deleted_by = NULL
             WHERE wps_id = @id AND organization_id = @organization_id AND deleted_at IS NOT NULL`,
        ];
    }
    if (entity === 'projects') {
        return [
            `UPDATE project_welders SET deleted_at = NULL, deleted_by = NULL
             WHERE project_id = @id AND organization_id = @organization_id AND deleted_at IS NOT NULL`,
        ];
    }
    if (entity === 'wpqr_records') {
        return [
            `UPDATE wpqr_test_runs SET deleted_at = NULL, deleted_by = NULL
             WHERE wpqr_id = @id AND organization_id = @organization_id AND deleted_at IS NOT NULL`,
            `UPDATE wps_wpqr_links SET deleted_at = NULL, deleted_by = NULL
             WHERE wpqr_id = @id AND organization_id = @organization_id AND deleted_at IS NOT NULL`,
        ];
    }
    return [];
}

async function restoreTrash(req, res) {
    try {
        if (!isTrashAdmin(req.user)) return forbid(res);
        const entity = String(req.params.entity || '');
        const known = ENTITIES[entity] || entity === 'attachments' || entity === 'nc_actions';
        if (!known) {
            return res.status(404).json({ error: 'Entità non nel cestino', code: 'TRASH_ENTITY_NOT_FOUND' });
        }
        const id = strictPositiveInt(req.params.id);
        if (id == null) {
            return res.status(400).json({ error: 'Identificativo non valido.', code: 'INVALID_ID' });
        }
        const organizationId = req.user.organization_id;
        const row = await loadTrashRow(entity, id, organizationId);
        if (row === undefined) {
            return res.status(404).json({ error: 'Entità non nel cestino', code: 'TRASH_ENTITY_NOT_FOUND' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Record non trovato', code: 'TRASH_NOT_FOUND' });
        }
        const denied = await companyDenied(req.user, row.company_id);
        if (denied) return sendAccessDenied(res, denied);
        if (!row.deleted_at) {
            return res.status(409).json({ error: 'Il record non è nel cestino', code: 'NOT_DELETED' });
        }
        if (await parentStillTrashed(entity, id, organizationId)) {
            return res.status(409).json({
                error: 'Il record padre è ancora nel cestino. Ripristina prima quello.',
                code: 'PARENT_IN_TRASH',
            });
        }

        const spec = ENTITIES[entity];
        let sql;
        if (entity === 'attachments') {
            const scope = attachmentScopeSync({ role: 'admin' });
            sql = `UPDATE att
                SET deleted_at = NULL, deleted_by = NULL
                FROM attachments att
                ${scope.joinSql}
                WHERE att.attachment_id = @id AND att.deleted_at IS NOT NULL
                  AND ${scope.orgClause}`;
        } else if (entity === 'nc_actions') {
            sql = `UPDATE a
                SET deleted_at = NULL, deleted_by = NULL
                FROM nc_actions a
                INNER JOIN non_conformities nc ON nc.nc_id = a.nc_id
                LEFT JOIN audits au ON au.audit_id = nc.audit_id
                WHERE a.action_id = @id AND a.deleted_at IS NOT NULL
                  AND COALESCE(nc.organization_id, au.organization_id) = @organization_id`;
        } else {
            sql = restoreSql(spec.table, spec.idColumn, { hasOrg: true });
        }
        await query(sql, {
            id,
            organization_id: organizationId,
            actor_user_id: req.user.user_id,
        });
        for (const childSql of childRestoreSql(entity)) {
            await query(childSql, { id, organization_id: organizationId });
        }
        await logEntityChange({
            organizationId,
            entityTable: spec ? spec.table : entity,
            entityId: id,
            actionType: 'restored',
            actorUserId: req.user.user_id,
            before: { deleted_at: row.deleted_at, status: row.status || null, title: row.title || null },
            after: { deleted_at: null },
        });
        res.json({ success: true, message: 'Record ripristinato' });
    } catch (err) {
        return res.status(500).json({ error: 'Errore durante il ripristino', code: 'TRASH_RESTORE_ERROR' });
    }
}

module.exports = {
    ENTITIES,
    listTrash,
    restoreTrash,
};
