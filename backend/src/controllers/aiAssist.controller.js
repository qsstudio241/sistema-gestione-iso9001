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
        built = await contextBuilder.buildAuditConclusionsContext({
          ...context,
          userId: req.user.user_id,
          organizationId: req.user.organization_id,
        });
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
    logger.error('[AI_SUGGEST] Error:', err.message, '| code:', err.code, '| status:', err.status);

    // Mappa gli errori AI a messaggi italiani leggibili dall'utente.
    // Usiamo HTTP 500 (non 503) per errori upstream/timeout così Nginx NON
    // intercetta la risposta (proxy_intercept_errors cattura solo 502/503/504
    // quando Node è down — non deve coprire errori funzionali dell'app).
    let httpStatus;
    let userMessage;

    switch (err.code) {
      case 'AI_NOT_CONFIGURED':
        httpStatus = 503;
        userMessage = 'Nessun provider AI configurato. Contattare l\'amministratore.';
        break;
      case 'AI_UPSTREAM_ERROR':
        httpStatus = 500;
        if (err.status === 503 || err.status === 529) {
          userMessage = 'Servizio AI temporaneamente sovraccarico. Riprovare tra qualche secondo.';
        } else if (err.status === 429) {
          userMessage = 'Limite richieste AI superato. Riprovare tra qualche minuto.';
        } else if (err.status === 400) {
          userMessage = 'Richiesta AI non valida. Verificare i dati dell\'audit e riprovare.';
        } else {
          userMessage = err.message || 'Errore dal servizio AI esterno.';
        }
        break;
      case 'AI_REQUEST_FAILED':
        httpStatus = 500;
        userMessage = 'Risposta AI troppo lenta o connessione interrotta. Riprovare.';
        break;
      case 'AI_EMPTY_RESPONSE':
        httpStatus = 500;
        userMessage = 'Il servizio AI ha restituito una risposta vuota. Riprovare.';
        break;
      default:
        httpStatus = err.status || 500;
        userMessage = err.message || 'Errore interno nell\'elaborazione AI. Riprovare.';
    }

    res.status(httpStatus).json({
      error: userMessage,
      code: err.code || 'AI_ERROR',
    });
  }
}

/**
 * POST /ai/feedback
 * Body: { feature, action, aiText, finalText, recommendation, auditId, contextSummary, modelUsed }
 */
async function feedback(req, res) {
  try {
    const { feature, action, aiText, finalText, recommendation, auditId, contextSummary, modelUsed } = req.body;
    if (!feature || !action) {
      return res.status(400).json({ error: 'feature e action sono obbligatori.', code: 'MISSING_PARAMS' });
    }
    if (!['accepted', 'rejected', 'rephrased'].includes(action)) {
      return res.status(400).json({ error: "action deve essere 'accepted', 'rejected' o 'rephrased'.", code: 'INVALID_ACTION' });
    }

    const { query } = require('../config/database');
    await query(
      `INSERT INTO ai_feedback (organization_id, user_id, feature, audit_id, action, ai_text, final_text, recommendation, context_summary, model_used)
       VALUES (@orgId, @userId, @feature, @auditId, @action, @aiText, @finalText, @recommendation, @contextSummary, @modelUsed)`,
      {
        orgId: req.user.organization_id,
        userId: req.user.user_id,
        feature,
        auditId: auditId || null,
        action,
        aiText: aiText || null,
        finalText: finalText || null,
        recommendation: recommendation || null,
        contextSummary: contextSummary || null,
        modelUsed: modelUsed || null,
      }
    );

    res.json({ success: true });
  } catch (err) {
    logger.error('[AI_FEEDBACK] Error:', err.message);
    res.status(500).json({ error: 'Errore salvataggio feedback.', code: 'FEEDBACK_ERROR' });
  }
}

module.exports = { suggest, feedback };
