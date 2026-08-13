/**
 * Ambito azienda unico per tutta l'app (header).
 * Una chiave localStorage namespaced per organization_id.
 * I selettori di pagina non devono piu' avere una memoria propria.
 */

import { getPrimaryCompanyId, hasCompanyAccess } from "./companyAccess";

export const APP_COMPANY_SCOPE_KEY = "sgq-app-company-scope";

/** "" = Tutto lo studio (solo personale studio, non clienti azienda). */
export const STUDIO_WIDE_SCOPE = "";

export function isCompanyScopedUser(user) {
  return hasCompanyAccess(user);
}

/** true se l'utente ha esattamente una azienda: selettore bloccato. */
export function isCompanyScopeLocked(user) {
  return isCompanyScopedUser(user) && (user.company_access || []).length === 1;
}

export function getAllowedCompanyIds(user) {
  if (!isCompanyScopedUser(user)) return null;
  return (user.company_access || [])
    .map((a) => (a?.company_id != null ? String(a.company_id) : null))
    .filter(Boolean);
}

function readRawStore() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(APP_COMPANY_SCOPE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @returns {string} id azienda oppure ""
 */
export function readStoredAppCompanyScope(organizationId) {
  const parsed = readRawStore();
  if (!parsed) return STUDIO_WIDE_SCOPE;
  if (organizationId != null && String(parsed.organization_id) !== String(organizationId)) {
    return STUDIO_WIDE_SCOPE;
  }
  if (parsed.company_id == null || parsed.company_id === "") return STUDIO_WIDE_SCOPE;
  const n = parseInt(parsed.company_id, 10);
  return Number.isNaN(n) ? STUDIO_WIDE_SCOPE : String(n);
}

/**
 * @param {string|number|null|undefined} companyId  "" rimuove (tutto lo studio)
 */
export function persistAppCompanyScope(organizationId, companyId) {
  if (typeof window === "undefined") return;
  try {
    if (organizationId == null) {
      window.localStorage.removeItem(APP_COMPANY_SCOPE_KEY);
      return;
    }
    const value = {
      organization_id: organizationId,
      company_id: companyId == null || companyId === "" ? "" : String(companyId),
    };
    window.localStorage.setItem(APP_COMPANY_SCOPE_KEY, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Default all'ingresso + persistenza se ancora valida.
 *
 * - Cliente con 1 azienda: sempre quella, non modificabile.
 * - Cliente con 2+ aziende: ultima scelta se ancora permessa, altrimenti primaria. Mai "tutto lo studio".
 * - Personale studio (admin/auditor/viewer senza company_access): "" (tutto lo studio) se nessuna scelta salvata.
 *
 * @param {object|null} user
 * @param {string|null} [storedOverride]  se passato, non legge localStorage (test)
 * @returns {string}
 */
export function resolveAppCompanyScope(user, storedOverride) {
  if (!user) return STUDIO_WIDE_SCOPE;

  if (isCompanyScopeLocked(user)) {
    return String(user.company_access[0].company_id);
  }

  const stored =
    storedOverride !== undefined
      ? storedOverride == null
        ? STUDIO_WIDE_SCOPE
        : String(storedOverride)
      : readStoredAppCompanyScope(user.organization_id);

  if (isCompanyScopedUser(user)) {
    const allowed = getAllowedCompanyIds(user) || [];
    if (stored && allowed.includes(stored)) return stored;
    const primary = getPrimaryCompanyId(user);
    return primary != null ? String(primary) : STUDIO_WIDE_SCOPE;
  }

  return stored || STUDIO_WIDE_SCOPE;
}

/**
 * Dopo il load aziende: se l'id salvato non esiste piu', torna a tutto lo studio
 * (solo personale studio). I clienti azienda restano sul valore resolved.
 */
export function sanitizeScopeAgainstCompanies(user, companyId, companies) {
  if (!companyId) return STUDIO_WIDE_SCOPE;
  const id = String(companyId);
  if (isCompanyScopedUser(user)) {
    const allowed = getAllowedCompanyIds(user) || [];
    if (allowed.includes(id)) return id;
    const primary = getPrimaryCompanyId(user);
    return primary != null ? String(primary) : STUDIO_WIDE_SCOPE;
  }
  const list = Array.isArray(companies) ? companies : [];
  if (list.length === 0) return id;
  const ok = list.some((c) => String(c.id || c.company_id) === id);
  return ok ? id : STUDIO_WIDE_SCOPE;
}
