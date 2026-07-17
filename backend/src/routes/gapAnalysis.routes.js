/**
 * gapAnalysis.routes.js
 * - GET /gap-analysis — euristica documenti (licenza ai_norms, HK-8)
 * - /companies/:companyId/gap-* — motore SAL Fase 0 (licenza sal)
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/gapAnalysis.controller');

router.get('/gap-analysis', authenticate, requireLicensedModule('ai_norms'), ctrl.getGapAnalysis);

const salRouter = express.Router({ mergeParams: true });
salRouter.use(authenticate);
salRouter.use(requireLicensedModule('sal'));

salRouter.get('/gap-matrix', ctrl.getSalGapMatrix);
salRouter.get('/gap-statuses', ctrl.listSalGapStatuses);
salRouter.get('/gap-statuses/:normRequirementId/history', ctrl.getSalGapHistory);
salRouter.put('/gap-statuses/:normRequirementId', ctrl.upsertSalGapStatus);
salRouter.post('/gap-matrix/seed', ctrl.seedSalGapMatrix);
salRouter.post('/gap-matrix/sync-audit-hints', ctrl.syncSalAuditHints);

router.use('/companies/:companyId', salRouter);

module.exports = router;
