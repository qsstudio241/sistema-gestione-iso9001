/**
 * importJobs.routes.js — Sprint 9
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/importJobs.controller');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

/** Limita costi API OpenAI (per IP) */
const aiExtractLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.OPENAI_IMPORT_RATE_LIMIT_MAX, 10) || 24,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Troppe richieste analisi AI da questo IP. Riprova tra qualche minuto.', code: 'AI_RATE_LIMIT' },
});

function importDestination(req, file, cb) {
    try {
        const orgId = req.user.organization_id;
        const jobId = req.params.id;
        const dest = path.join(UPLOAD_DIR, 'imports', String(orgId), String(jobId));
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    } catch (e) {
        cb(e);
    }
}

const importStorage = multer.diskStorage({
    destination: importDestination,
    filename(req, file, cb) {
        const stamp = Date.now();
        const ext = path.extname(file.originalname) || '.pdf';
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 120);
        cb(null, `${stamp}_${base}${ext}`);
    },
});

const importUpload = multer({
    storage: importStorage,
    limits: { fileSize: 50 * 1024 * 1024, files: 30 },
    fileFilter(req, file, cb) {
        const ok =
            file.mimetype === 'application/pdf' ||
            file.originalname.toLowerCase().endsWith('.pdf');
        if (!ok) return cb(new Error('Solo file PDF consentiti'));
        cb(null, true);
    },
});

const uploadImportMiddleware = (req, res, next) => {
    importUpload.array('files', 30)(req, res, (err) => {
        if (err) {
            if (err.message && err.message.includes('Solo file PDF')) {
                return res.status(415).json({ error: err.message, code: 'UNSUPPORTED_MEDIA_TYPE' });
            }
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File troppo grande (max 50 MB)', code: 'PAYLOAD_TOO_LARGE' });
            }
            return res.status(400).json({ error: err.message || 'Upload non valido' });
        }
        next();
    });
};

router.use(authenticate);
router.use(requireLicensedModule('ai_import'));

router.get('/import-jobs', ctrl.listJobs);
router.post('/import-jobs', ctrl.createJob);
router.get('/import-jobs/:id', ctrl.getJob);
router.delete('/import-jobs/:id', ctrl.deleteJob);
router.post('/import-jobs/:id/files', uploadImportMiddleware, ctrl.uploadFiles);
router.post('/import-jobs/:id/process', ctrl.processJob);
router.post('/import-jobs/:id/files/:fileId/ai-extract', aiExtractLimiter, ctrl.suggestAiExtraction);
router.patch('/import-jobs/:id/files/:fileId', ctrl.patchFile);

module.exports = router;
