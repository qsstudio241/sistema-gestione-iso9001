/**
 * projects.routes.js — Rotte Commesse/Progetti ISO 3834
 */
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const { logAiInteraction } = require('../middleware/aiAuditTrail.middleware');
const ctrl = require('../controllers/projects.controller');
const aiSuggestCtrl = require('../controllers/weldingAiSuggest.controller');

router.use(authenticate);
router.use(requireLicensedModule('saldatura'));

router.get   ('/projects/stats',                       ctrl.getProjectStats);
router.get   ('/projects',                             ctrl.listProjects);
router.get   ('/projects/:id',                         ctrl.getProject);
router.post  ('/projects',                             ctrl.createProject);
router.put   ('/projects/:id',                         ctrl.updateProject);
router.delete('/projects/:id',                         ctrl.deleteProject);

// Welders
router.post  ('/projects/:id/welders',                 ctrl.addProjectWelder);
router.delete('/projects/:id/welders/:qualificationId',ctrl.removeProjectWelder);

// Suggeritore AI conformita' 3834-3 (pattern SAL Fase 5-A) — gate licenza ai_norms
// SOPRA quello 'saldatura'. Solo proposta, mai scrittura automatica sulla commessa.
router.post(
  '/projects/:id/ai/suggest-compliance',
  requireLicensedModule('ai_norms'),
  logAiInteraction('welding_suggest'),
  aiSuggestCtrl.suggestProjectCompliance,
);

module.exports = router;
