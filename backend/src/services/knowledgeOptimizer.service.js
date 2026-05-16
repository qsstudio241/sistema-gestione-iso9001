/**
 * knowledgeOptimizer.service.js
 * Ottimizzazione continua della knowledge base AI.
 * Livello 1: housekeeping automatico (dedup, prune stale, gap detection)
 * Livello 2: sintesi AI settimanale (condensate, cross-company patterns, enrichment)
 */

const { query } = require('../config/database');
const { chat, embed } = require('./aiProviderAdapter');
const logger = require('../utils/logger');

const L2_MAX_CALLS_PER_ORG = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  na = Math.sqrt(na);
  nb = Math.sqrt(nb);
  if (na === 0 || nb === 0) return 0;
  return dot / (na * nb);
}

async function createRun(organizationId, runType) {
  const res = await query(
    `INSERT INTO ai_optimization_runs (organization_id, run_type, status)
     OUTPUT INSERTED.id
     VALUES (@orgId, @type, 'running')`,
    { orgId: organizationId, type: runType }
  );
  return res.recordset[0].id;
}

async function completeRun(runId, { chunksBefore = 0, chunksAfter = 0, chunksRemoved = 0, chunksCreated = 0, details = null, status = 'completed' } = {}) {
  await query(
    `UPDATE ai_optimization_runs
     SET completed_at = GETDATE(), status = @status,
         chunks_before = @before, chunks_after = @after,
         chunks_removed = @removed, chunks_created = @created,
         details = @details
     WHERE id = @id`,
    {
      id: runId,
      status,
      before: chunksBefore,
      after: chunksAfter,
      removed: chunksRemoved,
      created: chunksCreated,
      details: details ? JSON.stringify(details) : null,
    }
  );
}

// ---------------------------------------------------------------------------
// 1. Deduplicazione chunk
// ---------------------------------------------------------------------------

