/**
 * RBAC Fase 4 — accesso per singola azienda (user_company_access)
 * Complementa lo scope studio (auditor_org) per clienti azienda.
 */

const { query } = require('../config/database');
const { normalizeRole } = require('./auditListRbac.service');

const WRITE_STUDIO_ROLES = new Set(['admin', 'auditor', 'superadmin']);

async function getUserCompanyAccess(userId) {
  try {
    const r = await query(`
      SELECT company_id, permission
      FROM user_company_access
      WHERE user_id = @user_id
      ORDER BY company_id
    `, { user_id: userId });
    return r.recordset || [];
  } catch (_) {
    return [];
  }
}

async function ensureCompanyAccessLoaded(user) {
  if (!user || user.company_access !== undefined) return user.company_access || [];
  const rows = await getUserCompanyAccess(user.user_id);
  user.company_access = rows;
  return rows;
}

function hasCompanyAccessRows(accessList) {
  return Array.isArray(accessList) && accessList.length > 0;
}

function findCompanyPermission(accessList, companyId) {
  const cid = parseInt(companyId, 10);
  return (accessList || []).find((a) => a.company_id === cid)?.permission || null;
}

function getAllowedCompanyIds(accessList) {
  if (!hasCompanyAccessRows(accessList)) return null;
  return accessList.map((a) => a.company_id);
}

/**
 * @returns {null|{ status: number, body: object }}
 */
async function assertCompanyAccess(user, companyId, level = 'read') {
  const cid = parseInt(companyId, 10);
  if (!Number.isFinite(cid)) {
    return { status: 400, body: { error: 'companyId non valido', code: 'INVALID_COMPANY_ID' } };
  }

  const accessList = await ensureCompanyAccessLoaded(user);
  if (!hasCompanyAccessRows(accessList)) {
    return null;
  }

  const perm = findCompanyPermission(accessList, cid);
  if (!perm) {
    return { status: 403, body: { error: 'Azienda non accessibile', code: 'FORBIDDEN' } };
  }
  if (level === 'write' && perm !== 'write') {
    return { status: 403, body: { error: 'Permesso negato: sola lettura', code: 'AUTH_FORBIDDEN' } };
  }
  return null;
}

/**
 * Scrittura personale/azienda: company_access write OPPURE ruolo studio (non viewer).
 */
async function assertCompanyWriteAccess(user, companyId) {
  const accessList = await ensureCompanyAccessLoaded(user);
  if (hasCompanyAccessRows(accessList)) {
    return assertCompanyAccess(user, companyId, 'write');
  }

  const role = normalizeRole(user?.role);
  if (!WRITE_STUDIO_ROLES.has(role)) {
    return {
      status: 403,
      body: { error: 'Permesso negato: sola lettura', code: 'AUTH_FORBIDDEN' },
    };
  }
  return null;
}

function sendAccessDenied(res, denied) {
  return res.status(denied.status).json(denied.body);
}

module.exports = {
  getUserCompanyAccess,
  ensureCompanyAccessLoaded,
  hasCompanyAccessRows,
  findCompanyPermission,
  getAllowedCompanyIds,
  assertCompanyAccess,
  assertCompanyWriteAccess,
  sendAccessDenied,
  WRITE_STUDIO_ROLES,
};
