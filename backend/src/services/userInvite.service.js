'use strict';

/**
 * userInvite.service — invito via email al primo accesso (UAL-3).
 *
 * Flusso: l'admin crea un utente SENZA impostare una password (createUser con
 * send_invite=true). Questo servizio genera un token (userActionToken.service,
 * tipo 'invite'), invia l'email con il link /accept-invite/:token riusando lo
 * stesso servizio SMTP già in produzione per gli alert (alertMail.service —
 * NON creato un provider email parallelo), e più avanti verifica/consuma il
 * token quando l'utente imposta la propria password (acceptInvite).
 *
 * Isolamento voluto (vedi piano UAL-3): NON tocca auth.controller.js né la
 * verifica password del login esistente. L'hashing usa bcrypt con lo stesso
 * numero di round (10) già in uso in admin.controller.js/auth.controller.js.
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { sendAlertEmail } = require('./alertMail.service');
const userActionTokenService = require('./userActionToken.service');
const userAuditService = require('./userAudit.service');

// Stesso pattern/env già in uso per i link email (contractReviewNotification.service.js).
const APP_BASE_URL = process.env.SGQ_APP_URL || 'https://systemgest.netlify.app';
const BCRYPT_ROUNDS = 10;

function buildInviteUrl(rawToken) {
    return `${APP_BASE_URL}/accept-invite/${rawToken}`;
}

function buildInviteEmailHtml({ fullName, inviteUrl, expiresHours }) {
    const greetName = fullName ? fullName.split(' ')[0] : '';
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1565c0">Sei stato invitato al Sistema Gestione ISO</h2>
        <p>Ciao${greetName ? ` ${greetName}` : ''},</p>
        <p>è stato creato un account per te sul Sistema Gestione ISO 9001. Per attivarlo devi impostare la tua password personale.</p>
        <p><a href="${inviteUrl}" style="background:#1565c0;color:#fff;padding:10px 16px;text-decoration:none;border-radius:4px;display:inline-block">Imposta la tua password</a></p>
        <p style="font-size:12px;color:#666">Link diretto: ${inviteUrl}</p>
        <p style="font-size:13px;color:#666">Il link è valido per ${expiresHours} ore. Se scade, chiedi all'amministratore di reinviare l'invito.</p>
        <p style="font-size:12px;color:#999">Se non ti aspettavi questa email, puoi ignorarla.</p>
      </div>`;
}

/** Hash bcrypt di una stringa casuale: nessuna password reale potrà mai corrispondere. */
async function generatePlaceholderPasswordHash() {
    return bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
}

/**
 * Genera un token di invito, lo salva e invia l'email. Non bloccante verso il
 * chiamante: eventuali errori (SMTP non configurato, invio fallito) vengono
 * loggati e rilanciati — è compito del chiamante decidere se trattarli come
 * non bloccanti per l'operazione principale (creazione utente).
 */
async function sendInviteEmail({ userId, email, fullName, organizationId, actorUserId = null, isResend = false }) {
    const { rawToken, expiresAt } = await userActionTokenService.createToken({
        userId,
        organizationId,
        tokenType: 'invite',
        createdBy: actorUserId,
    });

    const expiresHours = userActionTokenService.TOKEN_TTL_HOURS.invite;
    const inviteUrl = buildInviteUrl(rawToken);
    const html = buildInviteEmailHtml({ fullName, inviteUrl, expiresHours });
    const subject = '[SGQ] Invito ad attivare il tuo account';

    const sent = await sendAlertEmail(email, subject, html);
    if (!sent) {
        logger.warn('[UserInvite] Email invito non inviata (SMTP non configurato o errore)', { userId, email });
    }

    await userAuditService.logUserAuditEvent({
        organizationId,
        targetUserId: userId,
        actorUserId,
        action: isResend ? 'invite_resent' : 'invite_sent',
        fieldChanged: 'invite_token',
        newValue: { expires_at: expiresAt.toISOString() },
    });

    return { sent, expiresAt };
}

/**
 * Verifica un token di invito ricevuto dal frontend (pagina AcceptInvitePage).
 * Ritorna sempre un esito esplicito, mai un'eccezione per token invalido/scaduto.
 */
async function verifyInviteToken(rawToken) {
    const result = await userActionTokenService.verifyToken(rawToken, 'invite');
    if (!result.valid) {
        return { valid: false, reason: result.reason };
    }

    const userRes = await query(`
        SELECT user_id, email, full_name, is_active, pending_activation
        FROM users WHERE user_id = @user_id
    `, { user_id: result.row.user_id });
    const user = userRes.recordset[0];

    if (!user || !user.is_active) {
        return { valid: false, reason: 'USER_INACTIVE' };
    }
    if (!user.pending_activation) {
        // L'utente ha già impostato la password (invito già accettato in precedenza).
        return { valid: false, reason: 'ALREADY_ACTIVATED' };
    }

    return {
        valid: true,
        tokenId: result.row.id,
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
    };
}

/**
 * Accetta l'invito: verifica il token, imposta la password scelta dall'utente
 * (stesso hashing bcrypt/10 round del login esistente), consuma il token e
 * segna l'utente come attivato. Non genera un JWT/non effettua login automatico:
 * l'utente accede dalla pagina di login standard, per non toccare la logica
 * esistente di auth.controller.js.
 */
async function acceptInvite({ token, password }) {
    if (!password || String(password).length < 8) {
        return { success: false, error: 'Password: minimo 8 caratteri', code: 'VALIDATION_ERROR' };
    }

    const verification = await verifyInviteToken(token);
    if (!verification.valid) {
        return { success: false, error: inviteErrorMessage(verification.reason), code: verification.reason };
    }

    const password_hash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);

    await query(`
        UPDATE users SET password_hash = @password_hash, pending_activation = 0
        WHERE user_id = @user_id
    `, { user_id: verification.userId, password_hash });

    await userActionTokenService.consumeToken(verification.tokenId);

    const orgRes = await query(`SELECT organization_id FROM users WHERE user_id = @user_id`, { user_id: verification.userId });
    const organizationId = orgRes.recordset[0]?.organization_id;

    await userAuditService.logUserAuditEvent({
        organizationId,
        targetUserId: verification.userId,
        actorUserId: verification.userId,
        action: 'invite_accepted',
    });

    return { success: true, userId: verification.userId };
}

/** Messaggi utente-friendly (non tecnici) per il frontend AcceptInvitePage. */
function inviteErrorMessage(reason) {
    switch (reason) {
        case 'TOKEN_EXPIRED':
            return 'Il link di invito è scaduto. Chiedi all\'amministratore di inviartene uno nuovo.';
        case 'TOKEN_ALREADY_USED':
            return 'Questo link di invito è già stato usato. Se hai già impostato la password, prova ad accedere.';
        case 'ALREADY_ACTIVATED':
            return 'Questo account è già attivo. Prova ad accedere con la tua password.';
        case 'USER_INACTIVE':
            return 'Questo account non è attivo. Contatta l\'amministratore.';
        case 'TOKEN_NOT_FOUND':
        case 'TOKEN_MISSING':
        default:
            return 'Link di invito non valido. Chiedi all\'amministratore di inviartene uno nuovo.';
    }
}

module.exports = {
    generatePlaceholderPasswordHash,
    sendInviteEmail,
    verifyInviteToken,
    acceptInvite,
    inviteErrorMessage,
    buildInviteUrl,
};
