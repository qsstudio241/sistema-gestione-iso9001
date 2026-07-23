'use strict';

/**
 * userPasswordReset.service — reset password self-service ("password dimenticata"),
 * UAL-4 (piano ciclo di vita account utente, Fase 2).
 *
 * Riusa la stessa infrastruttura token di UAL-3 (userActionToken.service, tabella
 * user_action_tokens, token_type='reset', TTL 1h già definito) — nessuna nuova
 * tabella né modifica alla migration 131. Stesso pattern di userInvite.service.js:
 * generazione token, invio email (alertMail.service), verifica senza consumo,
 * consumo alla conferma.
 *
 * Isolamento voluto (stesso vincolo di UAL-3): NON tocca auth.controller.js né
 * la verifica password del login esistente. L'hashing usa bcrypt con lo stesso
 * numero di round (10) già in uso in admin.controller.js/auth.controller.js.
 *
 * Vincolo di sicurezza specifico (anti user-enumeration): requestPasswordReset
 * non lancia MAI un'eccezione visibile al chiamante e non ritorna alcuna
 * informazione su esistenza/stato dell'account — il controller risponde sempre
 * con lo stesso messaggio generico, indipendentemente dall'esito interno.
 */
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { sendAlertEmail } = require('./alertMail.service');
const userActionTokenService = require('./userActionToken.service');
const userAuditService = require('./userAudit.service');

// Stesso pattern/env già in uso per i link email (userInvite.service.js).
const APP_BASE_URL = process.env.SGQ_APP_URL || 'https://systemgest.netlify.app';
const BCRYPT_ROUNDS = 10;

function buildResetUrl(rawToken) {
    return `${APP_BASE_URL}/reset-password/${rawToken}`;
}

