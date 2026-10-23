/**
 * Avvisi di discrepanza persistiti. Le regole stanno nel modulo
 * discrepancyNotices; qui si legano al record e alle azioni umane.
 */

'use strict';

const { query } = require('../config/database');
const {
    evaluateDiscrepancy,
    applyResolution,
    openNotices,
    countsAsVerifiedConformity,
    effectiveApprovalStatus,
    ACTION_TO_STATUS,
} = require('./discrepancyNotices');

const DOMAIN = 'wpqr';
const ACTIONS = Object.keys(ACTION_TO_STATUS);

const RECORD_COLUMNS = `
    wq.id, wq.approval_status, wq.wpqr_code, wq.reference_number, wq.certificate_number,
    wq.examiner_body, wq.testing_body, wq.welding_process, wq.standard_reference,
    wq.joint_type, wq.base_material_group, wq.filler_material, wq.throat_test_mm,
    wq.notes, wq.qualification_level
`;

function optionalColumns(row) {
    return {
        other_test_info: row.other_test_info,
        range_standard_reference: row.range_standard_reference,
        material_group_range: row.material_group_range,
        fillet_throat_range: row.fillet_throat_range,
        material_group: row.material_group,
        issuing_body: row.issuing_body,
    };
}

function isMissingObject(err) {
    return /Invalid object name|Invalid column name/i.test(String(err && err.message));
}

function idList(ids) {
    return [...new Set((ids || []).map((id) => parseInt(id, 10)).filter((n) => Number.isInteger(n) && n > 0))];
}

function bindIds(params, ids, prefix) {
    const clean = idList(ids);
    const names = clean.map((id, i) => {
        const key = `${prefix}${i}`;
        params[key] = id;
        return `@${key}`;
    });
    return { clean, names };
}

function pushIdFilter(conditions, params, ids, prefix) {
    const { clean, names } = bindIds(params, ids, prefix);
    if (!clean.length) {
        conditions.push('1 = 0');
        return;
    }
    conditions.push(`wq.id IN (${names.join(', ')})`);
}

function groupBy(rows, key) {
    const map = new Map();
    for (const row of rows || []) {
        const id = row[key];
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(row);
    }
    return map;
}

async function loadRuns(organizationId, ids) {
    const clean = idList(ids);
    if (!clean.length) return new Map();
    const params = { organization_id: organizationId };
    const { names } = bindIds(params, clean, 'run');
    try {
        const result = await query(`
            SELECT wpqr_id, filler_designation, filler_make
            FROM wpqr_test_runs
            WHERE organization_id = @organization_id
              AND deleted_at IS NULL
              AND wpqr_id IN (${names.join(', ')})
        `, params);
        return groupBy(result.recordset, 'wpqr_id');
    } catch (err) {
        if (!isMissingObject(err)) throw err;
        return new Map();
    }
}

async function loadResolutions(organizationId, ids) {
    const clean = idList(ids);
    if (!clean.length) return new Map();
    const params = { organization_id: organizationId, domain: DOMAIN };
    const { names } = bindIds(params, clean, 'res');
    try {
        const result = await query(`
            SELECT entity_id, rule_code, fingerprint, status, note
            FROM discrepancy_notices
            WHERE organization_id = @organization_id
              AND domain = @domain
              AND entity_id IN (${names.join(', ')})
        `, params);
        return groupBy(result.recordset, 'entity_id');
    } catch (err) {
        if (!isMissingObject(err)) throw err;
        return new Map();
    }
}

function mergeNotices(record, runs, resolutions) {
    const evaluated = evaluateDiscrepancy(DOMAIN, { ...record, ...optionalColumns(record) }, { runs: runs || [] });
    const byCode = new Map((resolutions || []).map((row) => [row.rule_code, row]));
    return evaluated.map((notice) => applyResolution(notice, byCode.get(notice.code)));
}

function decorateRecord(record, runs, resolutions) {
    const notices = mergeNotices(record, runs, resolutions);
    const open = openNotices(notices);
    return {
        ...record,
        discrepancy_notices: notices,
        open_notice_count: open.length,
        effective_approval_status: effectiveApprovalStatus(record.approval_status, notices),
        conformity_verified: countsAsVerifiedConformity(record.approval_status, notices),
    };
}

async function decorateWpqrRows(organizationId, rows) {
    const list = rows || [];
    if (!list.length) return list;
    const ids = list.map((row) => row.id);
    const [runs, resolutions] = await Promise.all([
        loadRuns(organizationId, ids),
        loadResolutions(organizationId, ids),
    ]);
    return list.map((row) => decorateRecord(row, runs.get(row.id) || [], resolutions.get(row.id) || []));
}

