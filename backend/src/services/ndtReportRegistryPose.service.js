/**
 * CND-7 — posa verbale ndt_reports nel Registro Documenti.
 *
 * Tipo `report_ndt`, cartella scaffale **9.3** (stesso mapping di documentTreeProvisioner).
 * Idempotente: link stabile via type_specific_data.ndt_report_id (fallback doc_code = report_number).
 * Se manca cartella 9.3: parent_id null + messaggio «Cartella mancante» — non crea l'albero ISO.
 */

'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { isJudgmentStatus } = require('./ndtInspectorGate.service');
const {
  folderCodeForDocType,
  resolveFolderByCode,
  parentIdForExistingFolder,
  calculatePathCache,
} = require('./documentTreeProvisioner.service');

const DOC_TYPE = 'report_ndt';
const FOLDER_MISSING_MSG =
  'Cartella mancante: il verbale \u00e8 nel Registro ma senza cartella 9.3. Inizializza l\'albero documentale dell\'azienda.';

function buildTitle(report) {
  const num = report.report_number || report.report_type || 'CND';
  const client = report.client ? ` \u2014 ${String(report.client).trim()}` : '';
  return `Verbale CND ${num}${client}`.slice(0, 500);
}

function buildTypeSpecificData(report) {
  return {
    ndt_report_id: report.id,
    report_number: report.report_number || null,
    ndt_method: report.report_type || null,
    inspector_name: report.inspector || null,
    part_ref: report.job_order || null,
    test_date: report.inspection_date || null,
    outcome_summary: null,
  };
}

/**
 * Trova documento gi\u00e0 posato per questo verbale (idempotenza).
 * Preferisce type_specific_data.ndt_report_id; fallback doc_code = report_number
 * nello stesso scope company (mai cross-azienda nello stesso tenant).
 * @returns {Promise<{ id: number, parent_id: number|null }|null>}
 */
async function findExistingRegistryDoc(organizationId, reportId, reportNumber, companyId) {
  const byLink = await query(
    `SELECT TOP 1 id, parent_id
     FROM document_registry
     WHERE organization_id = @orgId
       AND doc_type = @docType
       AND status <> 'obsoleto'
       AND ISJSON(type_specific_data) = 1
       AND JSON_VALUE(type_specific_data, '$.ndt_report_id') = @reportIdStr
     ORDER BY id ASC`,
    {
      orgId: organizationId,
      docType: DOC_TYPE,
      reportIdStr: String(reportId),
    }
  );
  if (byLink.recordset[0]) {
    return {
      id: byLink.recordset[0].id,
      parent_id: byLink.recordset[0].parent_id ?? null,
    };
  }

  if (!reportNumber) return null;

  const params = {
    orgId: organizationId,
    docType: DOC_TYPE,
    reportNumber: String(reportNumber),
  };
  let companySql;
  if (companyId != null) {
    companySql = 'AND company_id = @companyId';
    params.companyId = companyId;
  } else {
    companySql = 'AND company_id IS NULL';
  }

  const byCode = await query(
    `SELECT TOP 1 id, parent_id
     FROM document_registry
     WHERE organization_id = @orgId
       AND doc_type = @docType
       AND status <> 'obsoleto'
       AND doc_code = @reportNumber
       ${companySql}
     ORDER BY id ASC`,
    params
  );
  const row = byCode.recordset[0];
  return row ? { id: row.id, parent_id: row.parent_id ?? null } : null;
}

/**
 * Posa (crea/aggiorna) riga document_registry per un verbale completato/approvato.
 * @param {{ organizationId: number, report: object, userId?: number|null }} args
 * @returns {Promise<object|null>} null se status non \u00e8 giudizio
 */
