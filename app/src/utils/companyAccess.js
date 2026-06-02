/**
 * Helper frontend RBAC Fase 4 — accesso per singola azienda
 */

export function hasCompanyAccess(user) {
  return Array.isArray(user?.company_access) && user.company_access.length > 0;
}

export function getCompanyPermission(user, companyId) {
  const cid = parseInt(companyId, 10);
  return (user?.company_access || []).find((a) => a.company_id === cid)?.permission || null;
}

export function canEditCompany(user, companyId = null) {
  if (!user) return false;

  if (hasCompanyAccess(user)) {
    if (companyId == null) {
      return user.company_access.some((a) => a.permission === "write");
    }
    return getCompanyPermission(user, companyId) === "write";
  }

  return ["admin", "auditor", "superadmin"].includes(user.role);
}

export function getPrimaryCompanyId(user) {
  if (!hasCompanyAccess(user)) return null;
  return user.company_access[0]?.company_id ?? null;
}
