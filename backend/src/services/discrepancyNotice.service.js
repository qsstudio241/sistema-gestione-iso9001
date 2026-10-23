/**
 * Avvisi di discrepanza persistiti. Le regole stanno nel modulo
 * discrepancyNotices; qui si legano al record e alle azioni umane.
 */

'use strict';

const { query } = require('../config/database');
const { logEntityChange } = require('./entityChangeLog.service');
const texts = require('../content/discrepancyNoticeTexts');
const {
    evaluateDiscrepancy,
    applyResolution,
    pickResolution,
    openNotices,
    countsAsVerifiedConformity,
    effectiveApprovalStatus,
    ACTION_TO_STATUS,
    STATUS,
} = require('./discrepancyNotices');

const DOMAIN = 'wpqr';
const ACTIONS = Object.keys(ACTION_TO_STATUS);
const CORREGGI_COLUMNS = new Set([
    'certificate_number', 'wpqr_code', 'filler_material', 'material_group_range',
    'fillet_throat_range', 'base_material_group', 'standard_reference',
    'testing_body', 'examiner_body', 'welding_process', 'joint_type',
]);

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
            SELECT n.entity_id, n.rule_code, n.fingerprint, n.status, n.note, n.message_it,
                   n.acted_by, n.acted_at, n.reason, n.previous_value, n.new_value, n.field_name,
                   n.pdf_page, n.request_draft, n.learning_example, n.learning_approved_at,
                   u.full_name AS acted_by_name
            FROM discrepancy_notices n
            LEFT JOIN users u ON u.user_id = n.acted_by
            WHERE n.organization_id = @organization_id
              AND n.domain = @domain
              AND n.entity_id IN (${names.join(', ')})
        `, params);
        return groupBy(result.recordset, 'entity_id');
    } catch (err) {
        if (!isMissingObject(err)) throw err;
        return new Map();
    }
}

function mergeNotices(record, runs, resolutions) {
    const evaluated = evaluateDiscrepancy(DOMAIN, { ...record, ...optionalColumns(record) }, { runs: runs || [] });
    return evaluated.map((notice) => applyResolution(notice, pickResolution(notice, resolutions)));
}

function noticeKey(code, fingerprint) {
    return `${code || ''}\0${fingerprint || ''}`;
}

function historyRows(resolutions, notices) {
    const live = new Set((notices || []).map((notice) => noticeKey(notice.code, notice.fingerprint)));
    return (resolutions || []).filter((row) => {
        if (!row) return false;
        if (row.status === STATUS.CORRETTO) return true;
        return !live.has(noticeKey(row.rule_code, row.fingerprint));
    });
}

function trimValue(value) {
    return value == null ? '' : String(value).trim();
}

function locateCorrection({ record, runs, ruleCode, field, newValue, previousValue }) {
    const list = runs || [];
    const live = evaluateDiscrepancy(DOMAIN, record, { runs: list }).find((item) => item.code === ruleCode);
    if (live) return { mode: 'update', target: live };
    const column = field && CORREGGI_COLUMNS.has(field) && /^[a-z_]+$/.test(field) ? field : '';
    const next = trimValue(newValue);
    const previous = trimValue(previousValue);
    if (!column || !previous || previous === next || trimValue(record[column]) !== next) {
        return { mode: 'missing' };
    }
    const restored = { ...record, [column]: previous };
    const old = evaluateDiscrepancy(DOMAIN, restored, { runs: list }).find((item) => item.code === ruleCode);
    if (!old || old.field !== column) return { mode: 'missing' };
    return { mode: 'audit-only', target: old, field: column, previous, next };
}

function decorateRecord(record, runs, resolutions) {
    const notices = mergeNotices(record, runs, resolutions);
    const open = openNotices(notices);
    return {
        ...record,
        discrepancy_notices: notices,
        notice_history: historyRows(resolutions, notices),
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

function httpError(status, code, message) {
    const err = new Error(message);
    err.status = status;
    err.code = code;
    return err;
}

function schemaMissing(err) {
    if (!isMissingObject(err)) return false;
    const missing = new Error('Tabella avvisi non presente: applicare la migrazione 185 su TEST');
    missing.status = 503;
    missing.code = 'NOTICES_SCHEMA_MISSING';
    return missing;
}

async function loadWpqrRecord(organizationId, wpqrId) {
    const found = await query(`
        SELECT ${RECORD_COLUMNS},
               wq.other_test_info, wq.range_standard_reference,
               wq.material_group_range, wq.fillet_throat_range, wq.company_id
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
    return found.recordset && found.recordset[0];
}

