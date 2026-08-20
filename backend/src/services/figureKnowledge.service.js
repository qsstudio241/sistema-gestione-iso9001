/**
 * Persistenza e retrieve delle figure normative (Multimodal RAG MR-1).
 *
 * Tabella knowledge_figures: embedding CLIP locale, colonna embedding_space.
 * Non scrive su knowledge_chunks. Non chiama Gemini sui byte delle tavole.
 */

const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const defaultEmbedder = require('./figureEmbed.service');

const KIND_OK = new Set(['raster', 'vector']);

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function parseBbox(bbox) {
  if (Array.isArray(bbox) && bbox.length === 4) {
    return bbox.map((n) => Number(n));
  }
  if (typeof bbox === 'string') {
    try {
      const parsed = JSON.parse(bbox);
      if (Array.isArray(parsed) && parsed.length === 4) return parsed.map((n) => Number(n));
    } catch (_) { /* ignore */ }
  }
  return null;
}

function resolveEmbedder(embedder) {
  return embedder || defaultEmbedder;
}

function serializeEmbedding(vec) {
  if (!Array.isArray(vec) || vec.length === 0) return null;
  return JSON.stringify(vec);
}

function parseEmbedding(raw) {
  if (!raw) return null;
  try {
    const vec = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(vec) ? vec : null;
  } catch (_) {
    return null;
  }
}

/**
 * Sostituisce le figure di un PDF sorgente (stesso org) e le re-inserisce con embedding.
 *
 * @param {object} opts
 * @param {number} opts.organizationId
 * @param {number|null} [opts.companyId]
 * @param {string} [opts.sourcePdf]
 * @param {Array<object>} opts.figures  lista MR-0 (page, bbox, kind, path, caption)
 * @param {string} [opts.figuresDir]    cartella che contiene i PNG
 * @param {object} [opts.embedder]
 * @returns {Promise<Array<{id:number}>>}
 */
async function persistFigures(opts) {
  const organizationId = Number(opts.organizationId);
  if (!Number.isFinite(organizationId)) {
    throw new Error('organizationId obbligatorio per persistFigures');
  }
  const embedder = resolveEmbedder(opts.embedder);
  const space = embedder.embeddingSpace();
  const sourcePdf = opts.sourcePdf || null;
  const companyId = opts.companyId != null ? Number(opts.companyId) : null;
  const figures = Array.isArray(opts.figures) ? opts.figures : [];

  await query(
    `DELETE FROM knowledge_figures
     WHERE organization_id = @orgId AND ISNULL(source_pdf, N'') = ISNULL(@sourcePdf, N'')`,
    { orgId: organizationId, sourcePdf }
  );

  const inserted = [];
  for (const fig of figures) {
    const kind = String(fig.kind || '').toLowerCase();
    if (!KIND_OK.has(kind)) continue;
    const bbox = parseBbox(fig.bbox);
    if (!bbox) continue;
    const page = Number(fig.page);
    if (!Number.isFinite(page) || page < 1) continue;

    const pngPath = fig.png_path || fig.pngPath
      || (opts.figuresDir && fig.path ? path.join(opts.figuresDir, fig.path) : (fig.path || null));

    let vec = null;
    try {
      if (pngPath && typeof embedder.embedImage === 'function') {
        vec = await embedder.embedImage(pngPath);
      }
      if (!vec && fig.caption && typeof embedder.embedText === 'function') {
        const [fromCaption] = await embedder.embedText([String(fig.caption)]);
        vec = fromCaption;
      }
    } catch (err) {
      logger.warn('[figureKnowledge] embed fallito, riga senza vettore: %s', err.message);
    }

    const result = await query(
      `INSERT INTO knowledge_figures
        (organization_id, company_id, source_pdf, page, bbox, kind, caption, png_path, embedding, embedding_space)
       OUTPUT INSERTED.id
       VALUES
        (@orgId, @companyId, @sourcePdf, @page, @bbox, @kind, @caption, @pngPath, @embedding, @space)`,
      {
        orgId: organizationId,
        companyId: Number.isFinite(companyId) ? companyId : null,
        sourcePdf,
        page,
        bbox: JSON.stringify(bbox),
        kind,
        caption: fig.caption != null ? String(fig.caption).slice(0, 500) : null,
        pngPath: pngPath || null,
        embedding: serializeEmbedding(vec),
        space,
      }
    );
    const id = (result.recordset && result.recordset[0] && result.recordset[0].id) || null;
    inserted.push({ id, page, kind, embedding_space: space });
  }

  logger.info(
    '[figureKnowledge] persist org %s source=%s figure=%s space=%s',
    organizationId,
    sourcePdf,
    inserted.length,
    space
  );
  return inserted;
}

