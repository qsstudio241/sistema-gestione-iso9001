/**
 * Company Routes - Fase 1 Multi-Tenant
 * CRUD aziende auditate
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const companyController = require('../controllers/company.controller');
const companyPersonnelController = require('../controllers/companyPersonnel.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Multer per upload logo (solo immagini, max 2MB, storage temporaneo)
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const tmpDir = path.join(UPLOAD_DIR, 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        cb(null, tmpDir);
    },
    filename: (req, file, cb) => {
        const rand = crypto.randomBytes(6).toString('hex');
        cb(null, `tmp_logo_${Date.now()}_${rand}${path.extname(file.originalname)}`);
    }
});
const logoFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Solo immagini (jpg, png, gif, webp, svg)'), false);
};
const uploadLogo = multer({ storage: logoStorage, fileFilter: logoFilter, limits: { fileSize: 2 * 1024 * 1024 } });

router.use(authenticate);

// Overview personale studio (slice S6) — prima delle route :id
router.get('/personnel', companyPersonnelController.listPersonnelStudio);

router.get('/companies', companyController.listCompanies);
router.get('/companies/:id', companyController.getCompanyById);
router.post('/companies', companyController.createCompany);
router.put('/companies/:id', companyController.updateCompany);
router.delete('/companies/:id', companyController.deleteCompany);

// Logo
router.get('/companies/:id/logo', companyController.getLogo);
router.post('/companies/:id/logo', uploadLogo.single('logo'), companyController.uploadLogo);
router.delete('/companies/:id/logo', companyController.deleteLogo);

// Personale azienda (ADR-012)
router.get('/companies/:companyId/personnel', companyPersonnelController.listPersonnel);
router.post('/companies/:companyId/personnel', companyPersonnelController.createPersonnel);
router.put('/companies/:companyId/personnel/:id', companyPersonnelController.updatePersonnel);
router.delete('/companies/:companyId/personnel/:id', companyPersonnelController.deletePersonnel);

module.exports = router;