function buildResetEmailHtml({ fullName, resetUrl, expiresHours }) {
    const greetName = fullName ? fullName.split(' ')[0] : '';
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1565c0">Reimposta la tua password</h2>
        <p>Ciao${greetName ? ` ${greetName}` : ''},</p>
        <p>abbiamo ricevuto una richiesta di reimpostazione password per il tuo account sul Sistema Gestione ISO 9001.</p>
        <p><a href="${resetUrl}" style="background:#1565c0;color:#fff;padding:10px 16px;text-decoration:none;border-radius:4px;display:inline-block">Imposta una nuova password</a></p>
        <p style="font-size:12px;color:#666">Link diretto: ${resetUrl}</p>
        <p style="font-size:13px;color:#666">Il link è valido per ${expiresHours} ora/e. Se scade, puoi richiederne uno nuovo dalla pagina di accesso.</p>
        <p style="font-size:12px;color:#999">Se non hai richiesto tu questa operazione, puoi ignorare questa email: la tua password resterà invariata.</p>
      </div>`;
}

/**
 * Richiede il reset password per un'email. Comportamento voluto per non
 * permettere la user-enumeration (vedi piano UAL Fase 2):
 * - email non registrata → nessuna azione DB/email, nessun errore visibile.
 * - email registrata ma account disattivato (utente o organizzazione) → nessuna
 *   azione DB/email (non deve trasparire che l'account esiste ma è disattivato).
 * - email registrata ma utente ancora pending_activation (invito non accettato,
 *   nessuna password reale da "resettare") → nessuna azione DB/email.
 * - email registrata, utente attivo e non pending → genera token 'reset' (1h),
 *   invia email, logga evento in user_audit_log.
 *
 * Non lancia MAI un'eccezione: qualunque errore interno (DB, SMTP, ecc.) viene
 * solo loggato. Il chiamante (controller) deve rispondere sempre con lo stesso
 * messaggio generico di successo, a prescindere dall'esito di questa funzione.
 */
async function requestPasswordReset(email) {
    try {
        if (!email || typeof email !== 'string') return;
        const trimmedEmail = email.trim();
        if (!trimmedEmail) return;

        // Un'email può teoricamente corrispondere a più account in organizzazioni
        // diverse (stesso caso già gestito esplicitamente dal login esistente,
        // che in tal caso richiede organization_id): qui processiamo ogni account
        // idoneo trovato, inviando un link di reset per ciascuno.
        const result = await query(`
            SELECT u.user_id, u.email, u.full_name, u.organization_id,
                   u.is_active, u.pending_activation,
                   o.is_active AS org_active
            FROM users u
            INNER JOIN organizations o ON u.organization_id = o.organization_id
            WHERE u.email = @email
        `, { email: trimmedEmail });

        const candidates = result.recordset || [];

        for (const user of candidates) {
            if (!user.is_active || !user.org_active) continue;
            if (user.pending_activation) continue;

            try {
                const { rawToken, expiresAt } = await userActionTokenService.createToken({
                    userId: user.user_id,
                    organizationId: user.organization_id,
                    tokenType: 'reset',
                    createdBy: null, // self-service: nessun admin coinvolto
                });

                const expiresHours = userActionTokenService.TOKEN_TTL_HOURS.reset;
                const resetUrl = buildResetUrl(rawToken);
                const html = buildResetEmailHtml({ fullName: user.full_name, resetUrl, expiresHours });
                const subject = '[SGQ] Reimposta la tua password';

                const sent = await sendAlertEmail(user.email, subject, html);
                if (!sent) {
                    logger.warn('[UserPasswordReset] Email reset non inviata (SMTP non configurato o errore)', {
                        userId: user.user_id,
                    });
                }

                await userAuditService.logUserAuditEvent({
                    organizationId: user.organization_id,
                    targetUserId: user.user_id,
                    actorUserId: user.user_id,
                    action: 'password_reset_requested',
                    fieldChanged: 'reset_token',
                    newValue: { expires_at: expiresAt.toISOString() },
                });
            } catch (innerErr) {
                // Un singolo account che fallisce (es. SMTP down) non deve bloccare
                // eventuali altri account idonei con la stessa email.
                logger.error('[UserPasswordReset] Errore generazione/invio token reset', {
                    userId: user.user_id, error: innerErr.message,
                });
            }
        }
    } catch (err) {
        // Copre errori di query/DB: mai propagati al chiamante (anti-enumeration).
        logger.error('[UserPasswordReset] requestPasswordReset errore interno (non propagato)', {
            error: err.message,
        });
    }
}

/**
 * Verifica un token di reset ricevuto dal frontend (pagina ResetPasswordPage),
 * prima di mostrare il form (stesso pattern di verifyInviteToken). Non consuma
 * il token. Ritorna sempre un esito esplicito, mai un'eccezione.
 */
async function verifyResetToken(rawToken) {
    const result = await userActionTokenService.verifyToken(rawToken, 'reset');
    if (!result.valid) {
        return { valid: false, reason: result.reason };
    }

    const userRes = await query(`
        SELECT user_id, email, full_name, organization_id, is_active
        FROM users WHERE user_id = @user_id
    `, { user_id: result.row.user_id });
    const user = userRes.recordset[0];

    if (!user || !user.is_active) {
        return { valid: false, reason: 'USER_INACTIVE' };
    }

    return {
        valid: true,
        tokenId: result.row.id,
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        organizationId: user.organization_id,
    };
}

/**
 * Completa il reset: verifica il token, imposta la nuova password scelta
 * dall'utente (stesso hashing bcrypt/10 round del login esistente), consuma
 * il token. Se l'utente era pending_activation=1 (caso limite: invito mai
 * accettato ma reset comunque richiesto e completato) lo marca come attivato,
 * coerentemente con UAL-3 — un reset password riuscito implica che l'utente
 * ha impostato una password reale e può accedere.
 * Non genera un JWT/non effettua login automatico: stessa scelta di UAL-3,
 * per non toccare la logica esistente di auth.controller.js.
 */
async function resetPassword({ token, newPassword }) {
    if (!newPassword || String(newPassword).length < 8) {
        return { success: false, error: 'Password: minimo 8 caratteri', code: 'VALIDATION_ERROR' };
    }

    const verification = await verifyResetToken(token);
    if (!verification.valid) {
        return { success: false, error: resetErrorMessage(verification.reason), code: verification.reason };
    }

    const password_hash = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);

    await query(`
        UPDATE users SET password_hash = @password_hash, pending_activation = 0
        WHERE user_id = @user_id
    `, { user_id: verification.userId, password_hash });

    await userActionTokenService.consumeToken(verification.tokenId);

    await userAuditService.logUserAuditEvent({
        organizationId: verification.organizationId,
        targetUserId: verification.userId,
        actorUserId: verification.userId,
        action: 'password_reset_completed',
    });

    return { success: true, userId: verification.userId };
}

/** Messaggi utente-friendly (non tecnici) per il frontend ResetPasswordPage. */
function resetErrorMessage(reason) {
    switch (reason) {
        case 'TOKEN_EXPIRED':
            return 'Il link per reimpostare la password è scaduto. Richiedine uno nuovo dalla pagina di accesso.';
        case 'TOKEN_ALREADY_USED':
            return 'Questo link è già stato utilizzato. Se hai già cambiato la password, prova ad accedere.';
        case 'USER_INACTIVE':
            return 'Questo account non è attivo. Contatta l\'amministratore.';
        case 'TOKEN_NOT_FOUND':
        case 'TOKEN_MISSING':
        default:
            return 'Link non valido. Richiedi un nuovo link dalla pagina di accesso.';
    }
}

module.exports = {
    requestPasswordReset,
    verifyResetToken,
    resetPassword,
    resetErrorMessage,
    buildResetUrl,
};