async function poseNdtReportInRegistry({ organizationId, report, userId = null }) {
  if (!report || !report.id) return null;
  if (!isJudgmentStatus(report.status)) return null;

  const folderCode = folderCodeForDocType(DOC_TYPE); // 9.3
  const companyId = report.company_id != null ? parseInt(report.company_id, 10) : null;
  let folder = null;
  let folderMissing = false;

  if (companyId && folderCode) {
    folder = await resolveFolderByCode(organizationId, folderCode, companyId);
    if (!folder) folderMissing = true;
  } else {
    folderMissing = true;
  }

  const parentId = parentIdForExistingFolder(folder);
  const title = buildTitle(report);
  const typeSpecific = JSON.stringify(buildTypeSpecificData(report));
  const docCode = report.report_number || null;
  const issueDate = report.inspection_date || report.certificate_date || null;
  const responsible = report.inspector || report.responsible || null;
  const contentScope = companyId ? 'client' : 'studio';

  const existing = await findExistingRegistryDoc(
    organizationId,
    report.id,
    report.report_number,
    companyId
  );

  if (existing) {
    // Sempre la cartella risolta per l'azienda corrente: non tenere parent di un'altra azienda.
    const nextParent = parentId;
    const notes = folderMissing ? FOLDER_MISSING_MSG : null;
    await query(
      `UPDATE document_registry SET
         company_id = @company_id,
         parent_id = @parent_id,
         doc_code = @doc_code,
         title = @title,
         issue_date = COALESCE(@issue_date, issue_date),
         responsible = COALESCE(@responsible, responsible),
         type_specific_data = @type_specific_data,
         content_scope = @content_scope,
         notes = @notes,
         status = 'vigente',
         updated_at = GETDATE()
       WHERE id = @id AND organization_id = @orgId`,
      {
        id: existing.id,
        orgId: organizationId,
        company_id: companyId,
        parent_id: nextParent,
        doc_code: docCode,
        title,
        issue_date: issueDate,
        responsible,
        type_specific_data: typeSpecific,
        content_scope: contentScope,
        notes,
      }
    );

    if (nextParent) {
      try {
        const pathCache = await calculatePathCache(existing.id, organizationId);
        await query(
          `UPDATE document_registry SET path_cache = @path_cache WHERE id = @id`,
          { path_cache: pathCache, id: existing.id }
        );
      } catch (pathErr) {
        logger.warn('[ndtReportRegistryPose] path_cache update failed', {
          id: existing.id,
          error: pathErr.message,
        });
      }
    }

    logger.info('[ndtReportRegistryPose] updated', {
      reportId: report.id,
      documentId: existing.id,
      folderMissing,
    });

    return {
      document_id: existing.id,
      created: false,
      folder_code: folderCode,
      parent_id: nextParent,
      folder_missing: folderMissing,
      message: folderMissing
        ? FOLDER_MISSING_MSG
        : `Documento gi\u00e0 in Registro (cartella ${folderCode}) aggiornato.`,
    };
  }

  const ins = await query(
    `INSERT INTO document_registry
       (organization_id, company_id, parent_id, doc_type, doc_code,
        title, revision, status, issue_date, responsible,
        import_status, notes, type_specific_data, content_scope,
        created_by, created_at, updated_at)
     OUTPUT INSERTED.id
     VALUES
       (@organization_id, @company_id, @parent_id, @doc_type, @doc_code,
        @title, @revision, 'vigente', @issue_date, @responsible,
        'active', @notes, @type_specific_data, @content_scope,
        @created_by, GETDATE(), GETDATE())`,
    {
      organization_id: organizationId,
      company_id: companyId,
      parent_id: parentId,
      doc_type: DOC_TYPE,
      doc_code: docCode,
      title,
      revision: '01',
      issue_date: issueDate,
      responsible,
      notes: folderMissing ? FOLDER_MISSING_MSG : null,
      type_specific_data: typeSpecific,
      content_scope: contentScope,
      created_by: userId || null,
    }
  );

  const documentId = ins.recordset[0].id;

  if (parentId) {
    try {
      const pathCache = await calculatePathCache(documentId, organizationId);
      await query(
        `UPDATE document_registry SET path_cache = @path_cache WHERE id = @id`,
        { path_cache: pathCache, id: documentId }
      );
    } catch (pathErr) {
      logger.warn('[ndtReportRegistryPose] path_cache create failed', {
        id: documentId,
        error: pathErr.message,
      });
    }
  }

  logger.info('[ndtReportRegistryPose] created', {
    reportId: report.id,
    documentId,
    folderMissing,
  });

  return {
    document_id: documentId,
    created: true,
    folder_code: folderCode,
    parent_id: parentId,
    folder_missing: folderMissing,
    message: folderMissing
      ? FOLDER_MISSING_MSG
      : `Verbale posato nel Registro Documenti (cartella ${folderCode}).`,
  };
}

module.exports = {
  poseNdtReportInRegistry,
  findExistingRegistryDoc,
  DOC_TYPE,
  FOLDER_MISSING_MSG,
};
