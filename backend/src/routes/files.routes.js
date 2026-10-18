/**
 * files.routes.js — download autenticato dei file in /uploads (certificati).
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/files.controller');

router.get('/files/content', authenticate, ctrl.getFileContent);

module.exports = router;
