const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { postAuditEvents, getAuditEvents } = require('../controllers/auditEvents.controller');

// POST /api/v1/audits/:uuid/events  — batch insert eventi
router.post('/:uuid/events', authenticate, postAuditEvents);

// GET  /api/v1/audits/:uuid/events  — lettura eventi (debug/smoke)
router.get('/:uuid/events', authenticate, getAuditEvents);

module.exports = router;
