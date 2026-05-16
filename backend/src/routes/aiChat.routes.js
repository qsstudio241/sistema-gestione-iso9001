const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const { logAiInteraction } = require('../middleware/aiAuditTrail.middleware');
const ctrl = require('../controllers/aiChat.controller');

// POST /ai/chat — chat assistente globale (richiede licenza ai_assist)
router.post(
  '/ai/chat',
  authenticate,
  requireLicensedModule('ai_assist'),
  logAiInteraction('chat'),
  ctrl.aiChat
);

// POST /ai/reindex — re-indicizzazione manuale (solo admin)
router.post(
  '/ai/reindex',
  authenticate,
  authorize('admin'),
  ctrl.aiReindex
);

module.exports = router;
