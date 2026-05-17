/**
 * welding.routes.js — Rotte Modulo Saldatura (WPS + WPQR)
 */
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/welding.controller');

router.use(authenticate);
router.use(requireLicensedModule('saldatura'));

// WPS
router.get   ('/welding/wps',     ctrl.listWPS);
router.get   ('/welding/wps/:id', ctrl.getWPS);
router.post  ('/welding/wps',     ctrl.createWPS);
router.put   ('/welding/wps/:id', ctrl.updateWPS);
router.delete('/welding/wps/:id', ctrl.deleteWPS);

// WPS Welders
router.get   ('/welding/wps/:id/welders',           ctrl.listWpsWelders);
router.post  ('/welding/wps/:id/welders',           ctrl.assignWpsWelder);
router.delete('/welding/wps/:id/welders/:welderId', ctrl.removeWpsWelder);

// WPQR
router.get   ('/welding/wpqr',     ctrl.listWPQR);
router.get   ('/welding/wpqr/:id', ctrl.getWPQR);
router.post  ('/welding/wpqr',     ctrl.createWPQR);
router.put   ('/welding/wpqr/:id', ctrl.updateWPQR);
router.delete('/welding/wpqr/:id', ctrl.deleteWPQR);

module.exports = router;
