/**
 * Report Template Routes
 * Phase 2 - API template e assegnazioni
 */

const express = require('express');
const router = express.Router();
const reportTemplateController = require('../controllers/reportTemplate.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { uploadTemplate } = require('../config/multer');

router.use(authenticate);

// GET /api/v1/report-templates/resolve?standardId=1 (prima di /report-templates per match corretto)
router.get('/report-templates/resolve', reportTemplateController.resolveTemplate);

// GET /api/v1/report-templates/:id/file  (prima di GET lista: path più specifico)
router.get('/report-templates/:id/file', reportTemplateController.downloadTemplateFile);

// GET /api/v1/report-templates?scope=audit
router.get('/report-templates', reportTemplateController.listTemplates);

// GET /api/v1/report-template-assignments/standards
router.get('/report-template-assignments/standards', reportTemplateController.listStandardAssignments);

// GET /api/v1/report-template-assignments/nc
router.get('/report-template-assignments/nc', reportTemplateController.listNcAssignment);

// POST /api/v1/report-templates (upload .docx) - admin/auditor
router.post('/report-templates', authorize('admin', 'auditor'), uploadTemplate.single('file'), reportTemplateController.uploadTemplate);

// POST /api/v1/report-templates/:id/duplicate
router.post('/report-templates/:id/duplicate', authorize('admin', 'auditor'), reportTemplateController.duplicateTemplate);

// DELETE /api/v1/report-templates/:id
router.delete('/report-templates/:id', authorize('admin', 'auditor'), reportTemplateController.deleteTemplate);

// PUT /api/v1/report-template-assignments/standard/:standardId
router.put('/report-template-assignments/standard/:standardId', reportTemplateController.assignTemplateToStandard);

// PUT /api/v1/report-template-assignments/custom-checklist/:customChecklistId
router.put('/report-template-assignments/custom-checklist/:customChecklistId', reportTemplateController.assignTemplateToCustomChecklist);

// PUT /api/v1/report-template-assignments/nc
router.put('/report-template-assignments/nc', reportTemplateController.assignTemplateToNc);

module.exports = router;
