/**
 * Snapshot fatti operativi per Ambito azienda (Second Brain SB-1).
 * Zero LLM: solo conteggi SQL allineati alle card NC / Qualifiche / Scadenze.
 */

const { query } = require('../config/database');
const { RELEASED_STATUS_SQL_IN } = require('../constants/documentStatus');
const logger = require('../utils/logger');

/** Stessa regola di qualifications.controller EFFECTIVE_EXPIRY_SQL (semaforo card). */
const QUAL_SEMIANNUAL_SQL = `(
    LOWER(q.qualification_type) LIKE '%9606%'
    OR LOWER(q.qualification_type) LIKE '%patentino_saldatore%'
    OR LOWER(q.qualification_type) = '9606_1'
    OR LOWER(q.qualification_type) LIKE '%14732%'
    OR LOWER(q.qualification_type) LIKE '%qualifica_14732%'
)`;

const QUAL_EFFECTIVE_EXPIRY_SQL = `
    CASE
        WHEN ${QUAL_SEMIANNUAL_SQL} THEN
            CASE
                WHEN q.expiry_date IS NULL THEN q.next_confirmation_due
                WHEN q.next_confirmation_due IS NULL THEN q.expiry_date
                WHEN q.next_confirmation_due < q.expiry_date THEN q.next_confirmation_due
                ELSE q.expiry_date
            END
        ELSE q.expiry_date
    END
`;

function emptyNotReady() {
  return {
    ready: false,
    reason: 'seleziona_azienda',
    companyId: null,
    companyName: null,
    counts: null,
    generatedAt: new Date().toISOString(),
  };
}

function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} user - req.user
 * @param {number|string|null|undefined} companyId - già risolto da resolveAiCompanyScope
 */
async function loadAmbitoFacts(user, companyId) {
  const cid = toInt(companyId);
  if (cid == null) {
    return emptyNotReady();
  }

  const organizationId = user?.organization_id;
  const auditorOrgId = user?.auditor_org_id || null;

  let companyName = null;
  try {
    const nameParams = { companyId: cid };
    let nameSql = 'SELECT name FROM companies WHERE id = @companyId';
    if (auditorOrgId) {
      nameSql += ' AND auditor_org_id = @auditorOrgId';
      nameParams.auditorOrgId = auditorOrgId;
    }
    const nameRes = await query(nameSql, nameParams);
    companyName = (nameRes.recordset || [])[0]?.name || null;
  } catch (err) {
    logger.warn('[AMBITO_FACTS] company name:', err.message);
  }

  const params = { companyId: cid, organizationId };

  const [ncRes, qualRes, docRes] = await Promise.all([
    query(
      `SELECT SUM(CASE WHEN nc.status <> 'closed' THEN 1 ELSE 0 END) AS nc_open
       FROM non_conformities nc
       LEFT JOIN audits a ON nc.audit_id = a.audit_id
       WHERE COALESCE(a.organization_id, nc.organization_id) = @organizationId
         AND COALESCE(a.company_id, nc.company_id) = @companyId`,
      params
    ),
    query(
      `SELECT SUM(CASE
            WHEN (${QUAL_EFFECTIVE_EXPIRY_SQL}) IS NOT NULL
             AND (${QUAL_EFFECTIVE_EXPIRY_SQL}) BETWEEN CAST(GETDATE() AS DATE)
                 AND DATEADD(day, 30, CAST(GETDATE() AS DATE))
             AND q.status NOT IN ('revocata','sospesa')
            THEN 1 ELSE 0 END) AS quals_expiring_30
       FROM qualifications q
       WHERE q.organization_id = @organizationId
         AND q.company_id = @companyId`,
      params
    ),
    query(
      `SELECT SUM(CASE
            WHEN dr.expiry_date IS NOT NULL
             AND dr.expiry_date BETWEEN CAST(GETDATE() AS DATE)
                 AND DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
             AND dr.status IN ${RELEASED_STATUS_SQL_IN}
            THEN 1 ELSE 0 END) AS docs_expiring_30
       FROM document_registry dr
       WHERE dr.organization_id = @organizationId
         AND dr.company_id = @companyId
         AND dr.doc_type <> 'folder'`,
      params
    ),
  ]);

  const ncOpen = Number((ncRes.recordset || [])[0]?.nc_open || 0);
  const qualsExpiring30 = Number((qualRes.recordset || [])[0]?.quals_expiring_30 || 0);
  const docsExpiring30 = Number((docRes.recordset || [])[0]?.docs_expiring_30 || 0);

  return {
    ready: true,
    reason: null,
    companyId: cid,
    companyName,
    counts: { ncOpen, qualsExpiring30, docsExpiring30 },
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  loadAmbitoFacts,
  emptyNotReady,
};
