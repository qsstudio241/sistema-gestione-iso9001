/**
 * Password Reset Controller — reset password self-service (UAL-4)
 *
 * Endpoint PUBBLICI (nessun JWT): l'utente che ha scordato la password non è
 * autenticato. Isolato deliberatamente da auth.controller.js/invite.controller.js
 * per non mischiare la logica di login/JWT esistente con quella, distinta, di
 * reimpostazione password via token (stesso pattern di isolamento di UAL-3).
 */
const logger = require('../utils/logger');
const userPasswordResetService = require('../services/userPasswordReset.service');

// Messaggio generico invariato per email esistente/inesistente/disattivata/pending
// (protezione anti user-enumeration — vincolo esplicito piano UAL Fase 2).
const GENERIC_SUCCESS_MESSAGE = 'Se l\'indirizzo è registrato, riceverai un\'email con le istruzioni per reimpostare la password.';

/**
 * POST /api/v1/auth/forgot-password
 * Body: { email }
 * Risponde SEMPRE con lo stesso messaggio generico di successo, indipendentemente
 * dal fatto che l'email esista, sia disattivata o pending_activation.
 */
async function forgotPassword(req, res) {
    const { email } = req.body || {};

    try {
        if (email && typeof email === 'string' && email.trim()) {
            await userPasswordResetService.requestPasswordReset(email.trim());
        }
    } catch (error) {
        // Il service non dovrebbe mai lanciare, ma per difesa in profondità
        // logghiamo qui e rispondiamo comunque con lo stesso messaggio generico.
        logger.error('PasswordReset forgotPassword error', { error: error.message });
    }

    res.json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
}

/**
 * GET /api/v1/auth/reset-password/:token
 * Verifica preliminare (per la UI, prima di far compilare il form): il token
 * è valido? Non consuma il token. Stesso pattern di GET /auth/accept-invite/:token.
 */
async function checkResetToken(req, res) {
    try {
        const { token } = req.params;
        const result = await userPasswordResetService.verifyResetToken(token);
        if (!result.valid) {
            return res.status(400).json({
                success: false,
                error: userPasswordResetService.resetErrorMessage(result.reason),
                code: result.reason,
            });
        }
        res.json({
            success: true,
            data: { email: result.email },
        });
    } catch (error) {
        logger.error('PasswordReset checkResetToken error', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Errore verifica del link',
            code: 'RESET_CHECK_ERROR',
        });
    }
}

/**
 * POST /api/v1/auth/reset-password
 * Body: { token, newPassword }
 * Imposta la nuova password scelta dall'utente e consuma il token.
 */
async function resetPassword(req, res) {
    try {
        const { token, newPassword } = req.body || {};
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token mancante',
                code: 'VALIDATION_ERROR',
            });
        }

        const result = await userPasswordResetService.resetPassword({ token, newPassword });
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error,
                code: result.code,
            });
        }

        logger.info('Password reset completed', { user_id: result.userId });
        res.json({
            success: true,
            message: 'Password reimpostata con successo. Ora puoi accedere.',
        });
    } catch (error) {
        logger.error('PasswordReset resetPassword error', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Errore durante il reset della password',
            code: 'RESET_PASSWORD_ERROR',
        });
    }
}

module.exports = { forgotPassword, checkResetToken, resetPassword };
