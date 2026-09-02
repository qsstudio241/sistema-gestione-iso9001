/**
 * Routes — template checklist Riesame requisiti (ING-4)
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/commercialChecklistTemplate.controller');

const guard = [authenticate, requireLicensedModule('ai_review')];
const writeGuard = [...guard, authorize('admin', 'auditor')];

router.get('/commercial-checklist-templates', ...guard, ctrl.listTemplates);
router.get('/commercial-checklist-templates/resolve', ...guard, ctrl.resolvePreview);
router.get('/commercial-checklist-templates/:id', ...guard, ctrl.getTemplate);
router.post('/commercial-checklist-templates', ...writeGuard, ctrl.createTemplate);
router.put('/commercial-checklist-templates/:id', ...writeGuard, ctrl.updateTemplate);
router.delete('/commercial-checklist-templates/:id', ...writeGuard, ctrl.deleteTemplate);

module.exports = router;
