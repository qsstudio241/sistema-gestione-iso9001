/**
 * Unified search routes — Fase C ricerca studio/azienda
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const searchController = require('../controllers/search.controller');

router.use(authenticate);

router.get('/search', searchController.globalSearch);

module.exports = router;
