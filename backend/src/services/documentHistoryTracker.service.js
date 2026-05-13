/**
 * Document History Tracker Service
 * Registra le modifiche ai documenti in document_history.
 * Tutte le funzioni sono fire-and-forget: loggano errori senza propagarli.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

async function _track(documentId, userId, changeType, fieldChanged, oldValue, newValue) {
    try {
        await query(`
            INSERT INTO document_history
                (document_id, changed_by, change_type, field_changed, old_value, new_value, changed_at)
            VALUES
                (@document_id, @changed_by, @change_type, @field_changed, @old_value, @new_value, GETDATE())
        `, {
            document_id:   parseInt(documentId),
            changed_by:    parseInt(userId),
            change_type:   changeType,
            field_changed: fieldChanged || null,
            old_value:     oldValue != null ? String(oldValue) : null,
            new_value:     newValue != null ? String(newValue) : null,
        });
    } catch (error) {
        logger.error('[DocumentHistory] track failed', {
            documentId, changeType, error: error.message,
        });
    }
}

async function trackCreation(documentId, userId) {
    return _track(documentId, userId, 'created', null, null, null);
}

async function trackUpdate(documentId, userId, fieldChanged, oldValue, newValue) {
    return _track(documentId, userId, 'updated', fieldChanged, oldValue, newValue);
}

async function trackStatusChange(documentId, userId, oldStatus, newStatus) {
    return _track(documentId, userId, 'status_changed', 'status', oldStatus, newStatus);
}

async function trackMove(documentId, userId, oldParentId, newParentId) {
    return _track(documentId, userId, 'moved', 'parent_id',
        oldParentId != null ? String(oldParentId) : '(root)',
        newParentId != null ? String(newParentId) : '(root)');
}

async function trackTagChange(documentId, userId, tagName, action) {
    const changeType = action === 'add' ? 'tagged' : 'untagged';
    return _track(documentId, userId, changeType, 'tag', null, tagName);
}

async function trackRelationChange(documentId, userId, relatedDocTitle, action) {
    const changeType = action === 'add' ? 'related' : 'unrelated';
    return _track(documentId, userId, changeType, 'relation', null, relatedDocTitle);
}

module.exports = {
    trackCreation,
    trackUpdate,
    trackStatusChange,
    trackMove,
    trackTagChange,
    trackRelationChange,
};
