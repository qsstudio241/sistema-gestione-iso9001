/**
 * Adapter embedding locale per le figure (Multimodal RAG MR-1).
 *
 * Stesso spazio testo ↔ ritaglio PNG. Niente Gemini / aiProviderAdapter.
 * Default: jinaai/jina-clip-v2. Override: FIGURE_EMBED_MODEL.
 * Fallback dichiarato: clip-ViT-B-32 (se la macchina non regge VRAM).
 *
 * I test L1 mockano questo modulo: non scaricare pesi in CI/Cloud.
 */

const logger = require('../utils/logger');

const DEFAULT_MODEL = 'jinaai/jina-clip-v2';
const FALLBACK_MODEL = 'clip-ViT-B-32';

function embeddingSpace() {
  const raw = (process.env.FIGURE_EMBED_MODEL || '').trim();
  return raw || DEFAULT_MODEL;
}

function fallbackEmbeddingSpace() {
  return FALLBACK_MODEL;
}

async function embedText() {
  const err = new Error(
    'Embedding locale figure non disponibile in questo processo ' +
      `(modello ${embeddingSpace()}). Usare un mock nei test; in runtime serve CLIP locale.`
  );
  err.code = 'FIGURE_EMBED_UNAVAILABLE';
  logger.warn('[figureEmbed] %s', err.message);
  throw err;
}

async function embedImage() {
  return embedText();
}

module.exports = {
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  embeddingSpace,
  fallbackEmbeddingSpace,
  embedText,
  embedImage,
};
