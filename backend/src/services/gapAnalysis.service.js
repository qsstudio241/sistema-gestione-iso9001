/**
 * gapAnalysis.service.js — Gap analysis (ADR-010)
 *
 * Due percorsi distinti:
 * 1) runGapAnalysis — euristica documenti (HK-8, licenza ai_norms)
 * 2) SAL Fase 0 — motore dati operativo requirement_implementation_status (licenza sal)
 */

const logger = require('../utils/logger');
const { query } = require('../config/database');

/** Stati implementazione SAL (Fase 0) */
const SAL_STATUS_VALUES = Object.freeze([
  'discussed',
  'in_progress',
  'to_validate',
  'completed',
  'na',
]);

const SAL_DEFAULT_STANDARD_CODES = Object.freeze([
  'ISO_9001_2015',
  'ISO_14001_2015',
  'ISO_45001_2018',
]);

const MACRO_CLAUSE_SQL = `LEN(nr.clause_ref) - LEN(REPLACE(nr.clause_ref, '.', '')) = 1`;

/**
 * Tokenizza un testo in termini significativi (>= 3 caratteri, no stopwords).
 */
const STOPWORDS = new Set(['del', 'della', 'dei', 'per', 'con', 'che', 'una', 'uno', 'gli', 'and', 'the', 'for', 'with', 'von', 'und']);
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9àèéìòùáéíóú\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Conta quanti token di `clauseTokens` appaiono nel testo `haystack`.
 */
function matchScore(clauseTokens, haystack) {
  const lower = (haystack || '').toLowerCase();
  return clauseTokens.filter((t) => lower.includes(t)).length;
}

/**
 * Esegui gap analysis per un'azienda e uno standard.
 *
 * @param {{ organizationId: number, companyId: number, standardCode: string }} params
 * @returns {Promise<Array<{ clauseRef: string, title: string, coverage: 'covered'|'partial'|'missing', evidence: Array<{docId:number,title:string}> }>>}
 */
async function runGapAnalysis({ organizationId, companyId, standardCode }) {
  // 1. Carica clausole normative
  const clauseRes = await query(
    `SELECT clause_ref, clause_title, requirement_text
     FROM norm_requirements
     WHERE standard_code = @stdCode AND is_current = 1
     ORDER BY clause_ref`,
    { stdCode: standardCode }
  );
  const clauses = clauseRes.recordset;

  if (!clauses.length) {
    logger.warn(`[GapAnalysis] Nessuna clausola trovata per ${standardCode}`);
    return [];
  }

  // 2. Carica documenti dell'azienda (titolo + metadati JSON)
  const docRes = await query(
    `SELECT id, title, document_type, type_specific_data
     FROM document_registry
     WHERE organization_id = @orgId AND company_id = @compId AND is_current = 1`,
    { orgId: organizationId, compId: companyId }
  );
  const docs = docRes.recordset;

  // 3. Calcola copertura per clausola
  return clauses.map((clause) => {
    const clauseTokens = [
      ...tokenize(clause.clause_title || ''),
      ...tokenize((clause.requirement_text || '').substring(0, 400)),
    ];

    const evidence = [];
    for (const doc of docs) {
      const metaStr = doc.type_specific_data
        ? (typeof doc.type_specific_data === 'string' ? doc.type_specific_data : JSON.stringify(doc.type_specific_data))
        : '';
      const haystack = `${doc.title || ''} ${doc.document_type || ''} ${metaStr}`;
      const score = matchScore(clauseTokens, haystack);
      if (score >= 1) {
        evidence.push({ docId: doc.id, title: doc.title || `Doc ${doc.id}`, score });
      }
    }
    evidence.sort((a, b) => b.score - a.score);

    const titleMatchCount = evidence.filter((e) => {
      const titleTokens = tokenize(e.title);
      return clauseTokens.some((t) => titleTokens.includes(t));
    }).length;

    let coverage;
    if (evidence.length >= 2 || titleMatchCount >= 1) {
      coverage = 'covered';
    } else if (evidence.length === 1) {
      coverage = 'partial';
    } else {
      coverage = 'missing';
    }

    return {
      clauseRef: clause.clause_ref,
      title: clause.clause_title || clause.clause_ref,
      coverage,
      evidence: evidence.slice(0, 5).map(({ docId, title }) => ({ docId, title })),
    };
  });
}

