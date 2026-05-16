/**
 * normChunker.service.js
 * Chunking, embedding (Gemini text-embedding-004) e ricerca semantica
 * brute-force cosine similarity per documenti normativi.
 */

const { query } = require('../config/database');
const { embed } = require('./aiProviderAdapter');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// In-memory cache: org ? { chunks, ts }
// ---------------------------------------------------------------------------
const chunkCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function invalidateCache(organizationId) {
  chunkCache.delete(organizationId);
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/**
 * Spezza il testo in chunk di ~maxTokens parole con overlap.
 * @param {string} text
 * @param {number} maxTokens  ~parole per chunk
 * @param {number} overlap    parole di sovrapposizione
 * @returns {{chunkIndex: number, text: string, tokenCount: number}[]}
 */
function chunkText(text, maxTokens = 500, overlap = 50) {
  if (!text || !text.trim()) return [];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks = [];
  let start = 0;
  let idx = 0;

  while (start < words.length) {
    const end = Math.min(start + maxTokens, words.length);
    const slice = words.slice(start, end);
    chunks.push({
      chunkIndex: idx++,
      text: slice.join(' '),
      tokenCount: slice.length,
    });
    if (end >= words.length) break;
    start = end - overlap;
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Indexing
// ---------------------------------------------------------------------------

const EMBED_BATCH = 20;

/**
 * Indicizza un singolo documento normativo: chunking ? embedding ? INSERT.
 * @param {number} documentSourceId  PK di norm_document_sources
 */
async function indexDocument(documentSourceId) {
  const src = await query(
    `SELECT id, organization_id, standard_code, extracted_text
     FROM norm_document_sources WHERE id = @id`,
    { id: documentSourceId }
  );
  if (!src.recordset || src.recordset.length === 0) {
    logger.warn(`[NormChunker] source ${documentSourceId} not found`);
    return;
  }
  const row = src.recordset[0];
  if (!row.extracted_text || row.extracted_text.length < 50) {
    logger.debug(`[NormChunker] source ${documentSourceId} text too short, skipping`);
    return;
  }

  // Rimuovi chunk precedenti per questo documento
  await query('DELETE FROM norm_chunks WHERE document_source_id = @id', { id: documentSourceId });

  const chunks = chunkText(row.extracted_text);
  if (chunks.length === 0) return;

  logger.info(`[NormChunker] Indexing source ${documentSourceId}: ${chunks.length} chunks`);

  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH);
    let vectors;
    try {
      vectors = await embed(batch.map(c => c.text));
    } catch (err) {
      logger.error(`[NormChunker] embed failed batch ${i}:`, err.message);
      vectors = batch.map(() => null);
    }

    for (let j = 0; j < batch.length; j++) {
      const c = batch[j];
      const vec = vectors[j] || null;
      await query(
        `INSERT INTO norm_chunks
           (document_source_id, organization_id, standard_code, chunk_index,
            chunk_text, embedding, token_count)
         VALUES
           (@srcId, @orgId, @stdCode, @idx, @text, @emb, @tokens)`,
        {
          srcId: documentSourceId,
          orgId: row.organization_id,
          stdCode: row.standard_code || null,
          idx: c.chunkIndex,
          text: c.text,
          emb: vec ? JSON.stringify(vec) : null,
          tokens: c.tokenCount,
        }
      );
    }

    logger.debug(`[NormChunker] Inserted batch ${i}-${i + batch.length - 1} for source ${documentSourceId}`);
  }

  invalidateCache(row.organization_id);
  logger.info(`[NormChunker] Indexing complete for source ${documentSourceId}`);
}

/**
 * Re-indicizza tutti i documenti normativi di un'organizzazione.
 */
async function reindexAll(organizationId) {
  await query('DELETE FROM norm_chunks WHERE organization_id = @orgId', { orgId: organizationId });
  invalidateCache(organizationId);

  const sources = await query(
    `SELECT id FROM norm_document_sources
     WHERE organization_id = @orgId
       AND extracted_text IS NOT NULL AND LEN(extracted_text) > 50`,
    { orgId: organizationId }
  );

  const ids = (sources.recordset || []).map(r => r.id);
  logger.info(`[NormChunker] reindexAll org ${organizationId}: ${ids.length} sources`);

  for (const id of ids) {
    try {
      await indexDocument(id);
    } catch (err) {
      logger.error(`[NormChunker] reindex failed for source ${id}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Semantic search (brute-force cosine similarity)
// ---------------------------------------------------------------------------

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s);
}

function cosineSimilarity(a, b) {
  const d = dot(a, b);
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return d / (na * nb);
}

/**
 * Carica chunk con embedding dall'org, con cache TTL 5 min.
 */
async function loadChunks(organizationId, standardCodes) {
  const cacheKey = organizationId;
  const cached = chunkCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    let result = cached.chunks;
    if (standardCodes && standardCodes.length > 0) {
      const codeSet = new Set(standardCodes);
      result = result.filter(c => !c.standard_code || codeSet.has(c.standard_code));
    }
    return result;
  }

  const rows = await query(
    `SELECT id, document_source_id, standard_code, chunk_index,
            chunk_text, embedding, token_count
     FROM norm_chunks
     WHERE organization_id = @orgId AND embedding IS NOT NULL`,
    { orgId: organizationId }
  );

  const chunks = (rows.recordset || []).map(r => ({
    ...r,
    _vec: JSON.parse(r.embedding),
  }));

  chunkCache.set(cacheKey, { chunks, ts: Date.now() });

  if (standardCodes && standardCodes.length > 0) {
    const codeSet = new Set(standardCodes);
    return chunks.filter(c => !c.standard_code || codeSet.has(c.standard_code));
  }
  return chunks;
}

/**
 * Ricerca semantica brute-force.
 * @param {string} queryText
 * @param {number} organizationId
 * @param {object} [options]
 * @param {string[]} [options.standardCodes]
 * @param {number} [options.topK=10]
 * @param {number} [options.minScore=0.2]
 * @returns {Promise<Array<{id, document_source_id, standard_code, chunk_text, score}>>}
 */
async function searchSimilar(queryText, organizationId, options = {}) {
  const { standardCodes, topK = 10, minScore = 0.2 } = options;

  const [queryVec] = await embed([queryText]);
  if (!queryVec) throw new Error('Failed to embed query text');

  const chunks = await loadChunks(organizationId, standardCodes);
  if (chunks.length === 0) return [];

  const scored = chunks.map(c => ({
    id: c.id,
    document_source_id: c.document_source_id,
    standard_code: c.standard_code,
    chunk_index: c.chunk_index,
    chunk_text: c.chunk_text,
    token_count: c.token_count,
    score: cosineSimilarity(queryVec, c._vec),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter(s => s.score >= minScore)
    .slice(0, topK);
}

module.exports = {
  chunkText,
  indexDocument,
  reindexAll,
  searchSimilar,
  invalidateCache,
};