async function saveNoticeRow(fields) {
    try {
        const existing = await query(`
            SELECT id, reason, request_draft, previous_value, new_value, field_name
            FROM discrepancy_notices
            WHERE organization_id = @organization_id
              AND domain = @domain
              AND entity_id = @entity_id
              AND rule_code = @rule_code
              AND fingerprint = @fingerprint
        `, fields);
        if (existing.recordset.length) {
            const prior = existing.recordset[0];
            const kept = {
                ...fields,
                id: prior.id,
                reason: fields.reason || prior.reason || null,
                request_draft: fields.request_draft || prior.request_draft || null,
                previous_value: fields.previous_value != null ? fields.previous_value : prior.previous_value,
                new_value: fields.new_value != null ? fields.new_value : prior.new_value,
                field_name: fields.field_name || prior.field_name || null,
            };
            await query(`
                UPDATE discrepancy_notices
                SET status = @status,
                    note = @note,
                    reason = @reason,
                    previous_value = @previous_value,
                    new_value = @new_value,
                    field_name = @field_name,
                    pdf_page = @pdf_page,
                    request_draft = @request_draft,
                    message_it = @message_it,
                    acted_by = @acted_by,
                    acted_at = SYSUTCDATETIME(),
                    updated_at = SYSUTCDATETIME()
                WHERE id = @id AND organization_id = @organization_id
            `, kept);
            return;
        }
        await query(`
            INSERT INTO discrepancy_notices (
                organization_id, domain, entity_id, rule_code, fingerprint, status, message_it,
                note, reason, previous_value, new_value, field_name, pdf_page, request_draft,
                acted_by, acted_at
            ) VALUES (
                @organization_id, @domain, @entity_id, @rule_code, @fingerprint, @status, @message_it,
                @note, @reason, @previous_value, @new_value, @field_name, @pdf_page, @request_draft,
                @acted_by, SYSUTCDATETIME()
            )
        `, fields);
    } catch (err) {
        const missing = schemaMissing(err);
        if (missing) throw missing;
        throw err;
    }
}

async function actOnWpqrNotice({
    organizationId, wpqrId, userId, action, ruleCode, note, reason, newValue, previousValue, field,
}) {
    const checked = texts.validateNoticeAction(action, { note, reason, new_value: newValue });
    if (!checked.ok) throw httpError(400, 'VALIDATION_ERROR', checked.error);
    if (!ruleCode) throw httpError(400, 'VALIDATION_ERROR', 'Codice avviso obbligatorio');
    if (!ACTION_TO_STATUS[action]) throw httpError(400, 'VALIDATION_ERROR', 'Azione non valida');

    const record = await loadWpqrRecord(organizationId, wpqrId);
    if (!record) throw httpError(404, 'WPQR_NOT_FOUND', 'WPQR non trovata');
    const runRows = (await loadRuns(organizationId, [wpqrId])).get(wpqrId) || [];
    let target = null;
    let auditOnly = null;
    if (action === 'correggi') {
        const located = locateCorrection({
            record,
            runs: runRows,
            ruleCode,
            field,
            newValue: checked.newValue,
            previousValue,
        });
        if (located.mode === 'missing') {
            throw httpError(404, 'NOTICE_NOT_FOUND', 'Avviso non più presente su questa WPQR');
        }
        target = located.target;
        if (located.mode === 'audit-only') auditOnly = located;
    } else {
        target = evaluateDiscrepancy(DOMAIN, record, { runs: runRows }).find((item) => item.code === ruleCode);
        if (!target) throw httpError(404, 'NOTICE_NOT_FOUND', 'Avviso non più presente su questa WPQR');
    }

    const page = texts.knownPdfPage(record);
    let status = ACTION_TO_STATUS[action];
    let previous = null;
    let next = null;
    let fieldName = null;
    let requestDraft = null;
    let savedRecord = record;

    if (action === 'correggi') {
        fieldName = auditOnly ? auditOnly.field : target.field;
        if (!CORREGGI_COLUMNS.has(fieldName) || !/^[a-z_]+$/.test(fieldName)) {
            throw httpError(400, 'VALIDATION_ERROR', texts.UI.fieldNotCorrectable);
        }
        if (auditOnly) {
            previous = auditOnly.previous;
            next = auditOnly.next;
        } else {
            previous = trimValue(record[fieldName]);
            next = checked.newValue;
            if (previous === next) throw httpError(400, 'VALIDATION_ERROR', texts.UI.valueUnchanged);
            await query(
                `UPDATE wpqr_records SET ${fieldName} = @value, updated_at = GETDATE() WHERE id = @id AND organization_id = @organization_id AND deleted_at IS NULL`,
                { value: next, id: wpqrId, organization_id: organizationId },
            );
            savedRecord = { ...record, [fieldName]: next };
        }
        try {
            await logEntityChange({
                organizationId,
                entityTable: 'wpqr_records',
                entityId: wpqrId,
                actionType: 'updated',
                actorUserId: userId || null,
                changes: [{ fieldName, oldValue: previous, newValue: next }],
            });
        } catch (err) {
            if (!isMissingObject(err)) throw err;
        }
        status = STATUS.CORRETTO;
    }

    if (action === 'segnala') {
        const code = record.wpqr_code || record.reference_number || '';
        if (checked.reason === 'documento_originale') {
            requestDraft = texts.draftRequest({ wpqrCode: code, note: checked.note, page }).slice(0, 1000);
        } else if (checked.reason === 'parere') {
            requestDraft = texts.parereDraft({ note: checked.note, page }).slice(0, 1000);
        }
    }

    await saveNoticeRow({
        organization_id: organizationId,
        domain: DOMAIN,
        entity_id: wpqrId,
        rule_code: ruleCode,
        fingerprint: target.fingerprint,
        status,
        message_it: target.message_it,
        note: checked.note,
        reason: checked.reason || null,
        previous_value: previous,
        new_value: next,
        field_name: fieldName,
        pdf_page: page,
        request_draft: requestDraft,
        acted_by: userId || null,
    });

    return noticesForWpqr(organizationId, savedRecord);
}

