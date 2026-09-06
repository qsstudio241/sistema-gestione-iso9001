'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/librarySourceRequest.controller');

const superadminOnly = [authenticate, authorize('superadmin')];

// LG-3 — coda cross-tenant (prima di eventuali :id)
router.get(
  '/library/source-requests/platform-queue',
  ...superadminOnly,
  ctrl.listPlatformQueueHandler
);

// LUX-B — COUNT gap aperti (prima di :id; stesso gate superadmin)
router.get(
  '/library/source-requests/platform-gap-count',
  ...superadminOnly,
  ctrl.countPlatformGapsHandler
);

router.patch(
  '/library/source-requests/:id/acknowledge',
  ...superadminOnly,
  ctrl.acknowledgeSourceRequest
);

// LG-5 — segna digitalizzata piattaforma (niente pdf-to-json automatico)
router.patch(
  '/library/source-requests/:id/mark-digitized',
  ...superadminOnly,
  ctrl.markDigitizedSourceRequest
);

// Studio admin (e superadmin via authorize) — allineato a Libreria UI
router.get(
  '/library/source-requests',
  authenticate,
  authorize('admin', 'superadmin'),
  ctrl.listSourceRequests
);

router.post(
  '/library/source-requests',
  authenticate,
  authorize('admin', 'superadmin'),
  ctrl.createSourceRequest
);

module.exports = router;
