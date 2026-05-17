/**
 * projects.routes.js — Rotte Commesse/Progetti ISO 3834
 */
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/projects.controller');

router.use(authenticate);
router.use(requireLicensedModule('saldatura'));

router.get   ('/projects/stats', ctrl.getProjectStats);
router.get   ('/projects',       ctrl.listProjects);
router.get   ('/projects/:id',   ctrl.getProject);
router.post  ('/projects',       ctrl.createProject);
router.put   ('/projects/:id',   ctrl.updateProject);
router.delete('/projects/:id',   ctrl.deleteProject);

module.exports = router;