function isValidSalStatus(status) {
  return SAL_STATUS_VALUES.includes(status);
}

/**
 * Verifica che l'azienda appartenga all'organizzazione dell'utente.
 * @returns {Promise<{ companyId: number }|null>}
 */
async function assertCompanyInOrganization(organizationId, companyId) {
  const cid = parseInt(companyId, 10);
  if (!Number.isFinite(cid) || cid <= 0) return null;

  const res = await query(`
    SELECT c.id
    FROM companies c
    INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
    WHERE c.id = @companyId
      AND ao.organization_id = @orgId
      AND c.is_active = 1
  `, { companyId: cid, orgId: organizationId });

  return res.recordset.length ? { companyId: cid } : null;
}

/**
 * Matrice SAL: clausole macro N.N + stato persistito (LEFT JOIN).
 */
async function getGapMatrix(organizationId, companyId, { standardCode, dateFrom } = {}) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return null;

  const params = {
    orgId: organizationId,
    companyId: scoped.companyId,
  };

  let standardFilter = '';
  if (standardCode) {
    standardFilter = 'AND nr.standard_code = @standardCode';
    params.standardCode = standardCode;
  } else {
    standardFilter = `AND nr.standard_code IN ('${SAL_DEFAULT_STANDARD_CODES.join("','")}')`;
  }

  let dateFilter = '';
  if (dateFrom) {
    dateFilter = 'AND (ris.updated_at IS NULL OR ris.updated_at >= @dateFrom)';
    params.dateFrom = dateFrom;
  }

  const res = await query(`
    SELECT
      nr.id AS norm_requirement_id,
      nr.standard_code,
      nr.clause_ref,
      nr.clause_title,
      ris.id AS status_id,
      ris.status,
      ris.conformity_hint,
      ris.notes,
      ris.responsible,
      ris.due_date,
      ris.evidence_document_ids,
      ris.updated_at,
      ris.updated_by
    FROM norm_requirements nr
    LEFT JOIN requirement_implementation_status ris ON (
      ris.norm_requirement_id = nr.id
      AND ris.organization_id = @orgId
      AND ris.company_id = @companyId
    )
    WHERE nr.is_current = 1
      AND ${MACRO_CLAUSE_SQL}
      ${standardFilter}
      ${dateFilter}
    ORDER BY nr.standard_code, nr.clause_ref
  `, params);

  const rows = (res.recordset || []).map(mapStatusRow);
  const summary = buildSalSummary(rows);
  return {
    companyId: scoped.companyId,
    standardCode: standardCode || null,
    rows,
    summary,
  };
}

/**
 * Elenco stati persistiti per azienda (solo righe seedate).
 */
async function listStatuses(organizationId, companyId, { standardCode } = {}) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return null;

  const params = {
    orgId: organizationId,
    companyId: scoped.companyId,
  };

  let standardFilter = '';
  if (standardCode) {
    standardFilter = 'AND ris.standard_code = @standardCode';
    params.standardCode = standardCode;
  }

  const res = await query(`
    SELECT
      ris.id AS status_id,
      ris.norm_requirement_id,
      ris.standard_code,
      nr.clause_ref,
      nr.clause_title,
      ris.status,
      ris.conformity_hint,
      ris.notes,
      ris.responsible,
      ris.due_date,
      ris.evidence_document_ids,
      ris.updated_at,
      ris.updated_by
    FROM requirement_implementation_status ris
    INNER JOIN norm_requirements nr ON nr.id = ris.norm_requirement_id
    WHERE ris.organization_id = @orgId
      AND ris.company_id = @companyId
      ${standardFilter}
    ORDER BY ris.standard_code, nr.clause_ref
  `, params);

  return {
    companyId: scoped.companyId,
    items: (res.recordset || []).map(mapStatusRow),
  };
}

