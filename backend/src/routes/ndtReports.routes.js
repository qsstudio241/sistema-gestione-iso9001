/**
 * ndtReports.routes.js — Verbali CND (VT/MT/PT/UT)
 */
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/ndtReports.controller');

router.use(authenticate);
router.use(requireLicensedModule('cnd'));

// Stats / eligibility PRIMA di /:id
router.get('/ndt-reports/stats', ctrl.getNdtStats);
router.get('/ndt-reports/inspector-eligibility', ctrl.getInspectorEligibility);

// CRUD verbali
router.get   ('/ndt-reports',     ctrl.listNdtReports);
router.post  ('/ndt-reports',     ctrl.createNdtReport);
router.get   ('/ndt-reports/:id', ctrl.getNdtReport);
router.put   ('/ndt-reports/:id', ctrl.updateNdtReport);
router.delete('/ndt-reports/:id', ctrl.deleteNdtReport);

module.exports = router;
