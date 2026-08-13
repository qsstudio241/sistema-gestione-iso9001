/**
 * DEPRECATED: usare appCompanyScope.js + CompanyScopeContext.
 * Tenuto per i test L1 storici del modulo; le pagine non lo chiamano piu'.
 */

export const SAL_COMPANY_SCOPE_KEY = 'sgq-sal-company-scope';

/**
 * Risolve l'ambito iniziale: prima guarda un eventuale company_id da URL,
 * poi il valore salvato in localStorage.
 * @param {number|string|null|undefined} urlCompanyId
 * @returns {string} id azienda o "" se non selezionata
 */
export function resolveInitialSalCompanyScope(urlCompanyId) {
  if (urlCompanyId != null && urlCompanyId !== '') {
    return String(urlCompanyId);
  }
  return readStoredSalCompanyScope();
}

/**
 * @returns {string}
 */
export function readStoredSalCompanyScope() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem(SAL_COMPANY_SCOPE_KEY);
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
export function persistSalCompanyScope(companyId) {
  if (typeof window === 'undefined') return;
  try {
    if (companyId == null || companyId === '') {
      window.localStorage.removeItem(SAL_COMPANY_SCOPE_KEY);
    } else {
      window.localStorage.setItem(SAL_COMPANY_SCOPE_KEY, String(companyId));
    }
  } catch {
    /* quota / private mode — non bloccante */
  }
}
