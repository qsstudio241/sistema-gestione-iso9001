/**
 * GET /ai/figures/search — retrieve testo→figura (Multimodal RAG MR-1).
 * Isolamento organization_id dal JWT. Niente Gemini sui byte delle tavole.
 */

const logger = require('../utils/logger');
const { resolveAiCompanyScope } = require('../services/aiCompanyScope.service');
const { sendAccessDenied } = require('../services/companyAccess.service');
const { searchFiguresByText } = require('../services/figureKnowledge.service');

async function searchFigures(req, res) {
  try {
    const q = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      return res.status(400).json({
        error: 'Il parametro "q" \u00e8 obbligatorio.',
        code: 'MISSING_PARAMS',
      });
    }

    const organizationId = req.user && req.user.organization_id;
    if (!organizationId) {
      return res.status(401).json({
        error: 'Organizzazione non presente nel token.',
        code: 'UNAUTHORIZED',
      });
    }

    const scope = await resolveAiCompanyScope(req.user, req.query?.companyId);
    if (scope.denied) {
      return sendAccessDenied(res, scope.denied);
    }

    const figures = await searchFiguresByText(q, organizationId, {
      companyId: scope.companyId,
      topK: req.query?.topK,
    });
    return res.json({ figures: figures || [] });
  } catch (err) {
    if (err && err.code === 'FIGURE_EMBED_UNAVAILABLE') {
      return res.status(503).json({
        error: 'Embedding locale figure non disponibile.',
        code: 'FIGURE_EMBED_UNAVAILABLE',
      });
    }
    logger.error('[FIGURES_SEARCH] Error: %s', err.message);
    return res.status(500).json({
      error: 'Errore nella ricerca figure.',
      code: 'FIGURES_SEARCH_ERROR',
    });
  }
}

module.exports = { searchFigures };
