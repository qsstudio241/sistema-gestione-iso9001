/**
 * Organization routes — anagrafica tenant
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const organizationController = require('../controllers/organization.controller');
const { authenticate } = require('../middleware/auth.middleware');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const tmpDir = path.join(UPLOAD_DIR, 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        cb(null, tmpDir);
    },
    filename: (req, file, cb) => {
        const rand = crypto.randomBytes(6).toString('hex');
        cb(null, `tmp_org_logo_${Date.now()}_${rand}${path.extname(file.originalname)}`);
    },
});
const logoFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Solo immagini (jpg, png, gif, webp, svg)'), false);
};
const uploadLogo = multer({ storage: logoStorage, fileFilter: logoFilter, limits: { fileSize: 2 * 1024 * 1024 } });

router.use(authenticate);

router.get('/organizations/me', organizationController.getMyOrganization);
router.patch('/organizations/me', organizationController.patchMyOrganization);
router.get('/organizations/me/logo', organizationController.getLogo);
router.post('/organizations/me/logo', uploadLogo.single('logo'), organizationController.uploadLogo);
router.delete('/organizations/me/logo', organizationController.deleteLogo);

router.get('/doc-type-config', organizationController.getDocTypeConfig);
router.put('/doc-type-config', organizationController.saveDocTypeConfig);

module.exports = router;
