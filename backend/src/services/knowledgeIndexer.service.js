/**
 * knowledgeIndexer.service.js
 * Indicizza tutte le entit SGQ (audit, NC, reclami, qualifiche, rischi, documenti)
 * in chunk con embedding Gemini per la ricerca semantica dell'assistente AI.
 */

const { query } = require('../config/database');
const { embed } = require('./aiProviderAdapter');
const { chunkText } = require('./normChunker.service');
const logger = require('../utils/logger');

const EMBED_BATCH = 20;

const INDEXABLE_ENTITIES = [
  {
    entity_type: 'audit_conclusion',
    sql: `SELECT a.audit_id AS id, a.company_id, a.audit_number, a.audit_date, a.status,
            JSON_VALUE(a.audit_extra_data, '$.auditOutcome.conclusions') AS conclusions,
            c.name AS company_name
          FROM audits a
          LEFT JOIN companies c ON a.company_id = c.id
          WHERE a.organization_id = @orgId AND a.status != 'deleted'`,
    buildText: (r) => {
      const parts = [`Audit ${r.audit_number || ''} del ${r.audit_date || '?'}`];
      if (r.company_name) parts[0] += ` (${r.company_name})`;
      parts[0] += `  stato: ${r.status || '?'}`;
      if (r.conclusions) parts.push(`Conclusioni: ${r.conclusions}`);
      return parts.join('. ');
    },
  },
  {
    entity_type: 'non_conformity',
    sql: `SELECT nc.nc_id AS id, a.company_id, nc.nc_number, nc.section_code, nc.description,
            nc.severity, nc.status, nc.root_cause, nc.corrective_action
          FROM non_conformities nc
          JOIN audits a ON nc.audit_id = a.audit_id
          WHERE a.organization_id = @orgId`,
    buildText: (r) => {
      const parts = [`NC ${r.nc_number || ''}: ${r.description || ''}`];
      if (r.section_code) parts.push(`Clausola: ${r.section_code}`);
      parts.push(`Gravit\u00e0: ${r.severity || '?'}, Stato: ${r.status || '?'}`);
      if (r.root_cause) parts.push(`Causa radice: ${r.root_cause}`);
      if (r.resolution_summary) parts.push(`Riepilogo risoluzione: ${r.resolution_summary}`);
      return parts.join('. ');
    },
  },
  {
    entity_type: 'nc_action',
    sql: `SELECT na.action_id AS id, a.company_id, na.action_type, na.description, na.responsible, na.status,
            nc.nc_number
          FROM nc_actions na
          JOIN non_conformities nc ON na.nc_id = nc.nc_id
          JOIN audits a ON nc.audit_id = a.audit_id
          WHERE a.organization_id = @orgId`,
    buildText: (r) =>
      `Azione ${r.action_type || ''} per NC ${r.nc_number || ''}: ${r.description || ''}. Responsabile: ${r.responsible || 'N/D'}, Stato: ${r.status || '?'}`,
  },
  {
    entity_type: 'complaint',
    sql: `SELECT c.id, c.company_id, c.complaint_number, c.title, c.description,
            c.complaint_type, c.severity, c.status, c.customer_name,
            c.root_cause, c.resolution_summary
          FROM complaints c
          WHERE c.organization_id = @orgId`,
    buildText: (r) => {
      const parts = [`Reclamo ${r.complaint_number || ''}: ${r.title || ''}`];
      if (r.description) parts.push(r.description);
      if (r.complaint_type) parts.push(`Tipo: ${r.complaint_type}`);
      if (r.customer_name) parts.push(`Cliente: ${r.customer_name}`);
      if (r.severity) parts.push(`Gravit: ${r.severity}`);
      if (r.root_cause) parts.push(`Causa: ${r.root_cause}`);
      if (r.resolution_summary) parts.push(`Riepilogo risoluzione: ${r.resolution_summary}`);
      parts.push(`Stato: ${r.status || '?'}`);
      return parts.join('. ');
    },
  },
  {
    entity_type: 'qualification',
    sql: `SELECT q.id, q.company_id, q.person_name, q.qualification_type, q.standard_ref,
            q.scope_detail, q.certificate_number, q.issuing_body,
            q.expiry_date, q.status, q.notes,
            c.name AS company_name
          FROM qualifications q
          LEFT JOIN companies c ON q.company_id = c.id
          WHERE q.organization_id = @orgId`,
    buildText: (r) => {
      const parts = [`Qualifica di ${r.person_name}: ${r.qualification_type}`];
      if (r.standard_ref) parts.push(`Norma: ${r.standard_ref}`);
      if (r.scope_detail) parts.push(`Ambito: ${r.scope_detail}`);
      if (r.company_name) parts.push(`Azienda: ${r.company_name}`);
      if (r.issuing_body) parts.push(`Ente: ${r.issuing_body}`);
      if (r.expiry_date) parts.push(`Scadenza: ${r.expiry_date}`);
      parts.push(`Stato: ${r.status || '?'}`);
      if (r.notes) parts.push(`Note: ${r.notes}`);
      return parts.join('. ');
    },
  },
  {
    entity_type: 'risk',
    sql: `SELECT r.risk_id AS id, r.company_id, r.title, r.description, r.context, r.category,
            r.probability, r.impact, r.treatment, r.treatment_desc,
            r.responsible, r.status
          FROM risks r
          WHERE r.organization_id = @orgId AND r.is_deleted = 0`,
    buildText: (r) => {
      const score = (r.probability || 0) * (r.impact || 0);
      const parts = [`Rischio: ${r.title}`];
      if (r.description) parts.push(r.description);
      parts.push(`Contesto: ${r.context || '?'}, Categoria: ${r.category || 'N/D'}`);
      parts.push(`Probabilit: ${r.probability}, Impatto: ${r.impact}, Score: ${score}`);
      parts.push(`Trattamento: ${r.treatment || '?'}`);
      if (r.treatment_desc) parts.push(`Descrizione trattamento: ${r.treatment_desc}`);
      if (r.responsible) parts.push(`Responsabile: ${r.responsible}`);
      parts.push(`Stato: ${r.status || '?'}`);
      return parts.join('. ');
    },
  },
  {
    entity_type: 'document',
    sql: `SELECT dr.id, dr.company_id, dr.title, dr.doc_type, dr.doc_code, dr.revision,
            dr.status, dr.clause_ref, dr.responsible,
            c.name AS company_name
          FROM document_registry dr
          LEFT JOIN companies c ON dr.company_id = c.id
          WHERE dr.organization_id = @orgId AND dr.status != 'obsoleto'`,
    buildText: (r) => {
      const parts = [`Documento ${r.doc_code || ''} "${r.title}" rev.${r.revision || '0'} (${r.doc_type || '?'})`];
      if (r.clause_ref) parts.push(`Clausola: ${r.clause_ref}`);
      if (r.company_name) parts.push(`Azienda: ${r.company_name}`);
      if (r.responsible) parts.push(`Responsabile: ${r.responsible}`);
      parts.push(`Stato: ${r.status || '?'}`);
      return parts.join('. ');
    },
  },
];

