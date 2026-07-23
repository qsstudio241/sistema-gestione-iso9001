/**
 * Invite Routes — accettazione invito email (UAL-3)
 *
 * Pubbliche (NO middleware authenticate): l'utente invitato non ha ancora un
 * account attivo/JWT. Montate su API_BASE con path che inizia per /auth così
 * da ereditare automaticamente lo stesso authLimiter anti-brute-force già
 * applicato a /auth/login e /auth/register (vedi server.js).
 * Volutamente in un file separato da auth.routes.js/auth.controller.js per
 * isolare la logica di attivazione account da quella di login esistente.
 */
const router = require('express').Router();
const inviteController = require('../controllers/invite.controller');

router.get('/auth/accept-invite/:token', inviteController.checkInviteToken);
router.post('/auth/accept-invite', inviteController.acceptInvite);

module.exports = router;