async function deduplicateChunks(organizationId) {
  const runId = await createRun(organizationId, 'dedup');
  try {
    const bucketsRes = await query(
      `SELECT DISTINCT entity_type, company_id
       FROM knowledge_chunks
       WHERE organization_id = @orgId AND embedding IS NOT NULL
             AND (is_stale = 0 OR is_stale IS NULL)`,
      { orgId: organizationId }
    );
    const buckets = bucketsRes.recordset || [];

    let totalBefore = 0;
    let totalRemoved = 0;

    for (const bucket of buckets) {
      let sql = `SELECT id, embedding, created_at FROM knowledge_chunks
                 WHERE organization_id = @orgId AND entity_type = @et AND embedding IS NOT NULL
                       AND (is_stale = 0 OR is_stale IS NULL)`;
      const params = { orgId: organizationId, et: bucket.entity_type };

      if (bucket.company_id != null) {
        sql += ' AND company_id = @cid';
        params.cid = bucket.company_id;
      } else {
        sql += ' AND company_id IS NULL';
      }
      sql += ' ORDER BY created_at DESC';

      const chunkRes = await query(sql, params);
      const chunks = chunkRes.recordset || [];
      totalBefore += chunks.length;

      if (chunks.length < 2) continue;

      const parsed = chunks.map(c => {
        try { return { id: c.id, vec: JSON.parse(c.embedding), createdAt: c.created_at }; }
        catch { return null; }
      }).filter(Boolean);

      const toDelete = new Set();
      for (let i = 0; i < parsed.length; i++) {
        if (toDelete.has(parsed[i].id)) continue;
        for (let j = i + 1; j < parsed.length; j++) {
          if (toDelete.has(parsed[j].id)) continue;
          const sim = cosineSimilarity(parsed[i].vec, parsed[j].vec);
          if (sim > 0.95) {
            toDelete.add(parsed[j].id);
          }
        }
      }

      if (toDelete.size > 0) {
        const ids = [...toDelete];
        const paramObj = {};
        const placeholders = ids.map((id, i) => { paramObj[`d${i}`] = id; return `@d${i}`; });
        await query(`DELETE FROM knowledge_chunks WHERE id IN (${placeholders.join(',')})`, paramObj);
        totalRemoved += ids.length;
      }
    }

    const totalAfter = totalBefore - totalRemoved;
    await completeRun(runId, { chunksBefore: totalBefore, chunksAfter: totalAfter, chunksRemoved: totalRemoved });
    logger.info(`[KnowledgeOptimizer] dedup org ${organizationId}: removed ${totalRemoved}/${totalBefore}`);
    return { removed: totalRemoved, before: totalBefore, after: totalAfter };
  } catch (err) {
    await completeRun(runId, { status: 'failed', details: { error: err.message } });
    logger.error(`[KnowledgeOptimizer] dedup failed org ${organizationId}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 2. Prune stale chunks
// ---------------------------------------------------------------------------

async function pruneStaleChunks(organizationId) {
  const runId = await createRun(organizationId, 'prune_stale');
  try {
    const beforeRes = await query(
      `SELECT COUNT(*) AS cnt FROM knowledge_chunks
       WHERE organization_id = @orgId AND (is_stale = 0 OR is_stale IS NULL)`,
      { orgId: organizationId }
    );
    const chunksBefore = (beforeRes.recordset[0] || {}).cnt || 0;

    // Marca stale: NC/azioni chiuse da > 180 giorni
    const staleClosedRes = await query(
      `UPDATE kc SET kc.is_stale = 1
       FROM knowledge_chunks kc
       WHERE kc.organization_id = @orgId
         AND kc.entity_type IN ('non_conformity', 'nc_action')
         AND (kc.is_stale = 0 OR kc.is_stale IS NULL)
         AND EXISTS (
           SELECT 1 FROM (
             SELECT nc.nc_id AS id, 'non_conformity' AS et, nc.status, nc.updated_at
             FROM non_conformities nc
             JOIN audits a ON nc.audit_id = a.audit_id
             WHERE a.organization_id = @orgId
               AND nc.status IN ('chiusa', 'verificata')
               AND nc.updated_at < DATEADD(day, -180, GETDATE())
             UNION ALL
             SELECT na.action_id AS id, 'nc_action' AS et, na.status, na.updated_at
             FROM nc_actions na
             JOIN non_conformities nc2 ON na.nc_id = nc2.nc_id
             JOIN audits a2 ON nc2.audit_id = a2.audit_id
             WHERE a2.organization_id = @orgId
               AND na.status IN ('completata', 'verificata')
               AND na.updated_at < DATEADD(day, -180, GETDATE())
           ) closed
           WHERE closed.id = kc.entity_id AND closed.et = kc.entity_type
         )`,
      { orgId: organizationId }
    );
    const staleFromClosed = staleClosedRes.rowsAffected ? staleClosedRes.rowsAffected[0] : 0;

    // Marca stale: chunk mai usati in 90 giorni (solo se la tabella ai_usage_log esiste ed ha dati)
    let staleFromUnused = 0;
    try {
      const unusedRes = await query(
        `UPDATE kc SET kc.is_stale = 1
         FROM knowledge_chunks kc
         WHERE kc.organization_id = @orgId
           AND (kc.is_stale = 0 OR kc.is_stale IS NULL)
           AND kc.usage_count = 0
           AND kc.last_indexed_at < DATEADD(day, -90, GETDATE())
           AND NOT EXISTS (
             SELECT 1 FROM ai_usage_log ul
             WHERE ul.organization_id = @orgId
               AND ul.created_at >= DATEADD(day, -90, GETDATE())
               AND ul.chunk_ids LIKE '%' + CAST(kc.id AS NVARCHAR(20)) + '%'
           )`,
        { orgId: organizationId }
      );
      staleFromUnused = unusedRes.rowsAffected ? unusedRes.rowsAffected[0] : 0;
    } catch (err) {
      logger.warn(`[KnowledgeOptimizer] prune unused check failed:`, err.message);
    }

    const totalStaled = staleFromClosed + staleFromUnused;
    const afterRes = await query(
      `SELECT COUNT(*) AS cnt FROM knowledge_chunks
       WHERE organization_id = @orgId AND (is_stale = 0 OR is_stale IS NULL)`,
      { orgId: organizationId }
    );
    const chunksAfter = (afterRes.recordset[0] || {}).cnt || 0;

    await completeRun(runId, {
      chunksBefore,
      chunksAfter,
      chunksRemoved: totalStaled,
      details: { staleFromClosed, staleFromUnused },
    });
    logger.info(`[KnowledgeOptimizer] prune org ${organizationId}: staled ${totalStaled} (closed=${staleFromClosed}, unused=${staleFromUnused})`);
    return { staled: totalStaled, staleFromClosed, staleFromUnused };
  } catch (err) {
    await completeRun(runId, { status: 'failed', details: { error: err.message } });
    logger.error(`[KnowledgeOptimizer] prune failed org ${organizationId}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 3. Gap detection
// ---------------------------------------------------------------------------

const EXPECTED_TYPES = ['audit_conclusion', 'non_conformity', 'qualification', 'document', 'risk', 'complaint'];

async function detectGaps(organizationId) {
  const runId = await createRun(organizationId, 'gap_detection');
  try {
    const companiesRes = await query(
      `SELECT id, name FROM companies WHERE organization_id = @orgId`,
      { orgId: organizationId }
    );
    const companies = companiesRes.recordset || [];

    const coverageRes = await query(
      `SELECT company_id, entity_type, COUNT(*) AS cnt
       FROM knowledge_chunks
       WHERE organization_id = @orgId AND (is_stale = 0 OR is_stale IS NULL)
       GROUP BY company_id, entity_type`,
      { orgId: organizationId }
    );
    const coverageMap = {};
    for (const r of (coverageRes.recordset || [])) {
      const key = r.company_id || 0;
      if (!coverageMap[key]) coverageMap[key] = {};
      coverageMap[key][r.entity_type] = r.cnt;
    }

    const gaps = [];
    for (const company of companies) {
      const types = coverageMap[company.id] || {};
      const missingTypes = EXPECTED_TYPES.filter(t => !types[t] || types[t] === 0);
      if (missingTypes.length > 0) {
        gaps.push({
          companyId: company.id,
          companyName: company.name,
          missingTypes,
        });
      }
    }

    await completeRun(runId, {
      chunksBefore: 0,
      chunksAfter: 0,
      details: { gaps, totalCompanies: companies.length, companiesWithGaps: gaps.length },
    });
    logger.info(`[KnowledgeOptimizer] gaps org ${organizationId}: ${gaps.length}/${companies.length} companies with gaps`);
    return gaps;
  } catch (err) {
    await completeRun(runId, { status: 'failed', details: { error: err.message } });
    logger.error(`[KnowledgeOptimizer] gap detection failed org ${organizationId}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 4. Orchestratore
// ---------------------------------------------------------------------------

async function runOptimization(organizationId) {
  logger.info(`[KnowledgeOptimizer] Starting optimization for org ${organizationId}`);
  const summary = {};

  try {
    summary.dedup = await deduplicateChunks(organizationId);
  } catch (err) {
    summary.dedup = { error: err.message };
  }

  try {
    summary.prune = await pruneStaleChunks(organizationId);
  } catch (err) {
    summary.prune = { error: err.message };
  }

  try {
    summary.gaps = await detectGaps(organizationId);
  } catch (err) {
    summary.gaps = { error: err.message };
  }

  logger.info(`[KnowledgeOptimizer] Optimization completed for org ${organizationId}`);
  return summary;
}

// ===========================================================================
// LIVELLO 2 — Sintesi AI settimanale
// ===========================================================================

/**
 * Inserisce un chunk sintetico generato dall'AI e ne calcola l'embedding.
 * @returns {number} id del chunk creato
 */
async function insertSyntheticChunk(organizationId, companyId, entityType, text, runId) {
  let embeddingJson = null;
  try {
    const [vec] = await embed([text]);
    if (vec) embeddingJson = JSON.stringify(vec);
  } catch (err) {
    logger.warn(`[KnowledgeOptimizer] embed synthetic chunk failed: ${err.message}`);
  }

  const res = await query(
    `INSERT INTO knowledge_chunks
       (organization_id, entity_type, entity_id, company_id, chunk_text, embedding, last_indexed_at, source_run_id)
     OUTPUT INSERTED.id
     VALUES (@orgId, @et, NULL, @cid, @text, @emb, GETDATE(), @runId)`,
    {
      orgId: organizationId,
      et: entityType,
      cid: companyId,
      text,
      emb: embeddingJson,
      runId,
    }
  );
  return res.recordset[0].id;
}

// ---------------------------------------------------------------------------
// L2-1. Condensazione storia azienda
// ---------------------------------------------------------------------------

async function condensateCompanyHistory(organizationId) {
  const runId = await createRun(organizationId, 'synthesis');
  let callCount = 0;
  let chunksCreated = 0;

  try {
    // Rimuovi sintesi precedenti per questa org (verranno rigenerate)
    await query(
      `DELETE FROM knowledge_chunks
       WHERE organization_id = @orgId AND entity_type IN ('ai_synthesis')
             AND source_run_id IS NOT NULL`,
      { orgId: organizationId }
    );

    // --- Sintesi audit_conclusion per azienda (> 5 chunk) ---
    const auditBuckets = await query(
      `SELECT company_id, COUNT(*) AS cnt
       FROM knowledge_chunks
       WHERE organization_id = @orgId AND entity_type = 'audit_conclusion'
             AND (is_stale = 0 OR is_stale IS NULL)
       GROUP BY company_id
       HAVING COUNT(*) > 5`,
      { orgId: organizationId }
    );

    for (const bucket of (auditBuckets.recordset || [])) {
      if (callCount >= L2_MAX_CALLS_PER_ORG) break;

      const chunksRes = await query(
        `SELECT chunk_text FROM knowledge_chunks
         WHERE organization_id = @orgId AND entity_type = 'audit_conclusion'
               AND (is_stale = 0 OR is_stale IS NULL)
               AND company_id ${bucket.company_id != null ? '= @cid' : 'IS NULL'}
         ORDER BY last_indexed_at DESC`,
        { orgId: organizationId, cid: bucket.company_id }
      );
      const texts = (chunksRes.recordset || []).map(r => r.chunk_text).join('\n---\n');

      const result = await chat([
        { role: 'system', content: 'Sei un esperto di sistemi di gestione qualità ISO 9001.' },
        {
          role: 'user',
          content: `Analizza questi dati di audit e genera un riassunto strutturato che includa: 1) pattern ricorrenti, 2) punti critici, 3) trend nel tempo, 4) clausole più problematiche. Rispondi in italiano, max 500 parole.\n\n${texts}`,
        },
      ], { temperature: 0.3, maxTokens: 1200 });
      callCount++;

      await insertSyntheticChunk(organizationId, bucket.company_id, 'ai_synthesis', result.content, runId);
      chunksCreated++;
    }

    // --- Sintesi non_conformity per azienda (> 3 chunk) ---
    const ncBuckets = await query(
      `SELECT company_id, COUNT(*) AS cnt
       FROM knowledge_chunks
       WHERE organization_id = @orgId AND entity_type = 'non_conformity'
             AND (is_stale = 0 OR is_stale IS NULL)
       GROUP BY company_id
       HAVING COUNT(*) > 3`,
      { orgId: organizationId }
    );

    for (const bucket of (ncBuckets.recordset || [])) {
      if (callCount >= L2_MAX_CALLS_PER_ORG) break;

      const chunksRes = await query(
        `SELECT chunk_text FROM knowledge_chunks
         WHERE organization_id = @orgId AND entity_type = 'non_conformity'
               AND (is_stale = 0 OR is_stale IS NULL)
               AND company_id ${bucket.company_id != null ? '= @cid' : 'IS NULL'}
         ORDER BY last_indexed_at DESC`,
        { orgId: organizationId, cid: bucket.company_id }
      );
      const texts = (chunksRes.recordset || []).map(r => r.chunk_text).join('\n---\n');

      const result = await chat([
        { role: 'system', content: 'Sei un esperto di sistemi di gestione qualità ISO 9001.' },
        {
          role: 'user',
          content: `Analizza queste non conformità di un'azienda e genera un riassunto dei pattern ricorrenti: 1) tipologie NC più frequenti, 2) aree critiche, 3) suggerimenti di prevenzione. Rispondi in italiano, max 400 parole.\n\n${texts}`,
        },
      ], { temperature: 0.3, maxTokens: 1000 });
      callCount++;

      await insertSyntheticChunk(organizationId, bucket.company_id, 'ai_synthesis', result.content, runId);
      chunksCreated++;
    }

    await completeRun(runId, { chunksCreated, details: { callCount } });
    logger.info(`[KnowledgeOptimizer] L2 synthesis org ${organizationId}: ${chunksCreated} chunks created, ${callCount} AI calls`);
    return { chunksCreated, callCount };
  } catch (err) {
    await completeRun(runId, { status: 'failed', details: { error: err.message, callCount } });
    logger.error(`[KnowledgeOptimizer] L2 synthesis failed org ${organizationId}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// L2-2. Pattern trasversali cross-company
// ---------------------------------------------------------------------------

async function extractCrossCompanyPatterns(organizationId) {
  const runId = await createRun(organizationId, 'cross_pattern');
  let chunksCreated = 0;

  try {
    // Rimuovi pattern precedenti per questa org
    await query(
      `DELETE FROM knowledge_chunks
       WHERE organization_id = @orgId AND entity_type = 'ai_pattern'
             AND source_run_id IS NOT NULL`,
      { orgId: organizationId }
    );

    const allNcRes = await query(
      `SELECT chunk_text FROM knowledge_chunks
       WHERE organization_id = @orgId AND entity_type = 'non_conformity'
             AND (is_stale = 0 OR is_stale IS NULL)
       ORDER BY last_indexed_at DESC`,
      { orgId: organizationId }
    );
    const ncChunks = allNcRes.recordset || [];

    if (ncChunks.length > 10) {
      const texts = ncChunks.map(r => r.chunk_text).join('\n---\n');

      const result = await chat([
        { role: 'system', content: 'Sei un esperto di sistemi di gestione qualità ISO 9001 con esperienza multi-azienda.' },
        {
          role: 'user',
          content: `Analizza queste non conformità provenienti da diverse aziende. Identifica: 1) le clausole ISO più frequentemente coinvolte, 2) pattern ricorrenti per settore, 3) suggerimenti di prevenzione basati sui dati. Rispondi in italiano, max 400 parole.\n\n${texts}`,
        },
      ], { temperature: 0.3, maxTokens: 1000 });

      await insertSyntheticChunk(organizationId, null, 'ai_pattern', result.content, runId);
      chunksCreated++;
    }

    await completeRun(runId, { chunksCreated, details: { totalNcChunks: ncChunks.length } });
    logger.info(`[KnowledgeOptimizer] L2 cross-patterns org ${organizationId}: ${chunksCreated} patterns from ${ncChunks.length} NC chunks`);
    return { chunksCreated, totalNcChunks: ncChunks.length };
  } catch (err) {
    await completeRun(runId, { status: 'failed', details: { error: err.message } });
    logger.error(`[KnowledgeOptimizer] L2 cross-patterns failed org ${organizationId}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// L2-3. Riformulazione chunk a basso score
