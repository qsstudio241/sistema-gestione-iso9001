'use strict';

/**
 * complianceMap.routes.js — CM-1…CM-5
 * /api/v1/companies/:companyId/compliance-maps...
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const { logAiInteraction } = require('../middleware/aiAuditTrail.middleware');
const ctrl = require('../controllers/complianceMap.controller');

const companyRouter = express.Router({ mergeParams: true });
companyRouter.use(authenticate);

companyRouter.get('/compliance-maps', ctrl.listComplianceMaps);
companyRouter.post('/compliance-maps', ctrl.createComplianceMap);
companyRouter.post('/compliance-maps/compile', ctrl.compileComplianceMap);
companyRouter.get('/compliance-maps/:mapId/export', ctrl.exportComplianceMap);
companyRouter.get('/compliance-maps/:mapId', ctrl.getComplianceMap);
companyRouter.post('/compliance-maps/:mapId/items', ctrl.createComplianceMapItem);
companyRouter.post(
  '/compliance-maps/:mapId/propose-links',
  requireLicensedModule('ai_norms'),
  logAiInteraction('norms'),
  ctrl.proposeComplianceMapLinks
);
companyRouter.patch(
  '/compliance-maps/:mapId/items/:itemId/hitl',
  ctrl.patchComplianceMapItemHitl
);

router.use('/companies/:companyId', companyRouter);

module.exports = router;
