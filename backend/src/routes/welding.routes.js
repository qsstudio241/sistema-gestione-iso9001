/**
 * welding.routes.js — Rotte Modulo Saldatura (WPS + WPQR)
 */
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/welding.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authenticate);
router.use(requireLicensedModule('saldatura'));

// WPS — coverage PRIMA di /:id per evitare conflitti di routing
router.get   ('/welding/wps/coverage',  ctrl.getWpsCoverage);
router.get   ('/welding/wps',           ctrl.listWPS);
router.get   ('/welding/wps/:id',       ctrl.getWPS);
router.post  ('/welding/wps',           ctrl.createWPS);
router.put   ('/welding/wps/:id',       ctrl.updateWPS);
router.delete('/welding/wps/:id',       ctrl.deleteWPS);

// WPS Welders
router.get   ('/welding/wps/:id/welders',           ctrl.listWpsWelders);
router.post  ('/welding/wps/:id/welders',           ctrl.assignWpsWelder);
router.delete('/welding/wps/:id/welders/:welderId', ctrl.removeWpsWelder);

// WPQR — stats e upload-batch PRIMA di /:id
router.get   ('/welding/wpqr/stats',          ctrl.getWPQRStats);
router.post  ('/welding/wpqr/upload-batch',   upload.array('files', 20), ctrl.uploadWPQRBatch);
router.get   ('/welding/wpqr',                ctrl.listWPQR);
router.get   ('/welding/wpqr/:id',            ctrl.getWPQR);
router.post  ('/welding/wpqr',                ctrl.createWPQR);
router.put   ('/welding/wpqr/:id',            ctrl.updateWPQR);
router.delete('/welding/wpqr/:id',            ctrl.deleteWPQR);
router.post  ('/welding/wpqr/:id/approve',    ctrl.approveWPQR);
router.post  ('/welding/wpqr/:id/reject',     ctrl.rejectWPQR);

module.exports = router;
