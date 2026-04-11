/**
 * qualifications.routes.js — Rotte Modulo Qualifiche
 */
const express  = require('express');
const router   = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl     = require('../controllers/qualifications.controller');

router.use(authenticate);
router.use(requireLicensedModule('qualifiche'));

router.get ('/qualifications/stats', ctrl.getStats);
router.get ('/qualifications',       ctrl.listQualifications);
router.get ('/qualifications/:id',   ctrl.getOne);
router.post('/qualifications',       ctrl.createQualification);
router.put ('/qualifications/:id',   ctrl.updateQualification);
router.delete('/qualifications/:id', ctrl.deleteQualification);

module.exports = router;
