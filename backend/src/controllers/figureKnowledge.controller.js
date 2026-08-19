/**
 * GET /ai/figures/search — retrieve testo→figura (Multimodal RAG MR-1).
 * GET /ai/figures/:id/image — byte PNG della tavola (MR-2), stesso isolamento org.
 * POST /ai/figures/ingest — PDF già sul disco → extract + persist (MR-3).
 * POST /ai/figures/search-by-image — ritaglio → tavole nello stesso spazio CLIP (MR-4).
 * Isolamento organization_id dal JWT. Niente Gemini sui byte delle tavole.
 */

const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { query } = require('../config/database');
const { resolveAiCompanyScope } = require('../services/aiCompanyScope.service');
const { sendAccessDenied } = require('../services/companyAccess.service');
const {
  searchFiguresByText,
  searchFiguresByImage: findFiguresByImage,
} = require('../services/figureKnowledge.service');
const { ingestFiguresFromPdf } = require('../services/figureIngest.service');

const IMAGE_EXT_OK = new Set(['.png', '.jpg', '.jpeg', '.webp']);

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

/**
 * Ricerca visiva: file PNG/JPEG/WebP in memoria, org solo dal JWT.
 * Senza file → 400. Nessun match → { figures: [] } 200.
 */
async function searchFiguresByImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Il file immagine è obbligatorio.',
        code: 'MISSING_FILE',
      });
    }

    const organizationId = req.user && req.user.organization_id;
    if (!organizationId) {
      return res.status(401).json({
        error: 'Organizzazione non presente nel token.',
        code: 'UNAUTHORIZED',
      });
    }

    const scope = await resolveAiCompanyScope(req.user, req.body?.companyId);
    if (scope.denied) {
      return sendAccessDenied(res, scope.denied);
    }

    const figures = await findFiguresByImage(req.file, organizationId, {
      companyId: scope.companyId,
      topK: req.body?.topK || req.query?.topK,
    });
    return res.json({ figures: figures || [] });
  } catch (err) {
    if (err && err.code === 'FIGURE_EMBED_UNAVAILABLE') {
      return res.status(503).json({
        error: 'Embedding locale figure non disponibile.',
        code: 'FIGURE_EMBED_UNAVAILABLE',
      });
    }
    logger.error('[FIGURES_SEARCH_IMAGE] Error: %s', err.message);
    return res.status(500).json({
      error: 'Errore nella ricerca figure da immagine.',
      code: 'FIGURES_SEARCH_IMAGE_ERROR',
    });
  }
}

/**
 * Serve i byte della tavola già persistita. Org solo dal JWT.
 * File assente → 404 (il FE mostra placeholder).
 */
async function getFigureImage(req, res) {
  try {
    const organizationId = req.user && req.user.organization_id;
    if (!organizationId) {
      return res.status(401).json({
        error: 'Organizzazione non presente nel token.',
        code: 'UNAUTHORIZED',
      });
    }

    const id = parseInt(req.params && req.params.id, 10);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({
        error: 'Identificativo figura non valido.',
        code: 'INVALID_ID',
      });
    }

    const result = await query(
      `SELECT id, png_path, organization_id
       FROM knowledge_figures
       WHERE id = @id AND organization_id = @orgId`,
      { id, orgId: organizationId }
    );
    const row = result && result.recordset && result.recordset[0];
    if (!row || Number(row.organization_id) !== Number(organizationId)) {
      return res.status(404).json({
        error: 'Figura non trovata.',
        code: 'FIGURE_NOT_FOUND',
      });
    }

    const pngPath = row.png_path ? String(row.png_path) : '';
    if (!pngPath) {
      return res.status(404).json({
        error: 'File figura assente.',
        code: 'FIGURE_FILE_MISSING',
      });
    }

    const ext = path.extname(pngPath).toLowerCase();
    if (!IMAGE_EXT_OK.has(ext)) {
      return res.status(404).json({
        error: 'File figura assente.',
        code: 'FIGURE_FILE_MISSING',
      });
    }

    const resolved = path.resolve(pngPath);
    try {
      await fs.access(resolved);
    } catch {
      return res.status(404).json({
        error: 'File figura assente.',
        code: 'FIGURE_FILE_MISSING',
      });
    }

    const mime =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/png';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.sendFile(resolved);
  } catch (err) {
    logger.error('[FIGURES_IMAGE] Error: %s', err.message);
    return res.status(500).json({
      error: 'Errore nel recupero della figura.',
      code: 'FIGURES_IMAGE_ERROR',
    });
  }
}

/**
 * Ingest tavole da un PDF già sul server. Org solo dal JWT.
 * Path client libero fuori dalle radici autorizzate → 400.
 */
async function ingestFigures(req, res) {
  try {
    const organizationId = req.user && req.user.organization_id;
    if (!organizationId) {
      return res.status(401).json({
        error: 'Organizzazione non presente nel token.',
        code: 'UNAUTHORIZED',
      });
    }

    const pdfPath = typeof req.body?.pdfPath === 'string' ? req.body.pdfPath.trim() : '';
    if (!pdfPath) {
      return res.status(400).json({
        error: 'Il percorso PDF è obbligatorio.',
        code: 'MISSING_PARAMS',
      });
    }

    const scope = await resolveAiCompanyScope(req.user, req.body?.companyId);
    if (scope.denied) {
      return sendAccessDenied(res, scope.denied);
    }

    const result = await ingestFiguresFromPdf({
      organizationId,
      companyId: scope.companyId,
      pdfPath,
    });
    return res.json({
      figures: (result && result.figures) || [],
      count: (result && result.count) || 0,
    });
  } catch (err) {
    const code = err && err.code;
    if (code === 'UNAUTHORIZED') {
      return res.status(401).json({ error: err.message, code });
    }
    if (code === 'INVALID_PDF_PATH') {
      return res.status(400).json({ error: err.message, code });
    }
    if (code === 'PDF_NOT_FOUND') {
      return res.status(404).json({ error: err.message, code });
    }
    if (code === 'FIGURE_EXTRACT_UNAVAILABLE' || code === 'FIGURE_EMBED_UNAVAILABLE') {
      return res.status(503).json({
        error: err.message || 'Servizio figure non disponibile.',
        code,
      });
    }
    logger.error('[FIGURES_INGEST] Error: %s', err.message);
    return res.status(500).json({
      error: "Errore nell'ingest delle figure.",
      code: 'FIGURES_INGEST_ERROR',
    });
  }
}

module.exports = { searchFigures, searchFiguresByImage, getFigureImage, ingestFigures };
