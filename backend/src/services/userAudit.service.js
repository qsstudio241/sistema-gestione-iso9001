/**
 * userAudit.service — audit trail gestione utenti (UAL-2).
 * Scrive eventi in user_audit_log (migration 130): chi ha fatto cosa e quando
 * su un utente (creazione, modifica ruolo/dati, attivazione/disattivazione,
 * standard consentiti, accessi azienda cliente).
 *
 * Regola vincolante: MAI bloccante. Se la scrittura del log fallisce, l'operazione
 * CRUD principale sull'utente deve comunque riuscire — l'errore viene solo loggato
 * a livello applicativo (Winston), non propagato al chiamante.
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');

const VALID_ACTIONS = new Set([
    'user_created', 'role_changed', 'profile_updated', 'auditor_org_changed',
    'password_reset_by_admin', 'activated', 'deactivated', 'standards_updated',
    'company_access_granted', 'company_access_updated', 'company_access_revoked',
]);

/**
 * Registra un evento nell'audit trail utenti. Non lancia mai eccezioni:
 * in caso di errore, lo registra nel logger applicativo e ritorna silenziosamente.
 * @param {{organizationId:number, targetUserId:number, actorUserId?:number|null, action:string, fieldChanged?:string|null, oldValue?:unknown, newValue?:unknown}} params
 */
async function logUserAuditEvent({
    organizationId,
    targetUserId,
    actorUserId = null,
    action,
    fieldChanged = null,
    oldValue = null,
    newValue = null,
}) {
    try {
        if (!VALID_ACTIONS.has(action)) {
            logger.warn('[userAudit] action_type non valido, log saltato', { action, targetUserId });
            return;
        }
        if (!organizationId || !targetUserId) {
            logger.warn('[userAudit] parametri obbligatori mancanti, log saltato', { organizationId, targetUserId, action });
            return;
        }

        const toStoredValue = (v) => {
            if (v === null || v === undefined) return null;
            return typeof v === 'string' ? v : JSON.stringify(v);
        };

        await query(`
            INSERT INTO user_audit_log
                (organization_id, target_user_id, actor_user_id, action_type, field_changed, old_value, new_value)
            VALUES
                (@organization_id, @target_user_id, @actor_user_id, @action_type, @field_changed, @old_value, @new_value)
        `, {
            organization_id: organizationId,
            target_user_id: targetUserId,
            actor_user_id: actorUserId,
            action_type: action,
            field_changed: fieldChanged,
            old_value: toStoredValue(oldValue),
            new_value: toStoredValue(newValue),
        });
    } catch (err) {
        // Non bloccante per design: l'operazione principale (CRUD utente) prosegue comunque.
        logger.error('[userAudit] Scrittura log fallita (non bloccante)', {
            error: err.message, action, targetUserId, organizationId,
        });
    }
}

/**
 * Legge lo storico eventi per un utente (ordine cronologico inverso).
 * Propaga eventuali errori: qui è una lettura, non un'operazione principale da proteggere.
 */
async function getUserAuditLog(targetUserId, organizationId, limit = 100) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
    const rows = await query(`
        SELECT TOP (@limit)
            ual.id, ual.action_type, ual.field_changed, ual.old_value, ual.new_value, ual.created_at,
            ual.actor_user_id, actor.full_name AS actor_name, actor.email AS actor_email
        FROM user_audit_log ual
        LEFT JOIN users actor ON actor.user_id = ual.actor_user_id
        WHERE ual.target_user_id = @target_user_id AND ual.organization_id = @organization_id
        ORDER BY ual.created_at DESC, ual.id DESC
    `, { target_user_id: targetUserId, organization_id: organizationId, limit: safeLimit });
    return rows.recordset || [];
}

module.exports = { logUserAuditEvent, getUserAuditLog, VALID_ACTIONS };