/**
 * Upsert stato implementazione + storico su cambio status.
 */
async function upsertStatus(organizationId, companyId, userId, payload) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return { error: 'NOT_FOUND' };

  const normRequirementId = parseInt(payload.normRequirementId ?? payload.norm_requirement_id, 10);
  if (!Number.isFinite(normRequirementId) || normRequirementId <= 0) {
    return { error: 'VALIDATION', message: 'normRequirementId obbligatorio' };
  }

  const status = payload.status;
  if (!isValidSalStatus(status)) {
    return { error: 'VALIDATION', message: `status non valido (ammessi: ${SAL_STATUS_VALUES.join(', ')})` };
  }

  const reqRes = await query(`
    SELECT id, standard_code
    FROM norm_requirements
    WHERE id = @id AND is_current = 1
  `, { id: normRequirementId });

  if (!reqRes.recordset.length) {
    return { error: 'VALIDATION', message: 'Requisito normativo non trovato' };
  }

  const standardCode = reqRes.recordset[0].standard_code;
  const evidenceJson = payload.evidenceDocumentIds != null
    ? JSON.stringify(payload.evidenceDocumentIds)
    : (payload.evidence_document_ids != null ? JSON.stringify(payload.evidence_document_ids) : null);

  const existing = await query(`
    SELECT id, status
    FROM requirement_implementation_status
    WHERE organization_id = @orgId
      AND company_id = @companyId
      AND norm_requirement_id = @normRequirementId
  `, {
    orgId: organizationId,
    companyId: scoped.companyId,
    normRequirementId,
  });

  const notes = payload.notes ?? null;
  const responsible = payload.responsible ?? null;
  const dueDate = payload.dueDate ?? payload.due_date ?? null;
  const conformityHint = payload.conformityHint ?? payload.conformity_hint ?? null;

  if (existing.recordset.length) {
    const row = existing.recordset[0];
    const prevStatus = row.status;

    await query(`
      UPDATE requirement_implementation_status
      SET status = @status,
          conformity_hint = @conformityHint,
          notes = @notes,
          responsible = @responsible,
          due_date = @dueDate,
          evidence_document_ids = @evidenceJson,
          updated_at = GETDATE(),
          updated_by = @userId
      WHERE id = @id
        AND organization_id = @orgId
        AND company_id = @companyId
    `, {
      id: row.id,
      orgId: organizationId,
      companyId: scoped.companyId,
      status,
      conformityHint,
      notes,
      responsible,
      dueDate,
      evidenceJson,
      userId: userId || null,
    });

    if (prevStatus !== status) {
      await query(`
        INSERT INTO requirement_implementation_history (status_id, status, notes, changed_by)
        VALUES (@statusId, @status, @notes, @changedBy)
      `, {
        statusId: row.id,
        status,
        notes,
        changedBy: userId || null,
      });
    }

    return { action: 'updated', statusId: row.id, normRequirementId, status };
  }

  const insertRes = await query(`
    INSERT INTO requirement_implementation_status (
      organization_id, company_id, norm_requirement_id, standard_code,
      status, conformity_hint, notes, responsible, due_date,
      evidence_document_ids, updated_by
    )
    OUTPUT INSERTED.id
    VALUES (
      @orgId, @companyId, @normRequirementId, @standardCode,
      @status, @conformityHint, @notes, @responsible, @dueDate,
      @evidenceJson, @userId
    )
  `, {
    orgId: organizationId,
    companyId: scoped.companyId,
    normRequirementId,
    standardCode,
    status,
    conformityHint,
    notes,
    responsible,
    dueDate,
    evidenceJson,
    userId: userId || null,
  });

  const statusId = insertRes.recordset[0].id;

  await query(`
    INSERT INTO requirement_implementation_history (status_id, status, notes, changed_by)
    VALUES (@statusId, @status, @notes, @changedBy)
  `, {
    statusId,
    status,
    notes,
    changedBy: userId || null,
  });

  return { action: 'created', statusId, normRequirementId, status };
}

/**
 * Seed idempotente macro-clausole N.N da norm_requirements per gli standard indicati.
 */
