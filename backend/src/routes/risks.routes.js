/**
 * risks.routes.js — Rischi & Obiettivi ISO 9001 §6.1 + §6.2
 * Sprint 6
 */

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl    = require('../controllers/risks.controller');

router.use(authenticate);
router.use(requireLicensedModule('rischi'));

// ─── Risks ──────────────────────────────────────────────────────────────────
router.get('/risks/stats',  ctrl.getRiskStats);
router.get('/risks',        ctrl.listRisks);
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

module.exports = router;
