'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/librarySourceRequest.controller');

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
