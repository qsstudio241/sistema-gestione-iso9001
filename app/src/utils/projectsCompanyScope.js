/**
 * DEPRECATED: usare appCompanyScope.js + CompanyScopeContext.
 * Tenuto per i test L1 storici del modulo; le pagine non lo chiamano piu'.
 */

export const PROJECTS_COMPANY_SCOPE_KEY = 'sgq-projects-company-scope';

/**
 * @returns {string} id azienda o "" se non selezionata
 */
export function resolveInitialProjectsCompanyScope() {
  return readStoredProjectsCompanyScope();
}

/**
 * @returns {string}
 */
export function readStoredProjectsCompanyScope() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem(PROJECTS_COMPANY_SCOPE_KEY);
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
export function persistProjectsCompanyScope(companyId) {
  if (typeof window === 'undefined') return;
  try {
    if (companyId == null || companyId === '') {
      window.localStorage.removeItem(PROJECTS_COMPANY_SCOPE_KEY);
    } else {
      window.localStorage.setItem(PROJECTS_COMPANY_SCOPE_KEY, String(companyId));
    }
  } catch {
    /* quota / private mode — non bloccante */
  }
}
