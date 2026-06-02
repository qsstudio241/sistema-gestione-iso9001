'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { sendAlertEmail } = require('./alertMail.service');

const EVENT_PENDING_APPROVAL = 'pending_approval';
const EVENT_ASSIGNED = 'assigned';

const APP_BASE_URL =
    process.env.SGQ_APP_URL || 'https://systemgest.netlify.app';

function buildCaseDeepLink(caseUuid) {
    return `${APP_BASE_URL}/contract-reviews/${caseUuid}`;
}

function shouldNotifyPendingApproval(fromStatus, toStatus) {
    if (toStatus === 'QUOTE_APPROVAL') return true;
    if (fromStatus === 'FINAL_REVIEW' && toStatus === 'APPROVED') return true;
    return false;
}

async function resolveUserEmail(userId, organizationId) {
    if (!userId) return null;
    const r = await query(
        `SELECT email FROM users WHERE user_id = @userId AND organization_id = @organizationId AND is_active = 1`,
        { userId, organizationId },
    );
    return r.recordset[0]?.email || null;
}

async function insertNotification({
    organizationId,
    caseId,
    eventType,
    targetUserId,
    title,
    payload,
}) {
    const payloadJson = payload ? JSON.stringify(payload) : null;
    const ins = await query(
        `
        INSERT INTO commercial_case_notifications
            (organization_id, case_id, event_type, target_user_id, title, payload_json)
        OUTPUT INSERTED.*
        VALUES (@organizationId, @caseId, @eventType, @targetUserId, @title, @payloadJson)
        `,
        {
            organizationId,
            caseId,
            eventType,
            targetUserId: targetUserId || null,
            title: title ? String(title).substring(0, 200) : null,
            payloadJson,
        },
    );
    return ins.recordset[0];
}

async function sendNotificationEmail(notification, caseRow) {
    if (!notification || !notification.target_user_id) return false;
    const email = await resolveUserEmail(notification.target_user_id, notification.organization_id);
    if (!email) return false;

    const link = buildCaseDeepLink(caseRow.uuid);
    const subject = `[SGQ Riesame] ${notification.title || 'Azione richiesta'}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1e3a5f">${notification.title || 'Riesame requisiti'}</h2>
        <p>Caso: <strong>${caseRow.title || `#${caseRow.id}`}</strong></p>
        <p>Stato: ${caseRow.status}</p>
        <p><a href="${link}" style="background:#1e3a5f;color:#fff;padding:10px 16px;text-decoration:none;border-radius:4px">Apri caso</a></p>
        <p style="font-size:12px;color:#666">Link diretto: ${link}</p>
      </div>`;

    const sent = await sendAlertEmail(email, subject, html);
    if (sent) {
        await query(
            `UPDATE commercial_case_notifications SET email_sent_at = SYSUTCDATETIME() WHERE id = @id`,
            { id: notification.id },
        );
    }
    return sent;
}

/**
 * Dopo transizione stato — crea notifica pending_approval se applicabile.
 */
async function notifyAfterStatusTransition({
    organizationId,
    caseRow,
    fromStatus,
    toStatus,
    actorUserId,
}) {
    if (!shouldNotifyPendingApproval(fromStatus, toStatus)) return null;
    try {
        const title =
            toStatus === 'QUOTE_APPROVAL'
                ? 'Approvazione offerta richiesta'
                : 'Approvazione finale richiesta';
        const notification = await insertNotification({
            organizationId,
            caseId: caseRow.id,
            eventType: EVENT_PENDING_APPROVAL,
            targetUserId: caseRow.current_assignee_id,
            title,
            payload: { from_status: fromStatus, to_status: toStatus, actor_user_id: actorUserId },
        });
        await sendNotificationEmail(notification, caseRow);
        return notification;
    } catch (err) {
        logger.warn('[ContractReviewNotify] pending_approval failed', err.message);
        return null;
    }
}

/**
 * Dopo cambio assignee — crea notifica assigned.
 */
async function notifyAfterAssigneeChange({
    organizationId,
    caseRow,
    previousAssigneeId,
    newAssigneeId,
    actorUserId,
}) {
    if (!newAssigneeId || newAssigneeId === previousAssigneeId) return null;
    try {
        const notification = await insertNotification({
            organizationId,
            caseId: caseRow.id,
            eventType: EVENT_ASSIGNED,
            targetUserId: newAssigneeId,
            title: 'Caso Riesame assegnato a te',
            payload: {
                previous_assignee_id: previousAssigneeId,
                new_assignee_id: newAssigneeId,
                actor_user_id: actorUserId,
            },
        });
        await sendNotificationEmail(notification, caseRow);
        return notification;
    } catch (err) {
        logger.warn('[ContractReviewNotify] assigned failed', err.message);
        return null;
    }
}

module.exports = {
    EVENT_PENDING_APPROVAL,
    EVENT_ASSIGNED,
    shouldNotifyPendingApproval,
    notifyAfterStatusTransition,
    notifyAfterAssigneeChange,
    insertNotification,
    sendNotificationEmail,
    buildCaseDeepLink,
};
