/**
 * Stato degli avvisi di discrepanza e effetto sulla conformità verificata.
 * Puro: nessun DB. Vale per WPQR e, con gli stessi stati, per i domini successivi.
 *
 * Un avviso aperto, in correzione o segnalato blocca la conformità verificata.
 * Confermato o corretto non blocca: un record approvato torna a contare.
 * Se il record è approvato e resta almeno un avviso che blocca, lo stato
 * effettivo è «da rivedere».
 */

'use strict';

const STATUS = Object.freeze({
    APERTO: 'aperto',
    CONFERMATO: 'confermato',
    IN_CORREZIONE: 'in_correzione',
    SEGNALATO: 'segnalato',
    CORRETTO: 'corretto',
});

const ACTION_TO_STATUS = Object.freeze({
    conferma: STATUS.CONFERMATO,
    correggi: STATUS.IN_CORREZIONE,
    segnala: STATUS.SEGNALATO,
});

const RESOLVED = new Set([STATUS.CONFERMATO, STATUS.CORRETTO]);

function isBlockingStatus(status) {
    return !RESOLVED.has(status || STATUS.APERTO);
}

function pickResolution(notice, rows) {
    if (!notice) return null;
    return (rows || []).find((row) => row
        && row.rule_code === notice.code
        && row.fingerprint
        && row.fingerprint === notice.fingerprint) || null;
}

function applyResolution(notice, row) {
    const base = notice || {};
    const same = row && row.fingerprint && row.fingerprint === base.fingerprint;
    const status = same ? row.status : STATUS.APERTO;
    return {
        ...base,
        status,
        blocks_conformity: isBlockingStatus(status),
        note: same ? (row.note || null) : null,
        reason: same ? (row.reason || null) : null,
        acted_by: same ? (row.acted_by || null) : null,
        acted_by_name: same ? (row.acted_by_name || null) : null,
        acted_at: same ? (row.acted_at || null) : null,
        previous_value: same ? (row.previous_value || null) : null,
        new_value: same ? (row.new_value || null) : null,
        field_name: same ? (row.field_name || null) : null,
        pdf_page: same ? (row.pdf_page || base.pdf_page || null) : (base.pdf_page || null),
        request_draft: same ? (row.request_draft || null) : null,
        learning_example: same ? (row.learning_example || null) : null,
        learning_approved_at: same ? (row.learning_approved_at || null) : null,
    };
}

function openNotices(notices) {
    return (notices || []).filter((n) => n && n.blocks_conformity !== false && isBlockingStatus(n.status));
}

function countsAsVerifiedConformity(approvalStatus, notices) {
    return approvalStatus === 'approvata' && openNotices(notices).length === 0;
}

function effectiveApprovalStatus(approvalStatus, notices) {
    if (approvalStatus === 'approvata' && openNotices(notices).length > 0) return 'da_rivedere';
    return approvalStatus || 'bozza';
}

module.exports = {
    STATUS,
    ACTION_TO_STATUS,
    RESOLVED,
    isBlockingStatus,
    pickResolution,
    applyResolution,
    openNotices,
    countsAsVerifiedConformity,
    effectiveApprovalStatus,
};
