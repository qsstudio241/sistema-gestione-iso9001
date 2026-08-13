/**
 * DEPRECATED: usare appCompanyScope.js + CompanyScopeContext.
 * Tenuto per i test L1 storici del modulo; le pagine non lo chiamano piu'.
 */

export const MGMT_REVIEW_COMPANY_SCOPE_KEY = 'sgq-management-review-company-scope';

/**
 * Risolve l'ambito iniziale: prima guarda un eventuale company_id da URL,
 * poi il valore salvato in localStorage.
 * @param {number|string|null|undefined} urlCompanyId
 * @returns {string} id azienda o "" (tutto lo studio)
 */
export function resolveInitialMgmtReviewCompanyScope(urlCompanyId) {
  if (urlCompanyId != null && urlCompanyId !== '') {
    return String(urlCompanyId);
  }
  return readStoredMgmtReviewCompanyScope();
}

/**
 * @returns {string}
 */
export function readStoredMgmtReviewCompanyScope() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem(MGMT_REVIEW_COMPANY_SCOPE_KEY);
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
export function persistMgmtReviewCompanyScope(companyId) {
  if (typeof window === 'undefined') return;
  try {
    if (companyId == null || companyId === '') {
      window.localStorage.removeItem(MGMT_REVIEW_COMPANY_SCOPE_KEY);
    } else {
      window.localStorage.setItem(MGMT_REVIEW_COMPANY_SCOPE_KEY, String(companyId));
    }
  } catch {
    /* quota / private mode — non bloccante */
  }
}
