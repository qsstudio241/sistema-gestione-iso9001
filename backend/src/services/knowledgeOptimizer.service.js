/**
 * knowledgeOptimizer.service.js
 * Ottimizzazione continua della knowledge base AI.
 * Livello 1: housekeeping automatico (dedup, prune stale, gap detection)
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

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

module.exports = {
  deduplicateChunks,
  pruneStaleChunks,
  detectGaps,
  runOptimization,
};
