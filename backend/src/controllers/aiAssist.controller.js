const logger = require('../utils/logger');
const { chat, getActiveProvider } = require('../services/aiProviderAdapter');
const contextBuilder = require('../services/aiContextBuilder.service');

function stripCodeFences(raw) {
  let s = String(raw || '').trim();
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  return s.trim();
}

/**
 * POST /ai/suggest
 * Body: { feature: 'review_requirements' | 'audit_conclusions', context: {...} }
 */
async function suggest(req, res) {
  try {
    const provider = getActiveProvider();
    if (!provider) {
      return res.status(503).json({
        error: 'Nessun provider AI configurato.',
        code: 'AI_NOT_CONFIGURED',
      });
    }

    const { feature, context } = req.body;
    if (!feature || !context) {
      return res.status(400).json({
        error: 'feature e context sono obbligatori.',
        code: 'MISSING_PARAMS',
      });
    }

    let built;
    switch (feature) {
      case 'review_requirements':
        built = await contextBuilder.buildReviewRequirementsContext({
          ...context,
          organizationId: req.user.organization_id,
        });
        break;
      case 'audit_conclusions':
        built = contextBuilder.buildAuditConclusionsContext(context);
        break;
      default:
        return res.status(400).json({
          error: `Feature '${feature}' non supportata.`,
          code: 'UNKNOWN_FEATURE',
        });
    }

    const result = await chat(
      [
        { role: 'system', content: built.systemPrompt },
        { role: 'user', content: built.userPrompt },
      ],
      { temperature: 0.3, responseFormat: 'json' }
    );

    const normalized = stripCodeFences(result.content);
    let data;
    try {
      data = JSON.parse(normalized);
    } catch {
      data = { raw: normalized };
    }

    res.json({
      feature,
      suggestion: data,
      _aiMeta: {
        provider,
        model: result.model,
        tokens: result.tokens,
        cost: result.cost,
        contextSummary: built.contextSummary,
      },
    });
  } catch (err) {
    logger.error('[AI_SUGGEST] Error:', err.message);
    const status = err.code === 'AI_NOT_CONFIGURED' ? 503 : err.status || 500;
    res.status(status).json({
      error: err.message,
      code: err.code || 'AI_ERROR',
    });
  }
}

module.exports = { suggest };
