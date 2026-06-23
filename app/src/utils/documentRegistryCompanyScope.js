/**
 * Ambito azienda condiviso nel Registro documenti (Priorità / Catalogo / Albero).
 * Persistenza opzionale in localStorage.
 */

export const DOC_REGISTRY_COMPANY_SCOPE_KEY = 'sgq-doc-registry-company-scope';

/**
 * @param {number|string|null|undefined} urlCompanyId — da parseDocumentRegistrySearch
 * @returns {string} id azienda o "" (tutto lo studio)
 */
/** Valore speciale: ambito "Patrimonio Studio" (non e' un id azienda). */
export const STUDIO_REGISTRY_SCOPE = 'studio';

export function resolveInitialRegistryCompanyScope(urlCompanyId) {
  if (urlCompanyId === STUDIO_REGISTRY_SCOPE) return STUDIO_REGISTRY_SCOPE;
  if (urlCompanyId != null && urlCompanyId !== '') {
    return String(urlCompanyId);
  }
  return readStoredRegistryCompanyScope();
}

/**
 * @returns {string}
 */
export function readStoredRegistryCompanyScope() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem(DOC_REGISTRY_COMPANY_SCOPE_KEY);
    if (raw == null || raw === '') return '';
    if (raw === STUDIO_REGISTRY_SCOPE) return STUDIO_REGISTRY_SCOPE;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? '' : String(n);
  } catch {
    return '';
  }
}

/**
 * @param {string|number|null|undefined} companyId — "" rimuove la preferenza
 */
export function persistRegistryCompanyScope(companyId) {
  if (typeof window === 'undefined') return;
  try {
    if (companyId == null || companyId === '') {
      window.localStorage.removeItem(DOC_REGISTRY_COMPANY_SCOPE_KEY);
    } else {
      window.localStorage.setItem(DOC_REGISTRY_COMPANY_SCOPE_KEY, String(companyId));
    }
  } catch {
    /* quota / private mode — non bloccante */
  }
}
