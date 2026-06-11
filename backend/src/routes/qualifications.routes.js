/**
 * qualifications.routes.js — Rotte Modulo Qualifiche v2
 */
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl     = require('../controllers/qualifications.controller');

// ── Multer per certificati singoli ───────────────────────────────────────────
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const certStorage = multer.diskStorage({
    destination(req, file, cb) {
        const dest = path.join(UPLOAD_DIR, 'qualifications');
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename(req, file, cb) {
        const ext  = path.extname(file.originalname) || '.pdf';
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);
        cb(null, `qual_${Date.now()}_${base}${ext}`);
    },
});

const certUpload = multer({
    storage: certStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter(req, file, cb) {
        const ok = /\.(pdf|jpg|jpeg|png)$/i.test(file.originalname) ||
                   ['application/pdf','image/jpeg','image/png'].includes(file.mimetype);
        ok ? cb(null, true) : cb(new Error('Solo PDF o immagini consentiti'));
    },
});

const certUploadMiddleware = (req, res, next) => {
    certUpload.single('certificate')(req, res, err => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
};

// ── Multer per batch upload ───────────────────────────────────────────────────
const batchStorage = multer.diskStorage({
    destination(req, file, cb) {
        const dest = path.join(UPLOAD_DIR, 'qualifications');
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename(req, file, cb) {
        const ext  = path.extname(file.originalname) || '.pdf';
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);
        cb(null, `qual_${Date.now()}_${base}${ext}`);
    },
});

const batchUpload = multer({
    storage: batchStorage,
    limits: { fileSize: 50 * 1024 * 1024, files: 50 },
    fileFilter(req, file, cb) {
        const ok = /\.(pdf|jpg|jpeg|png)$/i.test(file.originalname) ||
                   ['application/pdf','image/jpeg','image/png'].includes(file.mimetype);
        ok ? cb(null, true) : cb(new Error('Solo PDF o immagini consentiti'));
    },
});

const batchUploadMiddleware = (req, res, next) => {
    batchUpload.array('files', 50)(req, res, err => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
};

// ── Routes ────────────────────────────────────────────────────────────────────
router.use(authenticate);
router.use(requireLicensedModule('qualifiche'));

// Stats, batch e coverage prima di /:id per evitare conflitti di routing
router.get ('/qualifications/stats',               ctrl.getStats);
router.get ('/qualifications/coverage',            ctrl.getCoverage);
router.post('/qualifications/upload-batch',        batchUploadMiddleware, ctrl.uploadBatch);
router.get ('/qualifications',                     ctrl.listQualifications);
router.get ('/qualifications/:id',                 ctrl.getOne);
router.post('/qualifications',                     ctrl.createQualification);
router.put ('/qualifications/:id',                 ctrl.updateQualification);
router.delete('/qualifications/:id',               ctrl.deleteQualification);

// Workflow approvazione
router.post('/qualifications/:id/approve',         ctrl.approveQualification);
router.post('/qualifications/:id/reject',          ctrl.rejectQualification);
router.post('/qualifications/:id/renew',           ctrl.renewQualification);

// Upload certificato e storico
router.post('/qualifications/:id/certificate',     certUploadMiddleware, ctrl.uploadCertificate);
router.get ('/qualifications/:id/history',         ctrl.getHistory);

module.exports = router;