async function seedForCompany(organizationId, companyId, standardCodes = SAL_DEFAULT_STANDARD_CODES) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return null;

  const codes = (Array.isArray(standardCodes) && standardCodes.length
    ? standardCodes
    : SAL_DEFAULT_STANDARD_CODES
  ).map((c) => String(c).trim()).filter(Boolean);

  if (!codes.length) {
    return { companyId: scoped.companyId, inserted: 0, skipped: 0, standardCodes: [] };
  }

  const placeholders = codes.map((_, i) => `@std${i}`).join(', ');
  const params = {
    orgId: organizationId,
    companyId: scoped.companyId,
  };
  codes.forEach((code, i) => {
    params[`std${i}`] = code;
  });

  const beforeRes = await query(`
    SELECT COUNT(*) AS cnt
    FROM requirement_implementation_status
    WHERE organization_id = @orgId AND company_id = @companyId
  `, { orgId: organizationId, companyId: scoped.companyId });
  const beforeCount = beforeRes.recordset[0]?.cnt || 0;

  await query(`
    INSERT INTO requirement_implementation_status (
      organization_id, company_id, norm_requirement_id, standard_code, status
    )
    SELECT
      @orgId,
      @companyId,
      nr.id,
      nr.standard_code,
      'discussed'
    FROM norm_requirements nr
    WHERE nr.is_current = 1
      AND nr.standard_code IN (${placeholders})
      AND ${MACRO_CLAUSE_SQL}
      AND NOT EXISTS (
        SELECT 1
        FROM requirement_implementation_status ris
        WHERE ris.organization_id = @orgId
          AND ris.company_id = @companyId
          AND ris.norm_requirement_id = nr.id
      )
  `, params);

  const afterRes = await query(`
    SELECT COUNT(*) AS cnt
    FROM requirement_implementation_status
    WHERE organization_id = @orgId AND company_id = @companyId
  `, { orgId: organizationId, companyId: scoped.companyId });
  const afterCount = afterRes.recordset[0]?.cnt || 0;
  const inserted = afterCount - beforeCount;

  return {
    companyId: scoped.companyId,
    inserted,
    skipped: Math.max(0, inserted === 0 ? 0 : beforeCount),
    total: afterCount,
    standardCodes: codes,
  };
}

function mapStatusRow(row) {
  let evidenceDocumentIds = null;
  if (row.evidence_document_ids) {
    try {
      evidenceDocumentIds = JSON.parse(row.evidence_document_ids);
    } catch (_) {
      evidenceDocumentIds = row.evidence_document_ids;
    }
  }

  return {
    statusId: row.status_id ?? row.id ?? null,
    normRequirementId: row.norm_requirement_id,
    standardCode: row.standard_code,
    clauseRef: row.clause_ref,
    clauseTitle: row.clause_title,
    status: row.status ?? null,
    conformityHint: row.conformity_hint ?? null,
    notes: row.notes ?? null,
    responsible: row.responsible ?? null,
    dueDate: row.due_date
      ? new Date(row.due_date).toISOString().slice(0, 10)
      : null,
    evidenceDocumentIds,
    updatedAt: row.updated_at
      ? new Date(row.updated_at).toISOString()
      : null,
    updatedBy: row.updated_by ?? null,
  };
}

function buildSalSummary(rows) {
  const summary = {
    discussed: 0,
    in_progress: 0,
    to_validate: 0,
    completed: 0,
    na: 0,
    not_seeded: 0,
    total: rows.length,
  };

  for (const row of rows) {
    if (!row.status) {
      summary.not_seeded += 1;
    } else if (Object.prototype.hasOwnProperty.call(summary, row.status)) {
      summary[row.status] += 1;
    }
  }

  return summary;
}

module.exports = {
  runGapAnalysis,
  getGapMatrix,
  listStatuses,
  upsertStatus,
  seedForCompany,
  assertCompanyInOrganization,
  SAL_STATUS_VALUES,
  SAL_DEFAULT_STANDARD_CODES,
  isValidSalStatus,
};
