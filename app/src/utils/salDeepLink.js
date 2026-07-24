/**
 * Deep link verso il modulo SAL da altri moduli (es. Gap Analysis "sintesi").
 * Pattern coerente con documentRegistryUrl.js — GAP↔SAL "dialogano" tramite URL,
 * nessuno stato condiviso in memoria.
 */

/**
 * @param {{ companyId?: number|string|null, standardCode?: string|null, clauseRef?: string|null }} [opts]
 * @returns {string} es. "/sal?company_id=11&standard=ISO_9001_2015&clause=4.1"
 */
export function buildSalDeepLink({ companyId, standardCode, clauseRef } = {}) {
  const params = new URLSearchParams();
  if (companyId != null && companyId !== '') params.set('company_id', String(companyId));
  if (standardCode) params.set('standard', standardCode);
  if (clauseRef) params.set('clause', clauseRef);
  const qs = params.toString();
  return qs ? `/sal?${qs}` : '/sal';
}

/**
 * @param {string} [search] — query string (es. window.location.search)
 * @returns {{ companyId: string|null, standardCode: string|null, clauseRef: string|null }}
 */
export function parseSalDeepLinkSearch(search) {
  const params = new URLSearchParams(
    search ?? (typeof window !== 'undefined' ? window.location.search : '')
  );
  return {
    companyId: params.get('company_id') || null,
    standardCode: params.get('standard') || null,
    clauseRef: params.get('clause') || null,
  };
}
