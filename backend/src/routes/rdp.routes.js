/**
 * rdp.routes.js — Rapporti di Prova (RDP, Scenario 4 — cliente Mason)
 * Licenza: bundle 'saldatura' (RDP e' una specializzazione del contesto ISO 3834/Mason).
 */
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/rdp.controller');

router.use(authenticate);
router.use(requireLicensedModule('saldatura'));

// Stats PRIMA di /:id
router.get('/rdp-reports/stats', ctrl.getRdpStats);

// CRUD rapporti
router.get   ('/rdp-reports',     ctrl.listRdpReports);
router.post  ('/rdp-reports',     ctrl.createRdpReport);
router.get   ('/rdp-reports/:id', ctrl.getRdpReport);
router.put   ('/rdp-reports/:id', ctrl.updateRdpReport);
router.delete('/rdp-reports/:id', ctrl.deleteRdpReport);

module.exports = router;
