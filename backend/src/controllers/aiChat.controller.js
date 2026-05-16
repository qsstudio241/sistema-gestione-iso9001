/**
 * aiChat.controller.js — Assistente AI globale SGQ
 *
 * POST /ai/chat  — risponde a domande libere usando il contesto indicizzato
 * POST /ai/reindex — re-indicizza tutti i dati per l'organizzazione (admin)
 * GET  /ai/knowledge-health — KPI salute knowledge base (admin)
 */

const logger = require('../utils/logger');
const { query } = require('../config/database');
const { chat, getActiveProvider } = require('../services/aiProviderAdapter');
const { searchKnowledge, indexAllEntities } = require('../services/knowledgeIndexer.service');

const BASE_SYSTEM_PROMPT = `Sei l'assistente AI del Sistema di Gestione Qualità ISO 9001 di questa organizzazione.
Rispondi in italiano in modo chiaro, professionale e sintetico.
Basati ESCLUSIVAMENTE sui dati forniti nel contesto. Se non hai informazioni sufficienti per rispondere, dillo chiaramente.
Non inventare dati, numeri o riferimenti non presenti nel contesto.
Quando citi dati specifici (audit, NC, documenti, rischi), indica il riferimento (numero, codice, data) per permettere all'utente di verificare.
Formatta le risposte in modo leggibile: usa elenchi puntati per liste, grassetto per i punti chiave.`;

/**
 * Carica il profilo azienda da DB per arricchire il system prompt.
 */
async function loadCompanyProfile(companyId, organizationId) {
  try {
    const result = await query(
      `SELECT name, vat_number, sector, address
       FROM companies
       WHERE id = @id AND organization_id = @orgId`,
      { id: companyId, orgId: organizationId }
    );
    return (result.recordset || [])[0] || null;
  } catch (err) {
    logger.warn('[AI_CHAT] loadCompanyProfile failed:', err.message);
    return null;
  }
}

/**
 * Fire-and-forget: logga l'uso dell'assistente AI in ai_usage_log
 * e incrementa usage_count sui chunk utilizzati.
 */
async function logUsage({ organizationId, userId, companyId, message, reply, contextChunks, responseTimeMs }) {
  const chunkIds = contextChunks.map(c => c.id).filter(Boolean);
  const avgScore = contextChunks.length > 0
    ? contextChunks.reduce((sum, c) => sum + (c.score || 0), 0) / contextChunks.length
    : null;

  await query(
    `INSERT INTO ai_usage_log
      (organization_id, user_id, company_id, message, reply_preview, chunks_used,
       chunk_ids, avg_chunk_score, response_time_ms)
     VALUES
      (@orgId, @userId, @companyId, @message, @reply, @chunksUsed,
       @chunkIds, @avgScore, @responseTime)`,
    {
      orgId: organizationId,
      userId,
      companyId: companyId || null,
      message: (message || '').substring(0, 2000),
      reply: (reply || '').substring(0, 500),
      chunksUsed: contextChunks.length,
      chunkIds: chunkIds.length > 0 ? JSON.stringify(chunkIds) : null,
      avgScore: avgScore != null ? parseFloat(avgScore.toFixed(4)) : null,
      responseTime: responseTimeMs || null,
    }
  );

  if (chunkIds.length > 0) {
    const paramObj = {};
    const placeholders = chunkIds.map((id, i) => {
      paramObj[`cid${i}`] = id;
      return `@cid${i}`;
    });
    await query(
      `UPDATE knowledge_chunks SET usage_count = ISNULL(usage_count, 0) + 1
       WHERE id IN (${placeholders.join(',')})`,
      paramObj
    );
  }
}

/**
 * POST /ai/chat
 * Body: { message: string, companyId?: number|null }
 */
