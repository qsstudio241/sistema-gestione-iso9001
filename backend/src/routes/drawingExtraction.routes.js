const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/drawingExtraction.controller');

// Stessa licenza del riesame requisiti contratto (estrazione AI su commesse).
const guard = [authenticate, requireLicensedModule('ai_review')];

router.post('/cases/:caseId/analyze-documents', ...guard, ctrl.analyzeCaseDocuments);
router.post('/cases/:caseId/documents/:docId/extract', ...guard, ctrl.startExtraction);
router.get('/cases/:caseId/extractions', ...guard, ctrl.listExtractions);
router.get('/cases/:caseId/extracted-coverage', ...guard, ctrl.getCaseExtractedCoverage);
router.get('/cases/:caseId/extractions/:id', ...guard, ctrl.getExtraction);
router.get('/cases/:caseId/extracted-requirements-summary', ...guard, ctrl.getExtractedRequirementsSummary);
router.patch('/extracted-requirements/:id', ...guard, ctrl.reviewRequirement);

module.exports = router;
