const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/contractReview.controller');

const guard = [authenticate, requireLicensedModule('ai_review')];

router.get('/contract-reviews', ...guard, ctrl.listCases);
router.post('/contract-reviews', ...guard, ctrl.createCase);
router.get('/contract-reviews/:id', ...guard, ctrl.getCase);
router.put('/contract-reviews/:id', ...guard, ctrl.updateCase);
router.post('/contract-reviews/:id/transition', ...guard, ctrl.transitionStatus);
router.post('/contract-reviews/:id/generate-checklist', ...guard, ctrl.generateChecklist);
router.put('/contract-reviews/:id/checklist/:itemId', ...guard, ctrl.saveChecklistAnswer);

module.exports = router;
