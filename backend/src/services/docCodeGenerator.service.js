'use strict';

/**
 * Generazione doc_code da doc_type_config: PREFISSO-NNN (es. PG-001).
 * Contatore atomico per (organization_id, doc_type).
 */

const sql = require('mssql');
const { getPool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
function sanitizeDocPrefix(raw) {
    if (raw == null || String(raw).trim() === '') return null;
    const u = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!u) return null;
    return u.length > 20 ? u.slice(0, 20) : u;
}

/**
 * @param {string} prefix
 * @param {number} seq
 * @returns {string}
 */
function formatDocCode(prefix, seq) {
    const p = sanitizeDocPrefix(prefix);
    const n = Math.max(1, Math.floor(seq));
    return `${p}-${String(n).padStart(3, '0')}`;
}

/**
 * Incrementa next_number in doc_type_config (MERGE-like con UPDATE + OUTPUT).
 * @param {number} organizationId
 * @param {string} docType
 * @param {import('mssql').Transaction} transaction
 * @returns {Promise<{ prefix: string, seq: number }|null>}
 */
async function bumpDocTypeCounter(organizationId, docType, transaction) {
    const request = new sql.Request(transaction);
    request.input('organization_id', sql.Int, organizationId);
    request.input('doc_type', sql.NVarChar(50), docType);

    const r = await request.query(`
        UPDATE dbo.doc_type_config WITH (UPDLOCK, ROWLOCK)
        SET next_number = next_number + 1,
            updated_at = SYSUTCDATETIME()
        OUTPUT DELETED.prefix, DELETED.next_number AS seq
        WHERE organization_id = @organization_id
          AND doc_type = @doc_type
          AND auto_number = 1
          AND prefix IS NOT NULL
          AND LTRIM(RTRIM(prefix)) <> '';
    `);

    if (!r.recordset?.length) return null;

    const row = r.recordset[0];
    const prefix = sanitizeDocPrefix(row.prefix);
    if (!prefix) return null;

    return { prefix, seq: row.seq };
}

/**
 * Genera doc_code se configurato autonumerazione + prefisso.
 * @param {number} organizationId
 * @param {string} docType
 * @returns {Promise<string|null>}
 */
async function allocateDocCode(organizationId, docType) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const bumped = await bumpDocTypeCounter(organizationId, docType, transaction);
        if (!bumped) {
            await transaction.commit();
            return null;
        }

        const docCode = formatDocCode(bumped.prefix, bumped.seq);
        await transaction.commit();
        logger.info('Allocated doc_code', { organizationId, docType, docCode });
        return docCode;
    } catch (e) {
        await transaction.rollback();
        logger.error('allocateDocCode failed', { organizationId, docType, error: e.message });
        throw e;
    }
}

/**
 * Calcola expiry_date da default_expiry_months se issue_date fornita.
 * @param {number|null|undefined} months
 * @param {string|Date|null|undefined} issueDate
 * @returns {string|null} YYYY-MM-DD
 */
function computeExpiryFromMonths(months, issueDate) {
    if (months == null || months <= 0 || !issueDate) return null;
    const base = issueDate instanceof Date ? issueDate : new Date(issueDate);
    if (Number.isNaN(base.getTime())) return null;
    const d = new Date(base);
    d.setMonth(d.getMonth() + Math.floor(months));
    return d.toISOString().slice(0, 10);
}

/**
 * Legge default_expiry_months per org+tipo.
 * @param {number} organizationId
 * @param {string} docType
 * @returns {Promise<number|null>}
 */
async function loadDefaultExpiryMonths(organizationId, docType) {
    const pool = await getPool();
    const request = pool.request();
    request.input('organization_id', sql.Int, organizationId);
    request.input('doc_type', sql.NVarChar(50), docType);
    const r = await request.query(`
        SELECT default_expiry_months
        FROM dbo.doc_type_config
        WHERE organization_id = @organization_id AND doc_type = @doc_type
    `);
    const val = r.recordset[0]?.default_expiry_months;
    return val != null ? parseInt(val, 10) : null;
}

/**
 * Applica scadenza default se expiry_date assente.
 * @param {{ organization_id: number, doc_type: string, issue_date?: string|null, expiry_date?: string|null }}
 * @returns {Promise<string|null>}
 */
async function resolveExpiryDate({ organization_id, doc_type, issue_date, expiry_date }) {
    if (expiry_date) return expiry_date;
    const months = await loadDefaultExpiryMonths(organization_id, doc_type);
    const fromIssue = computeExpiryFromMonths(months, issue_date || new Date());
    return fromIssue;
}

module.exports = {
    sanitizeDocPrefix,
    formatDocCode,
    allocateDocCode,
    computeExpiryFromMonths,
    loadDefaultExpiryMonths,
    resolveExpiryDate,
};
