/**
 * materialCertificates.routes.js — Material Compliance MC-4
 * Prefisso montato su /api/v1 → /api/v1/material-certificates
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireMaterialComplianceCapability } = require('../middleware/moduleLicense.middleware');
const { logAiInteraction } = require('../middleware/aiAuditTrail.middleware');
const ctrl = require('../controllers/materialCertificates.controller');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const aiExtractLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.OPENAI_IMPORT_RATE_LIMIT_MAX, 10) || 24,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppe richieste analisi AI da questo IP. Riprova tra qualche minuto.', code: 'AI_RATE_LIMIT' },
});

const storage = multer.diskStorage({
  destination(req, file, cb) {
    try {
      const dest = path.join(UPLOAD_DIR, 'material-certificates', String(req.user.organization_id));
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    } catch (e) {
      cb(e);
    }
  },
  filename(req, file, cb) {
    const stamp = Date.now();
    const ext = path.extname(file.originalname) || '.pdf';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);
    cb(null, `${stamp}_${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const ok =
      file.mimetype === 'application/pdf' ||
      String(file.originalname || '').toLowerCase().endsWith('.pdf');
    if (!ok) return cb(new Error('Solo file PDF consentiti'));
    cb(null, true);
  },
});

const uploadPdf = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.message && err.message.includes('Solo file PDF')) {
      return res.status(400).json({ error: err.message, code: 'UNSUPPORTED_MEDIA_TYPE' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File troppo grande (max 50 MB)', code: 'PAYLOAD_TOO_LARGE' });
    }
    return res.status(400).json({ error: err.message || 'Upload non valido' });
  });
};

router.use(authenticate);
router.use(requireMaterialComplianceCapability());

router.get('/material-certificates/stats', ctrl.getStats);
router.get('/material-certificates', ctrl.listCertificates);
router.get('/material-certificates/:id', ctrl.getCertificate);
router.post('/material-certificates', uploadPdf, ctrl.createCertificate);
router.patch('/material-certificates/:id', ctrl.patchCertificate);
router.post(
  '/material-certificates/:id/extract',
  aiExtractLimiter,
  logAiInteraction('import'),
  ctrl.extractCertificate
);
router.post('/material-certificates/:id/evaluate', ctrl.evaluateCertificate);
router.post('/material-certificates/:id/approve', ctrl.approveCertificate);
router.post('/material-certificates/:id/reject', ctrl.rejectCertificate);
router.post('/material-certificates/:id/archive', ctrl.archiveCertificate);

module.exports = router;
