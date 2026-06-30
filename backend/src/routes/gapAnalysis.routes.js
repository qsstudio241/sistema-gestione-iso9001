/**
 * gapAnalysis.routes.js — GET /gap-analysis
 * Requires: ai_norms license
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/gapAnalysis.controller');

router.get('/gap-analysis', authenticate, requireLicensedModule('ai_norms'), ctrl.getGapAnalysis);

module.exports = router;
