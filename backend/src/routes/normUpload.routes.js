/**
 * Norm Upload Routes
 * Base path: /api/v1
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const normUploadCtrl = require('../controllers/normUpload.controller');
const normChunker = require('../services/normChunker.service');
const logger = require('../utils/logger');

router.use(authenticate);
router.use(requireLicensedModule('documents'));

// Multer storage dedicato per norme: uploads/norms/{org_id}/
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const normStorage = multer.diskStorage({
  destination(req, file, cb) {
    const orgId = req.user?.organization_id || 'unknown';
    const normPath = path.join(UPLOAD_DIR, 'norms', String(orgId));
    if (!fs.existsSync(normPath)) fs.mkdirSync(normPath, { recursive: true });
    cb(null, normPath);
  },
  filename(req, file, cb) {
    const timestamp = Date.now();
    const rand = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9._\- ]/g, '_')
      .substring(0, 80);
    cb(null, `${timestamp}_${rand}_${base}${ext}`);
  },
});

const normFileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Solo file PDF consentiti per le norme'), false);
  }
};

const uploadNorms = multer({
  storage: normStorage,
  fileFilter: normFileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
});

router.post(
  '/documents/norms/upload',
  uploadNorms.array('files', 10),
  normUploadCtrl.uploadNorms
);

router.post('/documents/norms/reindex', async (req, res) => {
  const orgId = req.user.organization_id;
  try {
    logger.info(`[NormReindex] Starting reindex for org ${orgId}`);
    await normChunker.reindexAll(orgId);
    res.json({ success: true, message: 'Reindex completato' });
  } catch (err) {
    logger.error('[NormReindex] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
