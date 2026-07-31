/**
 * welding.routes.js — Rotte Modulo Saldatura (WPS + WPQR)
 */
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/welding.controller');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const wpqrStorage = multer.diskStorage({
    destination(req, file, cb) {
        const dest = path.join(UPLOAD_DIR, 'wpqr');
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename(req, file, cb) {
        const ext  = path.extname(file.originalname) || '.pdf';
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);
        cb(null, `wpqr_${Date.now()}_${base}${ext}`);
    },
});

const wpsStorage = multer.diskStorage({
    destination(req, file, cb) {
        const dest = path.join(UPLOAD_DIR, 'wps');
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename(req, file, cb) {
        const ext  = path.extname(file.originalname) || '.pdf';
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);
        cb(null, `wps_${Date.now()}_${base}${ext}`);
    },
});

const upload = multer({
    storage: wpqrStorage,
    limits: { fileSize: 50 * 1024 * 1024, files: 20 },
    fileFilter(req, file, cb) {
        const ok = /\.(pdf|jpg|jpeg|png)$/i.test(file.originalname) ||
                   ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype);
        ok ? cb(null, true) : cb(new Error('Solo PDF o immagini consentiti'));
    },
});

const uploadWps = multer({
    storage: wpsStorage,
    limits: { fileSize: 50 * 1024 * 1024, files: 20 },
    fileFilter(req, file, cb) {
        const ok = /\.(pdf|jpg|jpeg|png)$/i.test(file.originalname) ||
                   ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype);
        ok ? cb(null, true) : cb(new Error('Solo PDF o immagini consentiti'));
    },
});

router.use(authenticate);
router.use(requireLicensedModule('saldatura'));

// WPS — path statici (generate/coverage/upload) PRIMA di /:id
router.post  ('/welding/wps/upload-batch',   uploadWps.array('files', 20), ctrl.uploadWPSBatch);
router.post  ('/welding/wps/generate',  ctrl.generateWPS);
router.get   ('/welding/wps/coverage',  ctrl.getWpsCoverage);
router.get   ('/welding/wps',           ctrl.listWPS);
router.get   ('/welding/wps/:id',       ctrl.getWPS);
router.post  ('/welding/wps',           ctrl.createWPS);
router.put   ('/welding/wps/:id',       ctrl.updateWPS);
router.delete('/welding/wps/:id',       ctrl.deleteWPS);

// WPS Welders
router.get   ('/welding/wps/:id/welders',           ctrl.listWpsWelders);
router.post  ('/welding/wps/:id/welders',           ctrl.assignWpsWelder);
router.delete('/welding/wps/:id/welders/:welderId', ctrl.removeWpsWelder);

// WPQR — stats e upload-batch PRIMA di /:id
router.get   ('/welding/wpqr/stats',          ctrl.getWPQRStats);
router.post  ('/welding/wpqr/upload-batch',   upload.array('files', 20), ctrl.uploadWPQRBatch);
router.get   ('/welding/wpqr',                ctrl.listWPQR);
router.get   ('/welding/wpqr/:id',            ctrl.getWPQR);
router.post  ('/welding/wpqr',                ctrl.createWPQR);
router.put   ('/welding/wpqr/:id',            ctrl.updateWPQR);
router.delete('/welding/wpqr/:id',            ctrl.deleteWPQR);
router.post  ('/welding/wpqr/:id/approve',    ctrl.approveWPQR);
router.post  ('/welding/wpqr/:id/reject',     ctrl.rejectWPQR);

module.exports = router;
