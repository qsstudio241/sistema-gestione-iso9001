'use strict';

/**
 * complianceMap.routes.js — CM-1
 * /api/v1/companies/:companyId/compliance-maps...
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/complianceMap.controller');

const companyRouter = express.Router({ mergeParams: true });
companyRouter.use(authenticate);

companyRouter.get('/compliance-maps', ctrl.listComplianceMaps);
companyRouter.post('/compliance-maps', ctrl.createComplianceMap);
companyRouter.get('/compliance-maps/:mapId', ctrl.getComplianceMap);
companyRouter.post('/compliance-maps/:mapId/items', ctrl.createComplianceMapItem);
companyRouter.patch(
  '/compliance-maps/:mapId/items/:itemId/hitl',
  ctrl.patchComplianceMapItemHitl
);

router.use('/companies/:companyId', companyRouter);

module.exports = router;
