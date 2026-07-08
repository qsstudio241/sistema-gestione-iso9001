const path = require('path');
const fs = require('fs').promises;
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { hardDeleteAudit } = require('./auditMaintenance.service');

async function tryQuery(label, sql, params) {
  try {
    await query(sql, params);
  } catch (error) {
    logger.warn(`[COMPANY_DELETE] skip ${label}: ${error.message}`, params);
  }
}

async function deleteCompanyDocuments(companyId, organizationId) {
  const docsRes = await query(
    `SELECT id FROM document_registry
     WHERE company_id = @company_id AND organization_id = @organization_id`,
    { company_id: companyId, organization_id: organizationId }
  );
  const docIds = docsRes.recordset.map((row) => row.id);
  if (docIds.length === 0) return;

  const inClause = docIds.join(',');

  await tryQuery('document_history', `
    DELETE FROM document_history
    WHERE document_id IN (${inClause})
  `);

  await tryQuery('document_tag_assignments', `
    DELETE FROM document_tag_assignments
    WHERE document_id IN (${inClause})
  `);

  await tryQuery('document_relations', `
    DELETE FROM document_relations
    WHERE source_document_id IN (${inClause}) OR target_document_id IN (${inClause})
  `);

  await tryQuery('attachments', `
    DELETE FROM attachments
    WHERE document_id IN (${inClause})
  `);

  await tryQuery('document_file_attachments', `
    DELETE FROM document_file_attachments
    WHERE document_id IN (${inClause})
  `);

  await tryQuery('norm_document_sources', `
    DELETE FROM norm_document_sources
    WHERE document_id IN (${inClause})
  `);

  await tryQuery('doc_notification_log', `
    DELETE FROM doc_notification_log
    WHERE document_id IN (${inClause})
  `);

  await tryQuery('commercial_case_documents', `
    DELETE FROM commercial_case_documents
    WHERE document_id IN (${inClause})
  `);

  await query(`
    UPDATE document_registry
    SET parent_id = NULL, attachment_id = NULL
    WHERE company_id = @company_id AND organization_id = @organization_id
  `, { company_id: companyId, organization_id: organizationId });

  await query(`
    DELETE FROM document_registry
    WHERE company_id = @company_id AND organization_id = @organization_id
  `, { company_id: companyId, organization_id: organizationId });
}

async function deleteCompanyAudits(companyId, organizationId) {
  const auditsRes = await query(
    `SELECT audit_id FROM audits
     WHERE company_id = @company_id AND organization_id = @organization_id`,
    { company_id: companyId, organization_id: organizationId }
  );

  for (const row of auditsRes.recordset) {
    await tryQuery(`audit_events ${row.audit_id}`, `
      DELETE FROM audit_events WHERE audit_id = @audit_id
    `, { audit_id: row.audit_id });

    const ok = await hardDeleteAudit(row.audit_id, organizationId);
    if (!ok) {
      throw new Error(`Hard delete audit ${row.audit_id} fallito`);
    }
  }
}

/**
 * Hard delete di un'azienda e dati collegati (albero documentale, audit, accessi, ecc.).
 *
 * @param {number} companyId
 * @param {number} auditorOrgId
 * @returns {Promise<boolean>}
 */
async function hardDeleteCompany(companyId, auditorOrgId) {
  const companyRes = await query(
    `SELECT c.id, c.name, c.logo_url, ao.organization_id
     FROM companies c
     INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
     WHERE c.id = @company_id AND c.auditor_org_id = @auditor_org_id`,
    { company_id: companyId, auditor_org_id: auditorOrgId }
  );

  if (companyRes.recordset.length === 0) {
    return false;
  }

  const company = companyRes.recordset[0];
  const organizationId = company.organization_id;

  logger.info('[COMPANY_DELETE] Inizio hard delete', {
    companyId,
    auditorOrgId,
    organizationId,
    name: company.name,
  });

  await deleteCompanyAudits(companyId, organizationId);

  await tryQuery('knowledge_chunks', `
    DELETE FROM knowledge_chunks
    WHERE company_id = @company_id AND organization_id = @organization_id
  `, { company_id: companyId, organization_id: organizationId });

  await tryQuery('ai_usage_log', `
    DELETE FROM ai_usage_log
    WHERE company_id = @company_id AND organization_id = @organization_id
  `, { company_id: companyId, organization_id: organizationId });

  await tryQuery('certification_findings', `
    DELETE FROM certification_findings
    WHERE company_id = @company_id AND organization_id = @organization_id
  `, { company_id: companyId, organization_id: organizationId });

  await deleteCompanyDocuments(companyId, organizationId);

  const simpleDeletes = [
    ['qualification_confirmations', 'DELETE FROM qualification_confirmations WHERE company_id = @company_id'],
    ['company_personnel', 'DELETE FROM company_personnel WHERE company_id = @company_id AND organization_id = @organization_id'],
    ['user_company_access', 'DELETE FROM user_company_access WHERE company_id = @company_id'],
    ['complaints', 'DELETE FROM complaints WHERE company_id = @company_id AND organization_id = @organization_id'],
    ['suppliers', 'DELETE FROM suppliers WHERE company_id = @company_id AND organization_id = @organization_id'],
    ['welding_procedures', 'DELETE FROM welding_procedures WHERE company_id = @company_id AND organization_id = @organization_id'],
    ['qualifications', 'DELETE FROM qualifications WHERE company_id = @company_id AND organization_id = @organization_id'],
    ['billing_events', 'DELETE FROM billing_events WHERE company_id = @company_id'],
    ['billing_snapshots', 'DELETE FROM billing_snapshots WHERE company_id = @company_id'],
    ['company_billing', 'DELETE FROM company_billing WHERE company_id = @company_id'],
    ['commercial_cases', 'UPDATE commercial_cases SET company_id = NULL WHERE company_id = @company_id AND organization_id = @organization_id'],
    ['notification_contacts', 'UPDATE notification_contacts SET company_id = NULL WHERE company_id = @company_id'],
    ['risks', 'UPDATE risks SET company_id = NULL WHERE company_id = @company_id AND organization_id = @organization_id'],
    ['objectives', 'UPDATE objectives SET company_id = NULL WHERE company_id = @company_id AND organization_id = @organization_id'],
  ];

  for (const [label, sql] of simpleDeletes) {
    await tryQuery(label, sql, { company_id: companyId, organization_id: organizationId });
  }

  if (company.logo_url) {
    const fullPath = path.join(process.env.UPLOAD_DIR || './uploads', company.logo_url);
    await fs.unlink(fullPath).catch(() => {});
  }

  const result = await query(`
    DELETE FROM companies
    OUTPUT DELETED.id
    WHERE id = @company_id AND auditor_org_id = @auditor_org_id
  `, { company_id: companyId, auditor_org_id: auditorOrgId });

  if (result.recordset.length === 0) {
    return false;
  }

  logger.info('[COMPANY_DELETE] Completato', { companyId, name: company.name });
  return true;
}

module.exports = {
  hardDeleteCompany,
};