/**
 * Ricerca testo → figura nello stesso embedding_space, isolata per organization_id.
 *
 * @param {string} queryText
 * @param {number} organizationId
 * @param {object} [options]
 * @returns {Promise<Array<object>>}
 */
function imageRefLabel(imageRef) {
  if (!imageRef) return '';
  if (typeof imageRef === 'string') return imageRef;
  return String(imageRef.originalname || imageRef.path || imageRef.filename || '');
}

async function rankFiguresByQueryVec(queryVec, organizationId, options = {}) {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId)) {
    throw new Error('organizationId obbligatorio per la ricerca figure');
  }
  if (!queryVec) return [];

  const embedder = resolveEmbedder(options.embedder);
  const space = embedder.embeddingSpace();
  const topK = Number.isFinite(Number(options.topK)) ? Math.max(1, Number(options.topK)) : 5;
  const minScore = Number.isFinite(Number(options.minScore)) ? Number(options.minScore) : 0;

  let sql = `SELECT id, page, bbox, kind, caption, png_path, embedding, embedding_space, organization_id
     FROM knowledge_figures
     WHERE organization_id = @orgId
       AND embedding_space = @space
       AND embedding IS NOT NULL`;
  const params = { orgId, space };

  if (options.companyId != null && options.companyId !== '') {
    const cid = Number(options.companyId);
    if (Number.isFinite(cid)) {
      // Come il registro norme: tavole dell'azienda + condivise (company_id NULL).
      sql += ' AND (company_id = @companyId OR company_id IS NULL)';
      params.companyId = cid;
    }
  }

  const result = await query(sql, params);
  const scored = [];
  for (const row of result.recordset || []) {
    if (Number(row.organization_id) !== orgId) continue;
    const vec = parseEmbedding(row.embedding);
    if (!vec) continue;
    const score = cosineSimilarity(queryVec, vec);
    if (score < minScore) continue;
    const bbox = parseBbox(row.bbox);
    scored.push({
      id: row.id,
      page: row.page,
      bbox,
      kind: row.kind,
      caption: row.caption || null,
      path: row.png_path || null,
      score: Number(score.toFixed(4)),
      embedding_space: row.embedding_space,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

async function searchFiguresByText(queryText, organizationId, options = {}) {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId)) {
    throw new Error('organizationId obbligatorio per searchFiguresByText');
  }
  const q = String(queryText || '').trim();
  if (!q) return [];

  const embedder = resolveEmbedder(options.embedder);
  const [queryVec] = await embedder.embedText([q]);
  if (!queryVec) return [];
  return rankFiguresByQueryVec(queryVec, orgId, { ...options, embedder });
}

/**
 * Ricerca ritaglio/disegno → figura nello stesso embedding_space (MR-4).
 * @param {string|object} imageRef path, buffer o file multer
 */
async function searchFiguresByImage(imageRef, organizationId, options = {}) {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId)) {
    throw new Error('organizationId obbligatorio per searchFiguresByImage');
  }
  if (!imageRef) return [];

  const embedder = resolveEmbedder(options.embedder);
  const queryVec = await embedder.embedImage(imageRef);
  if (!queryVec) return [];
  return rankFiguresByQueryVec(queryVec, orgId, { ...options, embedder });
}

module.exports = {
  cosineSimilarity,
  persistFigures,
  searchFiguresByText,
  searchFiguresByImage,
  imageRefLabel,
};
