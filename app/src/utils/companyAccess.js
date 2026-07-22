/**
 * Helper frontend RBAC Fase 4  -  accesso per singola azienda
 * Fase 4.1  -  canWriteModule / isCompanyClient
 */

export function hasCompanyAccess(user) {
  return Array.isArray(user?.company_access) && user.company_access.length > 0;
}

export function isCompanyClient(user) {
  if (user?.is_company_client === true) return true;
  return hasCompanyAccess(user);
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

/** Alias semantico Fase 4.1  -  write su moduli operativi (doc, qualifiche,  - ). */
export function canWriteModule(user, companyId = null) {
  return canEditCompany(user, companyId);
}

export function getPrimaryCompanyId(user) {
  if (!hasCompanyAccess(user)) return null;
  return user.company_access[0]?.company_id ?? null;
}
