'use strict';

/**
 * weldingAiSuggest.controller.js
 * POST /projects/:id/ai/suggest-compliance — licenza ai_norms (pattern SAL Fase 5-A)
 * Il servizio propone, non scrive mai stati sulla commessa (human-in-the-loop).
 */

const { suggestWeldingCompliance } = require('../services/weldingAiSuggest.service');

async function suggestProjectCompliance(req, res) {
  try {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId) || projectId <= 0) {
      return res.status(400).json({ error: 'id progetto non valido', code: 'INVALID_PROJECT_ID' });
    }

    const clauseRefs = Array.isArray(req.body?.clauseRefs) ? req.body.clauseRefs : null;

    const result = await suggestWeldingCompliance({
      organizationId: req.user.organization_id,
      projectId,
      clauseRefs,
    });

    if (result.error === 'PROJECT_NOT_FOUND') {
      return res.status(404).json({ error: 'Commessa non trovata', code: 'PROJECT_NOT_FOUND' });
    }
    if (result.error === 'VALIDATION') {
      return res.status(400).json({ error: result.message, code: 'VALIDATION_ERROR' });
    }

    // _aiMeta consumato e rimosso dal middleware logAiInteraction('welding_suggest').
    return res.json({
      success: true,
      data: result.data,
      _aiMeta: result.meta || undefined,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Errore durante il suggerimento AI', code: 'WELDING_AI_SUGGEST_ERROR' });
  }
}

module.exports = { suggestProjectCompliance };
