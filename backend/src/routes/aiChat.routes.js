const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const { logAiInteraction } = require('../middleware/aiAuditTrail.middleware');
const ctrl = require('../controllers/aiChat.controller');
const figureCtrl = require('../controllers/figureKnowledge.controller');

// POST /ai/chat — chat assistente globale (richiede licenza ai_chat)
router.post(
  '/ai/chat',
  authenticate,
  requireLicensedModule('ai_chat'),
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

// GET /ai/figures/search — testo -> tavola (CLIP locale, licenza ai_chat)
router.get(
  '/ai/figures/search',
  authenticate,
  requireLicensedModule('ai_chat'),
  figureCtrl.searchFigures
);

// GET /ai/ambito-facts — snapshot fatti Ambito (licenza ai_chat, zero LLM)
router.get(
  '/ai/ambito-facts',
  authenticate,
  requireLicensedModule('ai_chat'),
  ctrl.getAmbitoFacts
);

// GET /ai/knowledge-health — KPI salute knowledge base (solo admin)
router.get(
  '/ai/knowledge-health',
  authenticate,
  authorize('admin'),
  ctrl.knowledgeHealth
);

module.exports = router;
