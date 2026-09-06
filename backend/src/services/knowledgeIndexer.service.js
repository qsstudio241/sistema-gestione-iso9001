/**
 * knowledgeIndexer.service.js
 * Indicizza tutte le entit SGQ (audit, NC, reclami, qualifiche, rischi, documenti)
 * in chunk con embedding Gemini per la ricerca semantica dell'assistente AI.
 */

const { query } = require('../config/database');
const { embed } = require('./aiProviderAdapter');
const { chunkText } = require('./normChunker.service');
const { extractDocumentText } = require('./documentTextExtractor.service');
const { getGeminiEmbedBatch, getGeminiEmbedPauseMs, pause } = require('./adapters/geminiKeyPool');
const logger = require('../utils/logger');

// Tipo chunk dedicato al contenuto testuale dei documenti allegati.
// Distinto da 'document' (solo metadati) per consentire prune/dedup mirati.
const DOCUMENT_CONTENT_ENTITY = 'document_content';

// Soglia minima di testo utile: sotto questa lunghezza il documento viene
// saltato (PDF immagine/scansioni senza OCR, file quasi vuoti).
const MIN_DOC_TEXT_LENGTH = 50;

/** Mappa codici norma → standard_id (allineata a aiStandardContext.service) */
const CODE_TO_STANDARD_ID = {
  ISO_9001: 1,
  ISO_9001_2015: 1,
  ISO_14001: 2,
  ISO_14001_2015: 2,
  ISO_45001: 3,
  ISO_45001_2018: 3,
  ISO_3834: 6,
  ISO_3834_2: 6,
  ISO_3834_2_2021: 6,
  RDP_MSN: 7,
};

/**
 * Deriva il company_id del chunk dall'etichetta esplicita content_scope.
 * (Decisione di prodotto: non dedurre piu' lo scope dal solo company_id NULL.)
 *
 *  - content_scope='client'              -> chunk legato all'azienda (company_id valorizzato)
 *  - content_scope='studio' | 'reference'-> chunk org-level (company_id NULL, know-how studio)
 *  - content_scope assente (dati legacy pre-migrazione 111) -> fallback al company_id
 *
 * In ogni caso organization_id = @orgId resta il vincolo di isolamento tenant.
 *
 * @param {{ content_scope?: string|null, company_id?: number|null }} row
 * @returns {number|null}
 */
function companyIdForContentScope(row) {
  const scope = row && row.content_scope;
  if (scope === 'studio' || scope === 'reference') return null;
  if (scope === 'client') return row.company_id || null;
  // Legacy / non classificato: comportamento storico (company_id se presente).
  return (row && row.company_id) || null;
}

/**
 * Risolve standard_id quando la colonna DB è null (documenti norma, qualifiche).
 */
function inferStandardId(row, entityType) {
  if (row.standard_id) return row.standard_id;
  if (entityType === 'document' && row.type_specific_data) {
    try {
      const tsd = typeof row.type_specific_data === 'string'
        ? JSON.parse(row.type_specific_data)
        : row.type_specific_data;
      const code = tsd?.standard_code;
      if (code && CODE_TO_STANDARD_ID[code]) return CODE_TO_STANDARD_ID[code];
    } catch (_) { /* ignore */ }
  }
  if (entityType === 'qualification' && row.standard_ref) {
    const ref = String(row.standard_ref).toUpperCase();
    if (ref.includes('9001')) return 1;
    if (ref.includes('14001')) return 2;
    if (ref.includes('45001')) return 3;
    if (ref.includes('3834')) return 6;
  }
  return null;
}

// Soglia minima di testo per note audit: sotto questa lunghezza la nota viene
// saltata (risposte con note vuote, status puri senza commento).
const MIN_AUDIT_NOTE_LENGTH = 20;

