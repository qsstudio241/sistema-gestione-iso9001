/**
 * qualifications.routes.js — Rotte Modulo Qualifiche v2
 */
const express  = require('express');
const router   = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl     = require('../controllers/qualifications.controller');

router.use(authenticate);
router.use(requireLicensedModule('qualifiche'));

// Stats e coverage prima di /:id per evitare conflitti di routing
router.get ('/qualifications/stats',       ctrl.getStats);
router.get ('/qualifications/coverage',    ctrl.getCoverage);
router.get ('/qualifications',             ctrl.listQualifications);
router.get ('/qualifications/:id',         ctrl.getOne);
router.post('/qualifications',             ctrl.createQualification);
router.put ('/qualifications/:id',         ctrl.updateQualification);
router.delete('/qualifications/:id',       ctrl.deleteQualification);

// Workflow approvazione
router.post('/qualifications/:id/approve', ctrl.approveQualification);
router.post('/qualifications/:id/reject',  ctrl.rejectQualification);
router.post('/qualifications/:id/renew',   ctrl.renewQualification);

module.exports = router;
