/**
 * smoke.routes.js — Route smoke test remoto (senza auth JWT).
 *
 * Protetta esclusivamente dal token statico X-Smoke-Token (vedi smoke.controller.js).
 * NON montare router.use(authenticate): questa route deve essere raggiungibile
 * da GitHub Actions senza credenziali utente.
 *
 * Mount in server.js: app.get(`${API_BASE}/smoke/testdb`, smokeRoutes);
 */

const express = require('express');
const router = express.Router();
const smokeCtrl = require('../controllers/smoke.controller');

router.get('/smoke/testdb', smokeCtrl.testdb);

module.exports = router;
