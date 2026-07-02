/**
 * weldingBooks.routes.js — Welding Book ISO 3834 (IOF)
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/weldingBooks.controller');

router.use(authenticate);
router.use(requireLicensedModule('saldatura'));

router.get('/welding-books/stats', ctrl.getWeldingBookStats);

router.get   ('/welding-books',     ctrl.listWeldingBooks);
router.post  ('/welding-books',     ctrl.createWeldingBook);
router.get   ('/welding-books/:id', ctrl.getWeldingBook);
router.put   ('/welding-books/:id', ctrl.updateWeldingBook);
router.delete('/welding-books/:id', ctrl.deleteWeldingBook);

module.exports = router;
