/**
 * questionAssistant.routes.js — Routes per AI Assistant contestuale quesiti checklist
 */

const express = require('express');
const router = express.Router();
const qac = require('../controllers/questionAssistant.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * POST /ai/question-assistant
 * Body: { mode, question, attachments[], auditContext }
 * Auth: JWT token required
 * License: ai_chat module required
 */
router.post('/question-assistant', authenticate, qac.handleQuestionAssistant);

module.exports = router;