// ---------------------------------------------------------------------------

async function enrichLowScoreChunks(organizationId) {
  const runId = await createRun(organizationId, 'enrichment');
  let enriched = 0;
  let callCount = 0;

  try {
    // Trova chunk usati ma con basso score e follow-up (stessa sessione, entro 5 min)
    const lowScoreRes = await query(
      `SELECT TOP 10
         ul1.chunk_ids, ul1.avg_chunk_score
       FROM ai_usage_log ul1
       WHERE ul1.organization_id = @orgId
         AND ul1.avg_chunk_score < 0.4
         AND ul1.avg_chunk_score > 0
         AND ul1.chunk_ids IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM ai_usage_log ul2
           WHERE ul2.organization_id = @orgId
             AND ul2.user_id = ul1.user_id
             AND ul2.created_at > ul1.created_at
             AND ul2.created_at <= DATEADD(minute, 5, ul1.created_at)
         )
       ORDER BY ul1.avg_chunk_score ASC`,
      { orgId: organizationId }
    );

    const seenChunkIds = new Set();
    for (const row of (lowScoreRes.recordset || [])) {
      if (callCount >= L2_MAX_CALLS_PER_ORG) break;

      let chunkIds;
      try { chunkIds = JSON.parse(row.chunk_ids); } catch { continue; }
      if (!Array.isArray(chunkIds)) continue;

      for (const chunkId of chunkIds) {
        if (callCount >= L2_MAX_CALLS_PER_ORG) break;
        if (seenChunkIds.has(chunkId)) continue;
        seenChunkIds.add(chunkId);

        const chunkRes = await query(
          `SELECT id, chunk_text, entity_type FROM knowledge_chunks
           WHERE id = @id AND organization_id = @orgId
                 AND entity_type NOT LIKE 'ai_%'`,
          { id: chunkId, orgId: organizationId }
        );
        const chunk = (chunkRes.recordset || [])[0];
        if (!chunk || !chunk.chunk_text) continue;

        const result = await chat([
          { role: 'system', content: 'Sei un esperto di riformulazione testi per ricerca semantica in ambito ISO 9001.' },
          {
            role: 'user',
            content: `Questo testo è usato come contesto in una ricerca semantica ma ha basso score di pertinenza. Riformulalo in modo più chiaro e ricercabile, mantenendo TUTTE le informazioni fattuali. Non aggiungere dati inventati.\n\n${chunk.chunk_text}`,
          },
        ], { temperature: 0.2, maxTokens: 800 });
        callCount++;

        let newEmbedding = null;
        try {
          const [vec] = await embed([result.content]);
          if (vec) newEmbedding = JSON.stringify(vec);
        } catch (err) {
          logger.warn(`[KnowledgeOptimizer] re-embed chunk ${chunkId} failed: ${err.message}`);
        }

        await query(
          `UPDATE knowledge_chunks
           SET chunk_text = @text, embedding = COALESCE(@emb, embedding), last_indexed_at = GETDATE()
           WHERE id = @id`,
          { id: chunkId, text: result.content, emb: newEmbedding }
        );
        enriched++;
      }
    }

    await completeRun(runId, { chunksCreated: enriched, details: { callCount, enriched } });
    logger.info(`[KnowledgeOptimizer] L2 enrichment org ${organizationId}: ${enriched} chunks enriched, ${callCount} AI calls`);
    return { enriched, callCount };
  } catch (err) {
    await completeRun(runId, { status: 'failed', details: { error: err.message, callCount } });
    logger.error(`[KnowledgeOptimizer] L2 enrichment failed org ${organizationId}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Orchestratore Livello 2
// ---------------------------------------------------------------------------

async function runLevel2Optimization(organizationId) {
  logger.info(`[KnowledgeOptimizer] Starting L2 optimization for org ${organizationId}`);
  const summary = {};

  try {
    summary.synthesis = await condensateCompanyHistory(organizationId);
  } catch (err) {
    summary.synthesis = { error: err.message };
  }

  try {
    summary.crossPatterns = await extractCrossCompanyPatterns(organizationId);
  } catch (err) {
    summary.crossPatterns = { error: err.message };
  }

  try {
    summary.enrichment = await enrichLowScoreChunks(organizationId);
  } catch (err) {
    summary.enrichment = { error: err.message };
  }

  logger.info(`[KnowledgeOptimizer] L2 optimization completed for org ${organizationId}`);
  return summary;
}

module.exports = {
  deduplicateChunks,
  pruneStaleChunks,
  detectGaps,
  runOptimization,
  condensateCompanyHistory,
  extractCrossCompanyPatterns,
  enrichLowScoreChunks,
  runLevel2Optimization,
};