async function loadScopedRows(organizationId, conditions, params) {
    const where = (conditions || []).join(' AND ');
    const sql = `
        SELECT ${RECORD_COLUMNS},
               wq.other_test_info, wq.range_standard_reference,
               wq.material_group_range, wq.fillet_throat_range
        FROM wpqr_records wq
        WHERE ${where}
    `;
    try {
        const result = await query(sql, { ...params, organization_id: organizationId });
        return result.recordset || [];
    } catch (err) {
        if (!isMissingObject(err)) throw err;
        const fallback = await query(`
            SELECT ${RECORD_COLUMNS}
            FROM wpqr_records wq
            WHERE ${where}
        `, { ...params, organization_id: organizationId });
        return fallback.recordset || [];
    }
}

async function classifyWpqrIds(organizationId, conditions, params) {
    const rows = await loadScopedRows(organizationId, conditions, params);
    const decorated = await decorateWpqrRows(organizationId, rows);
    const daRivedere = [];
    const verificate = [];
    for (const row of decorated) {
        if (row.effective_approval_status === 'da_rivedere') daRivedere.push(row.id);
        else if (row.conformity_verified) verificate.push(row.id);
    }
    return { daRivedere, verificate };
}

async function noticesForWpqr(organizationId, record) {
    const [decorated] = await decorateWpqrRows(organizationId, [record]);
    return decorated;
}

async function actOnWpqrNotice({ organizationId, wpqrId, userId, action, ruleCode, note }) {
    const status = ACTION_TO_STATUS[action];
    if (!status) {
        const err = new Error('Azione non valida');
        err.status = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
    }
    if (!ruleCode) {
        const err = new Error('Codice avviso obbligatorio');
        err.status = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
    }
    const found = await query(`
        SELECT ${RECORD_COLUMNS},
               wq.other_test_info, wq.range_standard_reference,
               wq.material_group_range, wq.fillet_throat_range
        FROM wpqr_records wq
        WHERE wq.id = @id AND wq.organization_id = @organization_id AND wq.deleted_at IS NULL
    `, { id: wpqrId, organization_id: organizationId }).catch(async (err) => {
        if (!isMissingObject(err)) throw err;
        return query(`
            SELECT ${RECORD_COLUMNS}
            FROM wpqr_records wq
            WHERE wq.id = @id AND wq.organization_id = @organization_id AND wq.deleted_at IS NULL
        `, { id: wpqrId, organization_id: organizationId });
    });
    const record = found.recordset && found.recordset[0];
    if (!record) {
        const err = new Error('WPQR non trovata');
        err.status = 404;
        err.code = 'WPQR_NOT_FOUND';
        throw err;
    }
    const runs = await loadRuns(organizationId, [wpqrId]);
    const evaluated = evaluateDiscrepancy(DOMAIN, record, { runs: runs.get(wpqrId) || [] });
    const target = evaluated.find((item) => item.code === ruleCode);
    if (!target) {
        const err = new Error('Avviso non più presente su questa WPQR');
        err.status = 404;
        err.code = 'NOTICE_NOT_FOUND';
        throw err;
    }
    const noteText = note ? String(note).slice(0, 500) : null;
    try {
        const existing = await query(`
            SELECT id FROM discrepancy_notices
            WHERE organization_id = @organization_id
              AND domain = @domain
              AND entity_id = @entity_id
              AND rule_code = @rule_code
              AND fingerprint = @fingerprint
        `, {
            organization_id: organizationId,
            domain: DOMAIN,
            entity_id: wpqrId,
            rule_code: ruleCode,
            fingerprint: target.fingerprint,
        });
        if (existing.recordset.length) {
            await query(`
                UPDATE discrepancy_notices
                SET status = @status, note = @note, acted_by = @acted_by, acted_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
                WHERE id = @id AND organization_id = @organization_id
            `, {
                id: existing.recordset[0].id,
                organization_id: organizationId,
                status,
                note: noteText,
                acted_by: userId || null,
            });
        } else {
            await query(`
                INSERT INTO discrepancy_notices (
                    organization_id, domain, entity_id, rule_code, fingerprint, status, message_it, note, acted_by, acted_at
                ) VALUES (
                    @organization_id, @domain, @entity_id, @rule_code, @fingerprint, @status, @message_it, @note, @acted_by, SYSUTCDATETIME()
                )
            `, {
                organization_id: organizationId,
                domain: DOMAIN,
                entity_id: wpqrId,
                rule_code: ruleCode,
                fingerprint: target.fingerprint,
                status,
                message_it: target.message_it,
                note: noteText,
                acted_by: userId || null,
            });
        }
    } catch (err) {
        if (isMissingObject(err)) {
            const missing = new Error('Tabella avvisi non presente: applicare la migrazione 185 su TEST');
            missing.status = 503;
            missing.code = 'NOTICES_SCHEMA_MISSING';
            throw missing;
        }
        throw err;
    }
    return noticesForWpqr(organizationId, record);
}

module.exports = {
    DOMAIN,
    ACTIONS,
    decorateWpqrRows,
    decorateRecord,
    classifyWpqrIds,
    noticesForWpqr,
    actOnWpqrNotice,
    pushIdFilter,
    mergeNotices,
};
