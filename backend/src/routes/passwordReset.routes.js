/**
 * Password Reset Routes — reset password self-service (UAL-4)
 *
 * Pubbliche (NO middleware authenticate): l'utente che ha scordato la password
 * non è autenticato. Montate su API_BASE con path che inizia per /auth così da
 * ereditare automaticamente lo stesso authLimiter anti-brute-force già applicato
 * a /auth/login e /auth/accept-invite (vedi server.js). Volutamente in un file
 * separato da auth.routes.js/invite.routes.js per isolare la logica di reset
 * password da quella di login e di attivazione invito.
 */
const router = require('express').Router();
const passwordResetController = require('../controllers/passwordReset.controller');

router.post('/auth/forgot-password', passwordResetController.forgotPassword);
router.get('/auth/reset-password/:token', passwordResetController.checkResetToken);
router.post('/auth/reset-password', passwordResetController.resetPassword);

module.exports = router;
