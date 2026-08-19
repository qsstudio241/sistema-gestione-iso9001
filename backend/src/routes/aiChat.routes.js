const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticate, authenticateDownload, authorize } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const { logAiInteraction } = require('../middleware/aiAuditTrail.middleware');
const ctrl = require('../controllers/aiChat.controller');
const figureCtrl = require('../controllers/figureKnowledge.controller');

const FIGURE_QUERY_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const uploadFigureQuery = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const name = String(file.originalname || '').toLowerCase();
    const ok = FIGURE_QUERY_MIME.has(mime) || /\.(png|jpe?g|webp)$/.test(name);
    if (ok) cb(null, true);
    else cb(new Error('Solo immagini PNG, JPEG o WebP.'));
  },
});

function uploadFigureQueryMw(req, res, next) {
  uploadFigureQuery.single('file')(req, res, (err) => {
    if (err) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({
        error: tooBig ? 'Immagine troppo grande (max 4MB).' : (err.message || 'File non valido.'),
        code: tooBig ? 'FILE_TOO_LARGE' : 'INVALID_FILE',
      });
    }
    next();
  });
}

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

// POST /ai/figures/ingest — PDF già sul disco ? extract + persist (MR-3)
router.post(
  '/ai/figures/ingest',
  authenticate,
  requireLicensedModule('ai_chat'),
  figureCtrl.ingestFigures
);

// POST /ai/figures/search-by-image — ritaglio ? tavole (MR-4, prima di /:id/image)
router.post(
  '/ai/figures/search-by-image',
  authenticate,
  requireLicensedModule('ai_chat'),
  uploadFigureQueryMw,
  figureCtrl.searchFiguresByImage
);

// GET /ai/figures/:id/image — byte PNG (JWT header o ?token= per <img>)
router.get(
  '/ai/figures/:id/image',
  authenticateDownload,
  requireLicensedModule('ai_chat'),
  figureCtrl.getFigureImage
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
