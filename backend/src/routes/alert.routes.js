/**
 * alert.routes.js — Rotte Alert Engine
 * Richiede licenza modulo 'documents' (include scadenze documenti e qualifiche).
 */

const express    = require('express');
const router     = express.Router();
const { authenticate }          = require('../middleware/auth.middleware');
const { useModuleLicense } = require('../middleware/moduleLicense.middleware');
const alertCtrl  = require('../controllers/alert.controller');

router.use(authenticate);
useModuleLicense(router, 'documents');

router.get('/alerts/count', alertCtrl.getAlertCount);
router.get('/alerts',       alertCtrl.getAlerts);

module.exports = router;
