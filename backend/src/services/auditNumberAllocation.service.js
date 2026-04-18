/**
 * Allocazione numeri report audit formato PREFISSO-YYMMDD-NN (es. MSN-260417-01).
 * Fuso calendario: Europe/Rome. Contatore atomico per org + prefisso + giorno.
 */

const sql = require('mssql');
const { getPool } = require('../config/database');
const logger = require('../utils/logger');
const {
  getRomeCalendarParts,
  sanitizePrefix,
  formatAuditNumber,
} = require('./auditNumberAllocation.core');

/**
 * Legge prefisso organizzazione (fallback MSN).
 * @param {import('mssql').Transaction|null} transaction
 */
async function loadOrgPrefix(organizationId, transaction) {
  const pool = await getPool();
  const request = transaction ? new sql.Request(transaction) : pool.request();
  request.input('organization_id', sql.Int, organizationId);
  const r = await request.query(`
    SELECT LTRIM(RTRIM(audit_report_prefix)) AS audit_report_prefix
    FROM dbo.organizations
    WHERE organization_id = @organization_id
  `);
  const row = r.recordset[0];
  return sanitizePrefix(row?.audit_report_prefix);
}

/**
 * Incremento atomico last_seq (MERGE + HOLDLOCK: primo giorno => 1, poi +1).
 * @param {number} organizationId
 * @param {string} prefix
 * @param {string} sqlDate YYYY-MM-DD
 * @param {import('mssql').Transaction} transaction
 * @returns {Promise<number>} nuovo last_seq (1..N)
 */
async function bumpSequence(organizationId, prefix, sqlDate, transaction) {
  const request = new sql.Request(transaction);
  request.input('organization_id', sql.Int, organizationId);
  request.input('prefix', sql.NVarChar(16), prefix);
  request.input('sequence_date', sql.VarChar(10), sqlDate);

  const r = await request.query(`
    MERGE dbo.audit_daily_sequences WITH (HOLDLOCK) AS T
    USING (
      SELECT @organization_id AS organization_id,
             @prefix AS prefix,
             CAST(@sequence_date AS DATE) AS sequence_date
    ) AS S
    ON T.organization_id = S.organization_id
       AND T.prefix = S.prefix
       AND T.sequence_date = S.sequence_date
    WHEN MATCHED THEN UPDATE SET
      last_seq = T.last_seq + 1,
      updated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN INSERT (organization_id, prefix, sequence_date, last_seq, updated_at)
      VALUES (S.organization_id, S.prefix, S.sequence_date, 1, SYSUTCDATETIME())
    OUTPUT INSERTED.last_seq AS seq;
  `);

  if (!r.recordset?.length) {
    throw new Error('MERGE audit_daily_sequences: nessun OUTPUT seq');
  }
  return r.recordset[0].seq;
}

/**
 * Genera il prossimo audit_number univoco per organizzazione (server-side).
 * @param {number} organizationId
 * @returns {Promise<string>}
 */
async function allocateAuditReportNumber(organizationId) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const prefix = await loadOrgPrefix(organizationId, transaction);
    const rome = getRomeCalendarParts();
    const seq = await bumpSequence(organizationId, prefix, rome.sqlDate, transaction);
    const auditNumber = formatAuditNumber(prefix, seq, rome);

    await transaction.commit();
    logger.info('Allocated audit_report_number', { organizationId, auditNumber });
    return auditNumber;
  } catch (e) {
    await transaction.rollback();
    logger.error('allocateAuditReportNumber failed', { organizationId, error: e.message });
    throw e;
  }
}

module.exports = {
  getRomeCalendarParts,
  sanitizePrefix,
  formatAuditNumber,
  allocateAuditReportNumber,
};
