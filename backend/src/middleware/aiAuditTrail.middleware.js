const logger = require('../utils/logger');

/**
 * Middleware factory for logging AI interactions.
 * Wraps res.json to capture AI response metadata before sending.
 * @param {string} feature - Feature name: 'import', 'assist', 'review', 'gap_analysis', 'chat', 'norms'
 */
function logAiInteraction(feature) {
  return (req, res, next) => {
    const startTime = Date.now();
    const originalJson = res.json.bind(res);

    res.json = function(body) {
      // Fire-and-forget logging
      const latencyMs = Date.now() - startTime;
      setImmediate(() => {
        try {
          const { query } = require('../config/database');
          const aiMeta = body?._aiMeta || {};
          query(
            `INSERT INTO ai_interactions 
             (organization_id, user_id, feature, provider, model, input_tokens, output_tokens, cost_usd, latency_ms, status, context_summary)
             VALUES (@org_id, @user_id, @feature, @provider, @model, @input_tokens, @output_tokens, @cost, @latency, @status, @summary)`,
            {
              org_id: req.user?.organization_id || 0,
              user_id: req.user?.user_id || 0,
              feature,
              provider: aiMeta.provider || 'unknown',
              model: aiMeta.model || 'unknown',
              input_tokens: aiMeta.tokens?.input || null,
              output_tokens: aiMeta.tokens?.output || null,
              cost: aiMeta.cost || null,
              latency: latencyMs,
              status: res.statusCode < 400 ? 'success' : 'error',
              summary: aiMeta.contextSummary || null,
            }
          ).catch(err => logger.warn('[AI_AUDIT_TRAIL] Log failed:', err.message));
        } catch (err) {
          logger.warn('[AI_AUDIT_TRAIL] Log failed:', err.message);
        }
      });

      // Remove _aiMeta from response before sending to client
      if (body && body._aiMeta) {
        const { _aiMeta, ...cleanBody } = body;
        return originalJson(cleanBody);
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = { logAiInteraction };
