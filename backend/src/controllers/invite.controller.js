/**
 * Invite Controller — accettazione invito email (UAL-3)
 *
 * Endpoint PUBBLICI (nessun JWT): l'utente invitato non è ancora autenticato.
 * Isolato deliberatamente da auth.controller.js per non mischiare la logica
 * di login/JWT esistente con quella, distinta, di attivazione account via token.
 */
const logger = require('../utils/logger');
const userInviteService = require('../services/userInvite.service');

/**
 * GET /api/v1/auth/accept-invite/:token
 * Verifica preliminare (per la UI, prima di far compilare il form): il token
 * è valido? Non consuma il token.
 */
async function checkInviteToken(req, res) {
    try {
        const { token } = req.params;
        const result = await userInviteService.verifyInviteToken(token);
        if (!result.valid) {
            return res.status(400).json({
                success: false,
                error: userInviteService.inviteErrorMessage(result.reason),
                code: result.reason,
            });
        }
        res.json({
            success: true,
            data: { email: result.email, full_name: result.fullName },
        });
    } catch (error) {
        logger.error('Invite checkInviteToken error', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Errore verifica invito',
            code: 'INVITE_CHECK_ERROR',
        });
    }
}

/**
 * POST /api/v1/auth/accept-invite
 * Body: { token, password }
 * Imposta la password scelta dall'utente e attiva l'account.
 */
async function acceptInvite(req, res) {
    try {
        const { token, password } = req.body || {};
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token mancante',
                code: 'VALIDATION_ERROR',
            });
        }

        const result = await userInviteService.acceptInvite({ token, password });
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error,
                code: result.code,
            });
        }

        logger.info('Invite accepted', { user_id: result.userId });
        res.json({
            success: true,
            message: 'Password impostata con successo. Ora puoi accedere.',
        });
    } catch (error) {
        logger.error('Invite acceptInvite error', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Errore durante l\'attivazione dell\'account',
            code: 'INVITE_ACCEPT_ERROR',
        });
    }
}

module.exports = { checkInviteToken, acceptInvite };
