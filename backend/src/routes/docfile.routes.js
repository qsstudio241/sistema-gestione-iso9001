/**
 * docfile.routes.js — Rotte file allegati ai documenti del registro
 * Sprint 2B
 */

const express = require('express');
const router = express.Router();
const { authenticate, authenticateDownload } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const { uploadDocFile } = require('../config/multer');
const ctrl = require('../controllers/docfile.controller');

const requireDocuments = requireLicensedModule('documents');

// Download: accetta Bearer o ?token= (link diretti, Office Online Viewer, <a download>)
router.get(
    '/documents/:docId/file/download',
    authenticateDownload,
    requireDocuments,
    ctrl.downloadDocFile
);
router.get(
    '/documents/:docId/file/:attId/download',
    authenticateDownload,
    requireDocuments,
    ctrl.downloadDocFile
);

// Lista / upload: solo Bearer
router.get(
    '/documents/:docId/files',
    authenticate,
    requireDocuments,
    ctrl.listDocFiles
);

const uploadDocFileMiddleware = (req, res, next) => {
    uploadDocFile.single('file')(req, res, function (err) {
        if (err) {
            if (err.message && err.message.includes('Formato non consentito per sicurezza')) {
                return res.status(415).json({ error: err.message, code: 'UNSUPPORTED_MEDIA_TYPE' });
            }
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'Il file supera il limite massimo di 200 MB', code: 'PAYLOAD_TOO_LARGE' });
            }
            return res.status(400).json({ error: err.message || 'Errore durante l\'upload del file', code: 'UPLOAD_ERROR' });
        }
        next();
    });
};

router.post(
    '/documents/:docId/file',
    authenticate,
    requireDocuments,
    uploadDocFileMiddleware,
    ctrl.uploadDocFile
);

module.exports = router;
