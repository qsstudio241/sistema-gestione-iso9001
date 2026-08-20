/**
 * importJobs.routes.js — Sprint 9
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const { logAiInteraction } = require('../middleware/aiAuditTrail.middleware');
const ctrl = require('../controllers/importJobs.controller');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
/** Allineato a MAX_IMPORT_JOB_FILES in app/src/utils/importFolderUpload.js */
const MAX_IMPORT_JOB_FILES = 80;

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
        const ext = path.extname(file.originalname) || '';
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 120);
        cb(null, `${stamp}_${base}${ext}`);
    },
});

const importUpload = multer({
    storage: importStorage,
    limits: { fileSize: 200 * 1024 * 1024, files: MAX_IMPORT_JOB_FILES },
    fileFilter(req, file, cb) {
        const name = String(file.originalname || '').trim();
        if (!name) return cb(new Error('Nome file mancante'));
        cb(null, true);
    },
});

const uploadImportMiddleware = (req, res, next) => {
    importUpload.array('files', MAX_IMPORT_JOB_FILES)(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File troppo grande (max 50 MB)', code: 'PAYLOAD_TOO_LARGE' });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({
                    error: `Troppi file (max ${MAX_IMPORT_JOB_FILES} per job).`,
                    code: 'LIMIT_FILE_COUNT',
                });
            }
            return res.status(400).json({ error: err.message || 'Upload non valido' });
        }
        next();
    });
};

router.use(authenticate);
router.use(authorize('admin'));
router.use(requireLicensedModule('ai_import'));

router.get('/import-jobs', ctrl.listJobs);
router.post('/import-jobs', ctrl.createJob);
router.get('/import-jobs/:id', ctrl.getJob);
router.delete('/import-jobs/:id', ctrl.deleteJob);
router.post('/import-jobs/:id/files', uploadImportMiddleware, ctrl.uploadFiles);
router.post('/import-jobs/:id/process', ctrl.processJob);
router.post('/import-jobs/:id/screen-and-place', ctrl.screenAndPlace);
router.post('/import-jobs/:id/files/:fileId/ai-extract', aiExtractLimiter, logAiInteraction('import'), ctrl.suggestAiExtraction);
router.patch('/import-jobs/:id/files/:fileId', ctrl.patchFile);
// Sprint 10: commit file processato al document_registry
router.post('/import-jobs/:id/files/:fileId/commit-to-registry',     ctrl.commitToRegistry);
// Commit file processato come qualifica personale, subito attiva (approval_status=approvata)
router.post('/import-jobs/:id/files/:fileId/commit-to-qualification', ctrl.commitToQualification);

module.exports = router;
