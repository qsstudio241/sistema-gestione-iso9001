/**
 * Ambito azienda condiviso nel modulo Qualifiche.
 * Persistenza opzionale in localStorage (pattern registro documenti).
 */

export const QUALIFICATIONS_COMPANY_SCOPE_KEY = 'sgq-qualifications-company-scope';

/**
 * @param {number|string|null|undefined} urlCompanyId
 * @returns {string}
 */
export function resolveInitialQualificationsCompanyScope(urlCompanyId) {
  if (urlCompanyId != null && urlCompanyId !== '') {
    return String(urlCompanyId);
  }
  return readStoredQualificationsCompanyScope();
}

/**
 * @returns {string}
 */
export function readStoredQualificationsCompanyScope() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem(QUALIFICATIONS_COMPANY_SCOPE_KEY);
    if (raw == null || raw === '') return '';
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? '' : String(n);
  } catch {
    return '';
  }
}

/**
 * @param {string|number|null|undefined} companyId — "" rimuove la preferenza
 */
export function persistQualificationsCompanyScope(companyId) {
  if (typeof window === 'undefined') return;
  try {
    if (companyId == null || companyId === '') {
      window.localStorage.removeItem(QUALIFICATIONS_COMPANY_SCOPE_KEY);
    } else {
      window.localStorage.setItem(QUALIFICATIONS_COMPANY_SCOPE_KEY, String(companyId));
    }
  } catch {
    /* quota / private mode — non bloccante */
  }
}
