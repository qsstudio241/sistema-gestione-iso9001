/**
 * ingestStaging.routes.js — revisione pre-commit IG-3
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/ingestStaging.controller');

router.use(authenticate);

router.get('/ingest-staging/learning-stats', ctrl.getLearningStats);
router.get('/ingest-staging/:id/file', ctrl.getStagingFile);
router.get('/ingest-staging/:id', ctrl.getStaging);
router.get('/ingest-staging', ctrl.listStaging);
router.post('/ingest-staging/:id/confirm', ctrl.confirmStaging);
router.post('/ingest-staging/:id/reject', ctrl.rejectStaging);

module.exports = router;