/**
 * Verifica l'esistenza di una tabella prima di queryarla.
 */
async function tableExists(tableName) {
  const res = await query(
    "SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tbl",
    { tbl: tableName }
  );
  return (res.recordset || []).length > 0;
}

/**
 * Mappa entity_type ? tabella principale (per il check di esistenza).
 */
const ENTITY_TABLE_MAP = {
  audit_conclusion: 'audits',
  non_conformity: 'non_conformities',
  nc_action: 'nc_actions',
  complaint: 'complaints',
  qualification: 'qualifications',
  risk: 'risks',
  document: 'document_registry',
};

/**
 * Indicizza tutte le entit SGQ per un'organizzazione.
 */
async function indexAllEntities(organizationId) {
  logger.info(`[KnowledgeIndexer] Start indexing org ${organizationId}`);
  let totalChunks = 0;

  for (const entity of INDEXABLE_ENTITIES) {
    try {
      const tbl = ENTITY_TABLE_MAP[entity.entity_type];
      if (tbl && !(await tableExists(tbl))) {
        logger.warn(`[KnowledgeIndexer] Table ${tbl} not found, skipping ${entity.entity_type}`);
        continue;
      }

      // Elimina chunk precedenti di questo tipo per questa org (preserva chunk ai_*)
      await query(
        `DELETE FROM knowledge_chunks
         WHERE organization_id = @orgId AND entity_type = @et
               AND entity_type NOT LIKE 'ai_%'`,
        { orgId: organizationId, et: entity.entity_type }
      );

      const result = await query(entity.sql, { orgId: organizationId });
      const rows = result.recordset || [];
      if (rows.length === 0) {
        logger.debug(`[KnowledgeIndexer] ${entity.entity_type}: 0 rows for org ${organizationId}`);
        continue;
      }

      // Genera testi e chunk
      const allChunks = [];
      for (const row of rows) {
        const text = entity.buildText(row);
        if (!text || text.trim().length < 10) continue;

        const compId = row.company_id || null;
        const words = text.split(/\s+/);
        if (words.length > 500) {
          const parts = chunkText(text, 400, 50);
          for (const part of parts) {
            allChunks.push({ entityId: row.id, companyId: compId, text: part.text });
          }
        } else {
          allChunks.push({ entityId: row.id, companyId: compId, text });
        }
      }

      if (allChunks.length === 0) continue;

      // Embed a batch e inserisci
      for (let i = 0; i < allChunks.length; i += EMBED_BATCH) {
        const batch = allChunks.slice(i, i + EMBED_BATCH);
        let vectors;
        try {
          vectors = await embed(batch.map(c => c.text));
        } catch (err) {
          logger.error(`[KnowledgeIndexer] embed failed ${entity.entity_type} batch ${i}:`, err.message);
          vectors = batch.map(() => null);
        }

        for (let j = 0; j < batch.length; j++) {
          const c = batch[j];
          const vec = vectors[j] || null;
          await query(
            `INSERT INTO knowledge_chunks
              (organization_id, entity_type, entity_id, company_id, chunk_text, embedding, last_indexed_at)
             VALUES
              (@orgId, @et, @eid, @cid, @text, @emb, GETDATE())`,
            {
              orgId: organizationId,
              et: entity.entity_type,
              eid: c.entityId || null,
              cid: c.companyId || null,
              text: c.text,
              emb: vec ? JSON.stringify(vec) : null,
            }
          );
        }
      }

      totalChunks += allChunks.length;
      logger.info(`[KnowledgeIndexer] ${entity.entity_type}: ${allChunks.length} chunks indexed for org ${organizationId}`);
    } catch (err) {
      logger.error(`[KnowledgeIndexer] Error indexing ${entity.entity_type} for org ${organizationId}:`, err.message);
    }
  }

  logger.info(`[KnowledgeIndexer] Finished org ${organizationId}: ${totalChunks} total chunks`);
  return totalChunks;
}