const INDEXABLE_ENTITIES = [
  {
    entity_type: 'audit_response_note',
    sql: `SELECT ar.response_id AS id, a.company_id,
            COALESCE(a.standard_id, (
              SELECT TOP 1 ast.standard_id FROM audit_standards ast
              WHERE ast.audit_id = a.audit_id ORDER BY ast.standard_id
            )) AS standard_id,
            a.audit_number, a.audit_date,
            ar.conformity_status, ar.notes,
            cq.section_code, cq.question_text,
            c.name AS company_name
          FROM audit_responses ar
          JOIN audits a ON ar.audit_id = a.audit_id
          JOIN checklist_questions cq ON ar.question_id = cq.question_id
          LEFT JOIN companies c ON a.company_id = c.id
          WHERE a.organization_id = @orgId
            AND a.status != 'deleted'
            AND ar.notes IS NOT NULL
            AND LEN(ar.notes) > ${MIN_AUDIT_NOTE_LENGTH}`,
    buildText: (r) => {
      const parts = [];
      const header = `Audit ${r.audit_number || '?'} del ${r.audit_date || '?'}`;
      if (r.company_name) parts.push(`${header} (${r.company_name})`);
      else parts.push(header);
      if (r.section_code) parts.push(`Clausola ${r.section_code}`);
      if (r.question_text) parts.push(`Domanda: ${r.question_text}`);
      if (r.conformity_status) parts.push(`Esito: ${r.conformity_status}`);
      parts.push(`Note consulente: ${r.notes}`);
      return parts.join('. ');
    },
  },
  {
    entity_type: 'audit_conclusion',
    sql: `SELECT a.audit_id AS id, a.company_id,
            COALESCE(a.standard_id, (
              SELECT TOP 1 ast.standard_id FROM audit_standards ast
              WHERE ast.audit_id = a.audit_id ORDER BY ast.standard_id
            )) AS standard_id,
            a.audit_number, a.audit_date, a.status,
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
    sql: `SELECT nc.nc_id AS id, a.company_id,
            COALESCE(a.standard_id, (
              SELECT TOP 1 ast.standard_id FROM audit_standards ast
              WHERE ast.audit_id = a.audit_id ORDER BY ast.standard_id
            )) AS standard_id,
            nc.nc_number, nc.section_code, nc.description,
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
    sql: `SELECT na.action_id AS id, a.company_id,
            COALESCE(a.standard_id, (
              SELECT TOP 1 ast.standard_id FROM audit_standards ast
              WHERE ast.audit_id = a.audit_id ORDER BY ast.standard_id
            )) AS standard_id,
            na.action_type, na.description, na.responsible, na.status,
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
    sql: `SELECT dr.id, dr.company_id, dr.content_scope, dr.standard_id, dr.title, dr.doc_type, dr.doc_code, dr.revision,
            dr.status, dr.clause_ref, dr.responsible, dr.type_specific_data,
            c.name AS company_name
          FROM document_registry dr
          LEFT JOIN companies c ON dr.company_id = c.id
          WHERE dr.organization_id = @orgId AND dr.status != 'obsoleto'`,
    resolveCompanyId: companyIdForContentScope,
    buildText: (r) => {
      const parts = [`Documento ${r.doc_code || ''} "${r.title}" rev.${r.revision || '0'} (${r.doc_type || '?'})`];
      if (r.clause_ref) parts.push(`Clausola: ${r.clause_ref}`);
      if (r.company_name) parts.push(`Azienda: ${r.company_name}`);
      if (r.responsible) parts.push(`Responsabile: ${r.responsible}`);
      parts.push(`Stato: ${r.status || '?'}`);
      // Arricchimento metadati per norme (R5)
      if (r.doc_type === 'norma' && r.type_specific_data) {
        try {
          const tsd = typeof r.type_specific_data === 'string'
            ? JSON.parse(r.type_specific_data)
            : r.type_specific_data;
          if (tsd.standard_code) parts.push(`Codice norma: ${tsd.standard_code}`);
          if (tsd.issuing_body)  parts.push(`Ente: ${tsd.issuing_body}`);
          if (tsd.edition_year)  parts.push(`Edizione: ${tsd.edition_year}`);
          if (tsd.validity_status) parts.push(`Vigore: ${tsd.validity_status}`);
          if (tsd.superseded_by) parts.push(`Sostituita da: ${tsd.superseded_by}`);
        } catch (_) { /* JSON malformato: ignora */ }
      }
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
  audit_response_note: 'audit_responses',
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

        const compId = entity.resolveCompanyId
          ? entity.resolveCompanyId(row)
          : (row.company_id || null);
        const stdId = inferStandardId(row, entity.entity_type);
        const words = text.split(/\s+/);
        if (words.length > 500) {
          const parts = chunkText(text, 400, 50);
          for (const part of parts) {
            allChunks.push({ entityId: row.id, companyId: compId, standardId: stdId, text: part.text });
          }
        } else {
          allChunks.push({ entityId: row.id, companyId: compId, standardId: stdId, text });
        }
      }

      if (allChunks.length === 0) continue;

      const embedBatch = getGeminiEmbedBatch();
      const embedPauseMs = getGeminiEmbedPauseMs();
      // Embed a batch e inserisci
      for (let i = 0; i < allChunks.length; i += embedBatch) {
        if (i > 0) await pause(embedPauseMs);
        const batch = allChunks.slice(i, i + embedBatch);
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
              (organization_id, entity_type, entity_id, company_id, standard_id, chunk_text, embedding, last_indexed_at)
             VALUES
              (@orgId, @et, @eid, @cid, @sid, @text, @emb, GETDATE())`,
            {
              orgId: organizationId,
              et: entity.entity_type,
              eid: c.entityId || null,
              cid: c.companyId || null,
              sid: c.standardId || null,
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

  // Indicizza il CONTENUTO testuale dei documenti allegati (PDF/DOCX/testo).
  try {
    const docContentChunks = await indexDocumentContents(organizationId);
    totalChunks += docContentChunks;
  } catch (err) {
    logger.error(`[KnowledgeIndexer] Error indexing document_content for org ${organizationId}:`, err.message);
  }

  logger.info(`[KnowledgeIndexer] Finished org ${organizationId}: ${totalChunks} total chunks`);
  return totalChunks;
}

/**
 * Indicizza il contenuto testuale dei file allegati ai documenti del registro.
 *
 * Scope studio-vs-cliente (vincolo di prodotto, etichetta ESPLICITA content_scope):
 *  - content_scope='client'               → chunk con company_id (visibile solo
 *    nel contesto di quell'azienda cliente).
 *  - content_scope='studio' | 'reference' → chunk org-level (know-how trasversale
 *    dello studio / norme condivise), company_id NULL.
 *  - content_scope assente (dati legacy)  → fallback al company_id (vedi
 *    companyIdForContentScope).
 * In ogni caso organization_id = @orgId garantisce l'isolamento tenant:
 * un chunk non è MAI accessibile da un'altra organizzazione.
 *
 * Idempotenza: i chunk 'document_content' della org vengono eliminati prima di
 * reinserire, quindi un re-index non produce duplicati (stessa logica usata per
 * le altre entità).
 *
 * @param {number} organizationId
 * @returns {Promise<number>} numero di chunk indicizzati
 */
async function indexDocumentContents(organizationId) {
  // Le tabelle/colonne potrebbero non esistere in ambienti vecchi: degrada con grazia.
  if (!(await tableExists('document_registry')) || !(await tableExists('attachments'))) {
    logger.warn('[KnowledgeIndexer] document_registry/attachments non presenti, skip document_content');
    return 0;
  }

  // Elimina chunk precedenti di questo tipo per questa org (idempotenza).
  await query(
    `DELETE FROM knowledge_chunks
     WHERE organization_id = @orgId AND entity_type = @et`,
    { orgId: organizationId, et: DOCUMENT_CONTENT_ENTITY }
  );

  // Documenti con file corrente allegato (una riga per documento).
  let rows;
  try {
    const result = await query(
      `SELECT dr.id AS document_id, dr.company_id, dr.content_scope, dr.standard_id, dr.title,
              dr.doc_code, dr.revision, dr.type_specific_data,
              a.attachment_id, a.storage_path, a.mime_type, a.file_name
       FROM document_registry dr
       JOIN attachments a
            ON a.document_id = dr.id AND a.is_current_doc_version = 1
       WHERE dr.organization_id = @orgId AND dr.status != 'obsoleto'`,
      { orgId: organizationId }
    );
    rows = result.recordset || [];
  } catch (err) {
    logger.warn(`[KnowledgeIndexer] query document_content fallita (colonne mancanti?): ${err.message}`);
    return 0;
  }

  if (rows.length === 0) {
    logger.debug(`[KnowledgeIndexer] document_content: 0 documenti con allegato per org ${organizationId}`);
    return 0;
  }

  // Estrazione testo + chunking (mantiene scope per ogni chunk).
  const allChunks = [];
  let skipped = 0;
  for (const row of rows) {
    let extracted;
    try {
      extracted = await extractDocumentText(row.storage_path, row.mime_type, row.file_name);
    } catch (err) {
      logger.warn(`[KnowledgeIndexer] estrazione doc ${row.document_id} fallita: ${err.message}`);
      extracted = { text: null, reason: 'extractor_error' };
    }

    const text = extracted && extracted.text;
    if (!text || text.trim().length < MIN_DOC_TEXT_LENGTH) {
      skipped++;
      logger.debug(`[KnowledgeIndexer] doc ${row.document_id} saltato (${(extracted && extracted.reason) || 'too_short'})`);
      continue;
    }

    const compId = companyIdForContentScope(row);
    const stdId = inferStandardId(row, 'document');
    const parts = chunkText(text, 400, 50);
    for (const part of parts) {
      if (!part.text || part.text.trim().length < 10) continue;
      allChunks.push({
        entityId: row.document_id,
        companyId: compId,
        standardId: stdId,
        text: part.text,
      });
    }
  }

  if (allChunks.length === 0) {
    logger.info(`[KnowledgeIndexer] document_content org ${organizationId}: 0 chunk (${skipped} doc saltati)`);
    return 0;
  }

  const embedBatch = getGeminiEmbedBatch();
  const embedPauseMs = getGeminiEmbedPauseMs();
  // Embed a batch e inserisci (stesso flusso delle altre entità).
  for (let i = 0; i < allChunks.length; i += embedBatch) {
    if (i > 0) await pause(embedPauseMs);
    const batch = allChunks.slice(i, i + embedBatch);
    let vectors;
    try {
      vectors = await embed(batch.map(c => c.text));
    } catch (err) {
      logger.error(`[KnowledgeIndexer] embed document_content batch ${i} fallito:`, err.message);
      vectors = batch.map(() => null);
    }

    for (let j = 0; j < batch.length; j++) {
      const c = batch[j];
      const vec = vectors[j] || null;
      await query(
        `INSERT INTO knowledge_chunks
          (organization_id, entity_type, entity_id, company_id, standard_id, chunk_text, embedding, last_indexed_at)
         VALUES
          (@orgId, @et, @eid, @cid, @sid, @text, @emb, GETDATE())`,
        {
          orgId: organizationId,
          et: DOCUMENT_CONTENT_ENTITY,
          eid: c.entityId || null,
          cid: c.companyId || null,
          sid: c.standardId || null,
          text: c.text,
          emb: vec ? JSON.stringify(vec) : null,
        }
      );
    }
  }

  logger.info(`[KnowledgeIndexer] document_content org ${organizationId}: ${allChunks.length} chunk da ${rows.length - skipped} documenti (${skipped} saltati)`);
  return allChunks.length;
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
 * @param {boolean} [options.studioSafeOverview=false] - SB-4: senza Ambito azienda
 *   limita ai chunk org-level (company_id IS NULL), niente testi clienti mescolati
 * @param {number|null} [options.standardId=null] - filtra chunk per norma
 * @param {string[]} [options.standardCodes=[]] - codici norma per filtrare norm_chunks
 * @returns {Promise<Array<{entity_type, entity_id, chunk_text, score}>>}
 */
async function searchKnowledge(queryText, organizationId, options = {}) {
  const {
    topK = 15,
    minScore = 0.25,
    companyId = null,
    studioSafeOverview = false,
    standardId = null,
    standardCodes = [],
  } = options;

  const [queryVec] = await embed([queryText]);
  if (!queryVec) throw new Error('Failed to embed query text');

  // Load knowledge_chunks (con filtro opzionale per company_id, esclusi stale)
  let kcSql = `SELECT id, entity_type, entity_id, chunk_text, embedding
     FROM knowledge_chunks
     WHERE organization_id = @orgId AND embedding IS NOT NULL
           AND (is_stale = 0 OR is_stale IS NULL)`;
  const kcParams = { orgId: organizationId };

  if (companyId) {
    kcSql += ' AND company_id = @compId';
    kcParams.compId = companyId;
  } else if (studioSafeOverview) {
    // SB-4: overview studio — solo know-how studio/reference, mai chunk client misti
    kcSql += ' AND company_id IS NULL';
  }

  if (standardId) {
    kcSql += ' AND (standard_id = @stdId OR standard_id IS NULL)';
    kcParams.stdId = standardId;
  }

  const kcResult = await query(kcSql, kcParams);

  // Load norm_chunks
  let ncRows = [];
  try {
    let ncSql = `SELECT id, 'norm_content' AS entity_type, document_source_id AS entity_id,
                        standard_code, chunk_text, embedding
                 FROM norm_chunks
                 WHERE organization_id = @orgId AND embedding IS NOT NULL`;
    const ncParams = { orgId: organizationId };

    if (standardCodes.length > 0) {
      const codeParams = {};
      const placeholders = standardCodes.map((code, i) => {
        codeParams[`sc${i}`] = code;
        return `@sc${i}`;
      });
      ncSql += ` AND (standard_code IN (${placeholders.join(', ')}) OR standard_code IS NULL)`;
      Object.assign(ncParams, codeParams);
    }

    const ncResult = await query(ncSql, ncParams);
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

// ---------------------------------------------------------------------------
// Feedback loop: converte ai_feedback accettati/corretti in knowledge chunks
// ---------------------------------------------------------------------------

const FEEDBACK_ENTITY_TYPE = 'ai_feedback_accepted';

/**
 * Processa i feedback AI (accepted/rephrased) e li converte in knowledge chunks
 * con embedding, cosi' il RAG li recupera naturalmente come contesto.
 *
 * Idempotenza: verifica l'esistenza del chunk tramite entity_type + entity_id
 * (= ai_feedback.id). Un re-run non produce duplicati.
 *
 * Multi-tenant: scoped per organization_id.
 *
 * @param {number} organizationId
 * @returns {Promise<number>} numero di nuovi chunk creati
 */
async function processFeedbackChunks(organizationId) {
  if (!(await tableExists('ai_feedback'))) {
    logger.debug('[KnowledgeIndexer] ai_feedback table not found, skip feedback processing');
    return 0;
  }

  let feedbackRows;
  try {
    const result = await query(
      `SELECT f.id, f.feature, f.action, f.ai_text, f.final_text,
              f.recommendation, f.context_summary, f.audit_id
       FROM ai_feedback f
       WHERE f.organization_id = @orgId
         AND f.action IN ('accepted', 'rephrased')
         AND f.final_text IS NOT NULL AND LEN(f.final_text) > 30
         AND NOT EXISTS (
           SELECT 1 FROM knowledge_chunks kc
           WHERE kc.organization_id = @orgId
             AND kc.entity_type = @et
             AND kc.entity_id = f.id
         )
       ORDER BY f.created_at DESC`,
      { orgId: organizationId, et: FEEDBACK_ENTITY_TYPE }
    );
    feedbackRows = result.recordset || [];
  } catch (err) {
    logger.warn(`[KnowledgeIndexer] feedback query failed: ${err.message}`);
    return 0;
  }

  if (feedbackRows.length === 0) return 0;

  const allChunks = [];
  for (const row of feedbackRows) {
    const parts = [];
    if (row.action === 'rephrased') {
      parts.push(`[Correzione utente] Feature: ${row.feature}.`);
      if (row.context_summary) parts.push(`Contesto: ${row.context_summary}.`);
      if (row.ai_text) parts.push(`L'AI aveva suggerito: ${row.ai_text.substring(0, 500)}`);
      parts.push(`L'utente ha corretto in: ${row.final_text}`);
    } else {
      parts.push(`[Risposta AI approvata] Feature: ${row.feature}.`);
      if (row.context_summary) parts.push(`Contesto: ${row.context_summary}.`);
      parts.push(row.final_text);
    }

    allChunks.push({
      feedbackId: row.id,
      text: parts.join(' '),
    });
  }

  let created = 0;
  const embedBatch = getGeminiEmbedBatch();
  const embedPauseMs = getGeminiEmbedPauseMs();
  for (let i = 0; i < allChunks.length; i += embedBatch) {
    if (i > 0) await pause(embedPauseMs);
    const batch = allChunks.slice(i, i + embedBatch);
    let vectors;
    try {
      vectors = await embed(batch.map(c => c.text));
    } catch (err) {
      logger.error(`[KnowledgeIndexer] embed feedback batch ${i} failed:`, err.message);
      vectors = batch.map(() => null);
    }

    for (let j = 0; j < batch.length; j++) {
      const c = batch[j];
      const vec = vectors[j] || null;
      try {
        await query(
          `INSERT INTO knowledge_chunks
            (organization_id, entity_type, entity_id, chunk_text, embedding, last_indexed_at)
           VALUES
            (@orgId, @et, @eid, @text, @emb, GETDATE())`,
          {
            orgId: organizationId,
            et: FEEDBACK_ENTITY_TYPE,
            eid: c.feedbackId,
            text: c.text,
            emb: vec ? JSON.stringify(vec) : null,
          }
        );
        created++;
      } catch (err) {
        logger.warn(`[KnowledgeIndexer] insert feedback chunk ${c.feedbackId} failed:`, err.message);
      }
    }
  }

  if (created > 0) {
    logger.info(`[KnowledgeIndexer] Feedback loop: ${created} new chunks from feedback for org ${organizationId}`);
  }
  return created;
}

module.exports = {
  indexAllEntities,
  indexDocumentContents,
  searchKnowledge,
  processFeedbackChunks,
  companyIdForContentScope,
  INDEXABLE_ENTITIES,
  DOCUMENT_CONTENT_ENTITY,
  FEEDBACK_ENTITY_TYPE,
};