async function listWpqrSignals({ conditions, params, reason, status }) {
    const where = ['n.organization_id = @organization_id', 'n.domain = @domain', 'n.reason IS NOT NULL'];
    const bound = { ...params, domain: DOMAIN };
    if (reason) {
        if (!texts.REASON_IDS.has(reason)) throw httpError(400, 'VALIDATION_ERROR', 'Motivo non valido');
        where.push('n.reason = @reason');
        bound.reason = reason;
    }
    if (status) {
        if (!Object.values(STATUS).includes(status)) throw httpError(400, 'VALIDATION_ERROR', 'Stato non valido');
        where.push('n.status = @status');
        bound.status = status;
    }
    const scope = (conditions || []).join(' AND ');
    try {
        const result = await query(`
            SELECT n.id, n.entity_id, n.rule_code, n.status, n.reason, n.note, n.message_it,
                   n.acted_at, n.pdf_page, n.request_draft, n.learning_example, n.learning_approved_at,
                   n.previous_value, n.new_value, n.field_name,
                   wq.wpqr_code, wq.reference_number, wq.approval_status, wq.company_id,
                   u.full_name AS acted_by_name
            FROM discrepancy_notices n
            INNER JOIN wpqr_records wq
                ON wq.id = n.entity_id
               AND wq.organization_id = n.organization_id
               AND wq.deleted_at IS NULL
            LEFT JOIN users u ON u.user_id = n.acted_by
            WHERE ${where.join(' AND ')}
              AND ${scope || '1 = 1'}
            ORDER BY n.acted_at DESC
        `, bound);
        return result.recordset || [];
    } catch (err) {
        const missing = schemaMissing(err);
        if (missing) throw missing;
        throw err;
    }
}

async function approveLearningExample({ organizationId, noticeId, userId }) {
    let row;
    try {
        const found = await query(`
            SELECT n.id, n.entity_id, n.reason, n.status, n.note, n.message_it, n.learning_example
            FROM discrepancy_notices n
            WHERE n.id = @id AND n.organization_id = @organization_id AND n.domain = @domain
        `, { id: noticeId, organization_id: organizationId, domain: DOMAIN });
        row = found.recordset && found.recordset[0];
    } catch (err) {
        const missing = schemaMissing(err);
        if (missing) throw missing;
        throw err;
    }
    if (!row) throw httpError(404, 'NOTICE_NOT_FOUND', 'Segnalazione non trovata');
    if (row.reason !== 'lettura_app') {
        throw httpError(400, 'VALIDATION_ERROR', "L'esempio anonimo si approva solo per un errore di lettura dell'app.");
    }
    if (row.learning_example) {
        return { id: row.id, learning_example: row.learning_example, status: row.status };
    }
    const record = await loadWpqrRecord(organizationId, row.entity_id);
    const example = texts.anonymizeLearningExample(`${row.message_it || ''} ${row.note || ''}`, record || {});
    await query(`
        UPDATE discrepancy_notices
        SET learning_example = @example,
            learning_approved_at = SYSUTCDATETIME(),
            learning_approved_by = @user_id,
            updated_at = SYSUTCDATETIME()
        WHERE id = @id AND organization_id = @organization_id
    `, { id: row.id, organization_id: organizationId, example, user_id: userId || null });
    return { id: row.id, learning_example: example, status: row.status };
}

module.exports = {
    DOMAIN,
    ACTIONS,
    decorateWpqrRows,
    decorateRecord,
    classifyWpqrIds,
    noticesForWpqr,
    actOnWpqrNotice,
    locateCorrection,
    listWpqrSignals,
    approveLearningExample,
    pushIdFilter,
    mergeNotices,
};