// ---------------------------------------------------------------------------
// Ricerca semantica unificata (knowledge_chunks + norm_chunks)
// ---------------------------------------------------------------------------

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function vecNorm(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s);
}

function cosineSimilarity(a, b) {
  const d = dot(a, b);
  const na = vecNorm(a);
  const nb = vecNorm(b);
  if (na === 0 || nb === 0) return 0;
  return d / (na * nb);
}

/**
 * Cerca nei knowledge_chunks + norm_chunks unificati.
 * @param {string} queryText
 * @param {number} organizationId
 * @param {object} [options]
 * @param {number} [options.topK=15]
 * @param {number} [options.minScore=0.25]
 * @param {number|null} [options.companyId=null] - filtra chunk per azienda
 * @returns {Promise<Array<{entity_type, entity_id, chunk_text, score}>>}
 */
async function searchKnowledge(queryText, organizationId, options = {}) {
  const { topK = 15, minScore = 0.25, companyId = null } = options;

  const [queryVec] = await embed([queryText]);
  if (!queryVec) throw new Error('Failed to embed query text');

  // Load knowledge_chunks (con filtro opzionale per company_id, esclusi stale)
  let kcSql = `SELECT id, entity_type, entity_id, chunk_text, embedding
     FROM knowledge_chunks
     WHERE organization_id = @orgId AND embedding IS NOT NULL
           AND (is_stale = 0 OR is_stale IS NULL)`;
  const kcParams = { orgId: organizationId };

  if (companyId) {
    kcSql += ' AND (company_id = @compId OR company_id IS NULL)';
    kcParams.compId = companyId;
  }

  const kcResult = await query(kcSql, kcParams);

  // Load norm_chunks
  let ncRows = [];
  try {
    const ncResult = await query(
      `SELECT id, 'norm_content' AS entity_type, document_source_id AS entity_id,
              chunk_text, embedding
       FROM norm_chunks
       WHERE organization_id = @orgId AND embedding IS NOT NULL`,
      { orgId: organizationId }
    );
    ncRows = ncResult.recordset || [];
  } catch {
    // norm_chunks potrebbe non esistere in ambienti vecchi
  }

  const allRows = [...(kcResult.recordset || []), ...ncRows];
  if (allRows.length === 0) return [];

  const scored = [];
  for (const r of allRows) {
    let vec;
    try {
      vec = JSON.parse(r.embedding);
    } catch {
      continue;
    }
    const score = cosineSimilarity(queryVec, vec);
    if (score >= minScore) {
      scored.push({
        id: r.id,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        chunk_text: r.chunk_text,
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

module.exports = {
  indexAllEntities,
  searchKnowledge,
  INDEXABLE_ENTITIES,
};
