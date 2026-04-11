/**
 * docfile.routes.js — Rotte file allegati ai documenti del registro
 * Sprint 2B
 */

const express       = require('express');
const router        = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { uploadDocFile } = require('../config/multer');
const ctrl          = require('../controllers/docfile.controller');

router.use(authenticate);

// Lista versioni file per documento
router.get('/documents/:docId/files', ctrl.listDocFiles);

// Upload nuova versione file
router.post('/documents/:docId/file', uploadDocFile.single('file'), ctrl.uploadDocFile);

// Download versione corrente (inline=1 per PDF viewer)
router.get('/documents/:docId/file/download', ctrl.downloadDocFile);

// Download versione specifica
router.get('/documents/:docId/file/:attId/download', ctrl.downloadDocFile);

module.exports = router;
