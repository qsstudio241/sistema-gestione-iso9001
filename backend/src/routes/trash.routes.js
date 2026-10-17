/**
 * Cestino: elenco e ripristino. Il controller rifiuta chi non è admin o superadmin.
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const trash = require('../services/trash.service');

router.use(authenticate);
router.get('/trash', trash.listTrash);
router.post('/trash/:entity/:id/restore', trash.restoreTrash);

module.exports = router;
