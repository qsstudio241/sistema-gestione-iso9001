/**
 * Attachment Routes
 */

const express = require('express');
const router = express.Router();
const attachmentController = require('../controllers/attachment.controller');
const { authenticate, authenticateDownload } = require('../middleware/auth.middleware');
const { upload } = require('../config/multer');

// Tutti gli endpoint richiedono autenticazione
// NOTA: /view e /download usano authenticateDownload (accetta anche ?token= per link diretti)
// Gli altri endpoint usano authenticate (solo Authorization: Bearer)

// GET /api/v1/attachments - Lista allegati con filtri
router.get('/attachments', authenticate, attachmentController.listAttachments);

// GET /api/v1/attachments/:id - Dettagli allegato
router.get('/attachments/:id', authenticate, attachmentController.getAttachmentById);

// GET /api/v1/attachments/:id/download - Download forzato (sempre attachment)
// authenticateDownload: accetta anche ?token= (per link diretti da browser)
router.get('/attachments/:id/download', authenticateDownload, attachmentController.downloadAttachment);

// GET /api/v1/attachments/:id/view - Preview inline (immagini/PDF si aprono nel browser)
// authenticateDownload: accetta anche ?token= (per <img src>, <a href> diretti)
router.get('/attachments/:id/view', authenticateDownload, attachmentController.viewAttachment);

// POST /api/v1/attachments/upload - Upload file
// Nota: multer middleware 'upload.single('file')' gestisce multipart/form-data
router.post('/attachments/upload', authenticate, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File troppo grande (max 10MB)', code: 'FILE_TOO_LARGE' });
            }
            return res.status(415).json({ error: err.message, code: 'UNSUPPORTED_MEDIA_TYPE' });
        }
        next();
    });
}, attachmentController.uploadAttachment);

// DELETE /api/v1/attachments/:id - Elimina allegato
router.delete('/attachments/:id', authenticate, attachmentController.deleteAttachment);

// PUT /api/v1/attachments/:id/replace - Sostituisce file allegato (desktop)
router.put('/attachments/:id/replace', authenticate, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File troppo grande (max 10MB)', code: 'FILE_TOO_LARGE' });
            }
            return res.status(415).json({ error: err.message, code: 'UNSUPPORTED_MEDIA_TYPE' });
        }
        next();
    });
}, attachmentController.replaceAttachment);

module.exports = router;
