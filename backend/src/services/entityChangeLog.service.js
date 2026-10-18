'use strict';

/**
 * Audit delle entità di business (migrazione 175, tabella entity_change_log).
 * Stessa regola di userAudit.service: la scrittura del log non blocca il CRUD.
 * Non registra il testo del PDF, i prompt AI né valori binari.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

const ACTIONS = new Set(['created', 'updated', 'soft_deleted', 'restored']);
const SKIP_FIELDS = new Set([
    'extracted_text', 'raw_response', 'prompt', 'file_buffer', 'password',
    'updated_at', 'created_at', 'deleted_at', 'deleted_by',
]);
const MAX_VALUE = 4000;

function notDeleted(alias) {
    return `${alias}.deleted_at IS NULL`;
}

function isTrashAdmin(user) {
    const role = String(user?.role || '').toLowerCase();
    return role === 'admin' || role === 'auditor' || role === 'superadmin';
}

/** Dettaglio di una riga cestinata: nascosto a chi non può aprire il cestino. */
function trashedDetailHidden(user, row) {
    return Boolean(row && row.deleted_at) && !isTrashAdmin(user);
}

function strictPositiveInt(raw) {
    if (typeof raw === 'number') {
        return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
    }
    if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return null;
    const n = Number(raw);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function storedValue(value) {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return null;
    if (typeof value === 'object') {
        try {
            const text = JSON.stringify(value);
            return text.length > MAX_VALUE ? text.slice(0, MAX_VALUE) : text;
        } catch (_) {
            return null;
        }
    }
    const text = String(value);
    return text.length > MAX_VALUE ? text.slice(0, MAX_VALUE) : text;
}

function valuesEqual(left, right) {
    return storedValue(left) === storedValue(right);
}

function changesFromRows(before, after, fields) {
    const source = Array.isArray(fields) && fields.length
        ? fields
        : Object.keys(after || {});
    return source
        .filter((field) => !SKIP_FIELDS.has(field) && !/prompt|extracted_text|raw_response/i.test(field))
        .filter((field) => after && Object.prototype.hasOwnProperty.call(after, field))
        .filter((field) => !valuesEqual(before ? before[field] : null, after[field]))
        .map((field) => ({
            fieldName: field,
            oldValue: before ? before[field] : null,
            newValue: after[field],
        }));
}

async function insertRows(rows) {
    for (const row of rows) {
        try {
            await query(`
                INSERT INTO entity_change_log
                    (organization_id, entity_table, entity_id, action_type, field_name, old_value, new_value, actor_user_id)
                VALUES
                    (@organization_id, @entity_table, @entity_id, @action_type, @field_name, @old_value, @new_value, @actor_user_id)
            `, row);
        } catch (err) {
            logger.error('[entityChangeLog] Scrittura log fallita (non bloccante)', {
                error: err.message,
                entity_table: row.entity_table,
                entity_id: row.entity_id,
                action_type: row.action_type,
            });
        }
    }
}

/**
 * Una riga per campo su created/updated. Soft delete e restore: una riga con prima/dopo.
 * @param {{organizationId:number, entityTable:string, entityId:number|string, actionType:string, actorUserId?:number|null, changes?:Array, before?:object|null, after?:object|null, fields?:string[]}} params
 */
async function logEntityChange({
    organizationId,
    entityTable,
    entityId,
    actionType,
    actorUserId = null,
    changes = null,
    before = null,
    after = null,
    fields = null,
}) {
    if (!ACTIONS.has(actionType)) {
        logger.warn('[entityChangeLog] action_type non valido, log saltato', { actionType, entityTable, entityId });
        return;
    }
    if (!organizationId || entityId == null || entityId === '' || !entityTable) {
        logger.warn('[entityChangeLog] parametri obbligatori mancanti, log saltato', {
            organizationId, entityTable, entityId, actionType,
        });
        return;
    }

    let list = Array.isArray(changes) ? changes : [];
    if (list.length === 0 && (actionType === 'created' || actionType === 'updated') && after) {
        list = changesFromRows(actionType === 'created' ? null : before, after, fields);
    }
    if (list.length === 0 && (actionType === 'soft_deleted' || actionType === 'restored' || actionType === 'created')) {
        list = [{ fieldName: null, oldValue: before ?? null, newValue: after ?? null }];
    }
    if (list.length === 0) return;

    await insertRows(list.map((change) => ({
        organization_id: organizationId,
        entity_table: entityTable,
        entity_id: String(entityId),
        action_type: actionType,
        field_name: change.fieldName ?? change.field_name ?? null,
        old_value: storedValue(change.oldValue ?? change.old_value),
        new_value: storedValue(change.newValue ?? change.new_value),
        actor_user_id: actorUserId || null,
    })));
}

function assertSqlName(name) {
    if (!/^[a-z_]+$/.test(name)) {
        throw new Error('Identificativo SQL non consentito');
    }
}

function softDeleteSql(table, idColumn, { hasOrg = true } = {}) {
    assertSqlName(table);
    assertSqlName(idColumn);
    const org = hasOrg ? ' AND organization_id = @organization_id' : '';
    return `UPDATE ${table} SET deleted_at = SYSUTCDATETIME(), deleted_by = @actor_user_id WHERE ${idColumn} = @id${org} AND deleted_at IS NULL`;
}

function restoreSql(table, idColumn, { hasOrg = true } = {}) {
    assertSqlName(table);
    assertSqlName(idColumn);
    const org = hasOrg ? ' AND organization_id = @organization_id' : '';
    return `UPDATE ${table} SET deleted_at = NULL, deleted_by = NULL WHERE ${idColumn} = @id${org} AND deleted_at IS NOT NULL`;
}

module.exports = {
    ACTIONS,
    notDeleted,
    isTrashAdmin,
    trashedDetailHidden,
    strictPositiveInt,
    storedValue,
    changesFromRows,
    logEntityChange,
    softDeleteSql,
    restoreSql,
};
