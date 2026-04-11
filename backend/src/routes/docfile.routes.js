/**
 * docfile.routes.js — Rotte file allegati ai documenti del registro
 * Sprint 2B
 */

const express       = require('express');
const router        = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const { uploadDocFile } = require('../config/multer');
const ctrl          = require('../controllers/docfile.controller');

router.use(authenticate);
router.use(requireLicensedModule('documents'));

// Lista versioni file per documento
router.get('/documents/:docId/files', ctrl.listDocFiles);

// Wrappo uploadDocFile.single per gestire l'errore Multer e restituire 415 invece di 500
const uploadDocFileMiddleware = (req, res, next) => {
    uploadDocFile.single('file')(req, res, function (err) {
        if (err) {
            // Se l'errore è generato dal nostro fileFilter in multer.js
            if (err.message && err.message.includes('Formato non consentito per sicurezza')) {
                return res.status(415).json({ error: err.message, code: 'UNSUPPORTED_MEDIA_TYPE' });
            }
            // Altri errori di Multer (es. file troppo grande)
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File troppo grande. Il limite è 500 MB.', code: 'PAYLOAD_TOO_LARGE' });
            }
            return res.status(400).json({ error: err.message || 'Errore durante l\'upload del file', code: 'UPLOAD_ERROR' });
        }
        next();
    });
};

// Upload nuova versione file
router.post('/documents/:docId/file', uploadDocFileMiddleware, ctrl.uploadDocFile);

// Download versione corrente (inline=1 per PDF viewer)
router.get('/documents/:docId/file/download', ctrl.downloadDocFile);

// Download versione specifica
router.get('/documents/:docId/file/:attId/download', ctrl.downloadDocFile);

module.exports = router;
