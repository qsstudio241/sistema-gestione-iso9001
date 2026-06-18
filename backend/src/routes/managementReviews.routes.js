/**
 * managementReviews.routes.js — Riesame di Direzione ISO 9001 §9.3
 */

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/managementReviews.controller');

router.use(authenticate);
router.use(requireLicensedModule('riesame_direzione'));

router.get('/management-reviews',     ctrl.listReviews);
router.get('/management-reviews/:id', ctrl.getOneReview);
router.post('/management-reviews',    ctrl.createReview);
router.put('/management-reviews/:id', ctrl.updateReview);
router.delete('/management-reviews/:id', ctrl.deleteReview);

module.exports = router;
