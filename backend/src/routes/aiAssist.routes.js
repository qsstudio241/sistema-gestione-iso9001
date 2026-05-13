const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const { logAiInteraction } = require('../middleware/aiAuditTrail.middleware');
const ctrl = require('../controllers/aiAssist.controller');

// POST /ai/suggest — requires ai_assist license
router.post(
  '/ai/suggest',
  authenticate,
  requireLicensedModule('ai_assist'),
  logAiInteraction('assist'),
  ctrl.suggest
);

module.exports = router;
// Mount in server.js: app.use(API_BASE, aiAssistRoutes);