async function aiChat(req, res) {
  const startTime = Date.now();
  try {
    const provider = getActiveProvider();
    if (!provider) {
      return res.status(503).json({
        error: 'Nessun provider AI configurato.',
        code: 'AI_NOT_CONFIGURED',
      });
    }

    const { message, companyId } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Il campo "message" \u00e8 obbligatorio.',
        code: 'MISSING_PARAMS',
      });
    }

    const organizationId = req.user.organization_id;
    const userId = req.user.user_id;
    const parsedCompanyId = companyId ? parseInt(companyId, 10) || null : null;

    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (parsedCompanyId) {
      const company = await loadCompanyProfile(parsedCompanyId, organizationId);
      if (company) {
        const companyLines = [`\n\n--- CONTESTO AZIENDA ATTIVA ---`];
        companyLines.push(`Nome: ${company.name}`);
        if (company.vat_number) companyLines.push(`P.IVA: ${company.vat_number}`);
        if (company.sector) companyLines.push(`Settore: ${company.sector}`);
        if (company.address) companyLines.push(`Indirizzo: ${company.address}`);
        companyLines.push(`--- FINE CONTESTO AZIENDA ---`);
        companyLines.push(`Le domande dell'utente si riferiscono specificamente a questa azienda. Filtra le risposte di conseguenza.`);
        systemPrompt += companyLines.join('\n');
      }
    }

    let contextChunks = [];
    try {
      contextChunks = await searchKnowledge(message.trim(), organizationId, {
        topK: 15,
        minScore: 0.2,
        companyId: parsedCompanyId,
      });
    } catch (err) {
      logger.warn('[AI_CHAT] searchKnowledge failed, proceeding without context:', err.message);
    }

    let contextBlock = '';
    if (contextChunks.length > 0) {
      const contextLines = contextChunks.map((c, i) =>
        `[${i + 1}] (${c.entity_type}, score: ${c.score.toFixed(2)})\n${c.chunk_text}`
      );
      contextBlock = `\n\n--- CONTESTO DALL'ORGANIZZAZIONE ---\n${contextLines.join('\n\n')}\n--- FINE CONTESTO ---\n\n`;
    } else {
      contextBlock = '\n\n[Nessun dato indicizzato trovato per questa domanda. Rispondi indicando che non ci sono dati disponibili e suggerisci di eseguire la re-indicizzazione.]\n\n';
    }

    const userPrompt = `${contextBlock}Domanda dell'utente: ${message.trim()}`;

    const result = await chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, timeout: 90000 }
    );

    const responseTimeMs = Date.now() - startTime;

    // Fire-and-forget usage log
    logUsage({
      organizationId,
      userId,
      companyId: parsedCompanyId,
      message: message.trim(),
      reply: result.content,
      contextChunks,
      responseTimeMs,
    }).catch(err => logger.warn('[AI_CHAT] Usage log failed:', err.message));

    res.json({
      reply: result.content,
      contextUsed: contextChunks.length,
      _aiMeta: {
        provider,
        model: result.model,
        tokens: result.tokens,
        cost: result.cost,
      },
    });
  } catch (err) {
    logger.error('[AI_CHAT] Error:', err.message);
    const status = err.code === 'AI_NOT_CONFIGURED' ? 503 : err.status || 500;
    res.status(status).json({
      error: err.message,
      code: err.code || 'AI_CHAT_ERROR',
    });
  }
}

/**
 * POST /ai/reindex
 * Avvia la re-indicizzazione di tutti i dati SGQ per l'organizzazione.
 */
async function aiReindex(req, res) {
  try {
    const organizationId = req.user.organization_id;
    logger.info(`[AI_REINDEX] Manual reindex requested by user ${req.user.user_id} for org ${organizationId}`);

    const totalChunks = await indexAllEntities(organizationId);

    res.json({
      success: true,
      message: `Indicizzazione completata: ${totalChunks} chunk generati.`,
      totalChunks,
    });
  } catch (err) {
    logger.error('[AI_REINDEX] Error:', err.message);
    res.status(500).json({
      error: 'Errore durante la re-indicizzazione.',
      code: 'REINDEX_ERROR',
    });
  }
}

/**
 * GET /ai/knowledge-health
 * KPI sulla salute della knowledge base per l'organizzazione (solo admin/superadmin).
 */
