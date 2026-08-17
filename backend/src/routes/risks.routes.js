/**
 * risks.routes.js — Rischi & Obiettivi ISO 9001 §6.1 + §6.2 + Contesto §4.1/§4.2
 * Sprint 6 + Slice 2 (context_factors, interested_parties)
 */

const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl    = require('../controllers/risks.controller');
const cfCtrl  = require('../controllers/contextFactors.controller');
const ipCtrl  = require('../controllers/interestedParties.controller');

const uploadM03Xlsx = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const name = String(file.originalname || '');
        const ok = /\.xlsx?$/i.test(name)
            || /spreadsheet|excel/.test(String(file.mimetype || ''));
        ok ? cb(null, true) : cb(new Error('Solo file Excel (.xlsx)'), false);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(authenticate);
router.use(requireLicensedModule('rischi'));

// ─── Risks ──────────────────────────────────────────────────────────────────
router.get('/risks/stats',  ctrl.getRiskStats);
router.get('/risks/import-template', ctrl.downloadM03Template);
router.put('/risks/pg-scale', ctrl.setCompanyPgScale);
router.post('/risks/detect-import', uploadM03Xlsx.single('file'), ctrl.detectRisksImport);
router.post('/risks/import', ctrl.importRisks);
router.get('/risks',        ctrl.listRisks);
router.get('/risks/:id/reviews', ctrl.listRiskReviews);
router.get('/risks/:id',    ctrl.getOneRisk);
router.post('/risks',       ctrl.createRisk);
router.put('/risks/:id',    ctrl.updateRisk);
router.delete('/risks/:id', ctrl.deleteRisk);

// ─── Objectives ─────────────────────────────────────────────────────────────
router.get('/objectives/stats',  ctrl.getObjectiveStats);
router.get('/objectives',        ctrl.listObjectives);
router.get('/objectives/:id',    ctrl.getOneObjective);
router.post('/objectives',       ctrl.createObjective);
router.put('/objectives/:id',    ctrl.updateObjective);
router.delete('/objectives/:id', ctrl.deleteObjective);

// ─── Context Factors §4.1 ────────────────────────────────────────────────────
router.get('/context-factors',        cfCtrl.listContextFactors);
router.get('/context-factors/:id',    cfCtrl.getOneContextFactor);
router.post('/context-factors',       cfCtrl.createContextFactor);
router.put('/context-factors/:id',    cfCtrl.updateContextFactor);
router.delete('/context-factors/:id', cfCtrl.deleteContextFactor);

// ─── Interested Parties §4.2 ─────────────────────────────────────────────────
router.get('/interested-parties',        ipCtrl.listInterestedParties);
router.get('/interested-parties/:id',    ipCtrl.getOneInterestedParty);
router.post('/interested-parties',       ipCtrl.createInterestedParty);
router.put('/interested-parties/:id',    ipCtrl.updateInterestedParty);
router.delete('/interested-parties/:id', ipCtrl.deleteInterestedParty);

module.exports = router;
