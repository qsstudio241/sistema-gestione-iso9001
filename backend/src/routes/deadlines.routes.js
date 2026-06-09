/**
 * deadlines.routes.js — Scadenzario da file (ADR-013)
 * Base: /api/v1
 */
'use strict';

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/deadlines.controller');

router.use(authenticate);
router.use(requireLicensedModule('documents'));

// Detect + import (scoped al documento)
router.post('/documents/:id/detect-deadlines',  ctrl.detectDeadlines);
router.post('/documents/:id/import-deadlines',  ctrl.importDeadlines);
router.get ('/documents/:id/deadline-config',   ctrl.getDeadlineConfig);

// Lista priority (route specifica prima di :itemId per evitare conflitti)
router.get ('/deadline-items/priority',          ctrl.getPriorityDeadlines);

// CRUD generico
router.get ('/deadline-items',                   ctrl.listDeadlineItems);
router.patch('/deadline-items/:itemId',          ctrl.updateDeadlineItem);
router.post ('/deadline-items/:itemId/complete', ctrl.completeDeadlineItem);
router.delete('/deadline-items/:itemId',         ctrl.deleteDeadlineItem);

module.exports = router;
