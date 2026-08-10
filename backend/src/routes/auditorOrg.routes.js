/**
 * Auditor Org Routes - Fase 1 Multi-Tenant
 */

const express = require('express');
const router = express.Router();
const auditorOrgController = require('../controllers/auditorOrg.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/auditor-orgs', auditorOrgController.listAuditorOrgs);
router.get('/auditor-orgs/:id', auditorOrgController.getAuditorOrgById);
router.post('/auditor-orgs', authorize('superadmin'), auditorOrgController.createAuditorOrg);

module.exports = router;
