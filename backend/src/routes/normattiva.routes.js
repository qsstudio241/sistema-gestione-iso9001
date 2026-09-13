/**
 * normattiva.routes.js
 * Routes per ingest automatico decreti da Normattiva.it.
 */

const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth.middleware');
const normattivaController = require('../controllers/normattiva.controller');

/**
 * POST /api/v1/normattiva/search
 * Ricerca un decreto su Normattiva.
 * Body: { query: "D.Lgs. 81/2008" }
 * Access: admin, superadmin
 */
router.post('/search', authenticateJWT, normattivaController.searchNormattiva);

/**
 * POST /api/v1/normattiva/import
 * Importa un decreto nel second brain.
 * Body: { urn: "urn:nir:...", organizationId?: number }
 * Access: admin, superadmin
 */
router.post('/import', authenticateJWT, normattivaController.importNormattiva);

module.exports = router;