async function knowledgeHealth(req, res) {
  try {
    const organizationId = req.user.organization_id;

    const [
      totalRes,
      staleRes,
      coverageRes,
      usageRes,
      topCompaniesRes,
      avgTimeRes,
      lastOptRes,
      qualityRes,
    ] = await Promise.all([
      query(
        `SELECT COUNT(*) AS cnt FROM knowledge_chunks
         WHERE organization_id = @orgId AND (is_stale = 0 OR is_stale IS NULL)`,
        { orgId: organizationId }
      ),
      query(
        `SELECT COUNT(*) AS cnt FROM knowledge_chunks
         WHERE organization_id = @orgId AND is_stale = 1`,
        { orgId: organizationId }
      ),
      query(
        `SELECT c.id AS company_id, c.name AS company_name, kc.entity_type,
                COUNT(*) AS chunk_count
         FROM companies c
         LEFT JOIN knowledge_chunks kc
           ON kc.company_id = c.id AND kc.organization_id = c.organization_id
              AND (kc.is_stale = 0 OR kc.is_stale IS NULL)
         WHERE c.organization_id = @orgId
         GROUP BY c.id, c.name, kc.entity_type
         ORDER BY c.name, kc.entity_type`,
        { orgId: organizationId }
      ),
      query(
        `SELECT COUNT(*) AS cnt FROM ai_usage_log
         WHERE organization_id = @orgId AND created_at >= DATEADD(day, -30, GETDATE())`,
        { orgId: organizationId }
      ),
      query(
        `SELECT TOP 5 company_id, COUNT(*) AS cnt
         FROM ai_usage_log
         WHERE organization_id = @orgId AND company_id IS NOT NULL
               AND created_at >= DATEADD(day, -30, GETDATE())
         GROUP BY company_id ORDER BY cnt DESC`,
        { orgId: organizationId }
      ),
      query(
        `SELECT AVG(response_time_ms) AS avg_ms FROM ai_usage_log
         WHERE organization_id = @orgId AND created_at >= DATEADD(day, -30, GETDATE())
               AND response_time_ms IS NOT NULL`,
        { orgId: organizationId }
      ),
      query(
        `SELECT TOP 1 id, run_type, started_at, completed_at, chunks_before,
                chunks_after, chunks_removed, chunks_created, status, details
         FROM ai_optimization_runs
         WHERE organization_id = @orgId
         ORDER BY started_at DESC`,
        { orgId: organizationId }
      ),
      query(
        `SELECT AVG(avg_chunk_score) AS avg_score FROM ai_usage_log
         WHERE organization_id = @orgId AND created_at >= DATEADD(day, -30, GETDATE())
               AND avg_chunk_score IS NOT NULL`,
        { orgId: organizationId }
      ),
    ]);

    // Riorganizza coverage per azienda
    const coverageMap = {};
    for (const row of (coverageRes.recordset || [])) {
      if (!coverageMap[row.company_id]) {
        coverageMap[row.company_id] = { companyId: row.company_id, companyName: row.company_name, types: {} };
      }
      if (row.entity_type) {
        coverageMap[row.company_id].types[row.entity_type] = row.chunk_count;
      }
    }

    // Arricchisci top companies con nome
    const topCompanies = (topCompaniesRes.recordset || []);
    if (topCompanies.length > 0) {
      const companyIds = topCompanies.map(c => c.company_id);
      const paramObj = {};
      const placeholders = companyIds.map((id, i) => { paramObj[`c${i}`] = id; return `@c${i}`; });
      const namesRes = await query(
        `SELECT id, name FROM companies WHERE id IN (${placeholders.join(',')})`,
        paramObj
      );
      const nameMap = {};
      for (const r of (namesRes.recordset || [])) nameMap[r.id] = r.name;
      for (const tc of topCompanies) tc.companyName = nameMap[tc.company_id] || null;
    }

    // Ultimo gap detection
    let gapsDetected = null;
    try {
      const gapRes = await query(
        `SELECT TOP 1 details FROM ai_optimization_runs
         WHERE organization_id = @orgId AND run_type = 'gap_detection' AND status = 'completed'
         ORDER BY started_at DESC`,
        { orgId: organizationId }
      );
      const row = (gapRes.recordset || [])[0];
      if (row && row.details) gapsDetected = JSON.parse(row.details);
    } catch { /* ignore */ }

    res.json({
      totalChunks: (totalRes.recordset[0] || {}).cnt || 0,
      staleChunks: (staleRes.recordset[0] || {}).cnt || 0,
      companyCoverage: Object.values(coverageMap),
      recentUsage: {
        last30Days: (usageRes.recordset[0] || {}).cnt || 0,
        topCompanies,
      },
      avgResponseTime: Math.round((avgTimeRes.recordset[0] || {}).avg_ms || 0),
      gapsDetected,
      lastOptimizationRun: (lastOptRes.recordset || [])[0] || null,
      retrievalQuality: parseFloat(((qualityRes.recordset[0] || {}).avg_score || 0).toFixed(4)),
    });
  } catch (err) {
    logger.error('[AI_HEALTH] Error:', err.message);
    res.status(500).json({
      error: 'Errore nel calcolo KPI knowledge base.',
      code: 'KNOWLEDGE_HEALTH_ERROR',
    });
  }
}

module.exports = { aiChat, aiReindex, knowledgeHealth };
