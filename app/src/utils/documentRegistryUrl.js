/**
 * URL deep link Registro Documenti — contratto allineato a NCPage (?select=).
 * tab: priority | catalog | tree
 * select: id documento ? tab Albero + drawer dettaglio
 * company_id: ambito azienda condiviso (assente = tutto lo studio)
 */

export const VALID_DOC_REGISTRY_TABS = ['priority', 'catalog', 'tree'];

function parseOptionalInt(raw) {
  if (raw == null || raw === '') return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Query string per GET /documents/tree e figli lazy-loaded.
 * @param {{ depth?: number, companyId?: number|string|null }} [opts]
 * @returns {string} es. "depth=2&company_id=5"
 */
export function buildDocumentTreeQuery({ depth = 2, companyId } = {}) {
  const params = new URLSearchParams();
  params.set('depth', String(depth));
  const cid = parseOptionalInt(
    companyId != null && companyId !== '' ? String(companyId) : null
  );
  if (cid != null) {
    params.set('company_id', String(cid));
  }
  return params.toString();
}

/**
 * @param {string} [search] — query string (es. window.location.search)
 * @returns {{ tab: string|null, selectId: number|null, companyId: number|null }}
 */
export function parseDocumentRegistrySearch(search) {
  const params = new URLSearchParams(
    search ?? (typeof window !== 'undefined' ? window.location.search : '')
  );
  const tabParam = params.get('tab');
  const tab = VALID_DOC_REGISTRY_TABS.includes(tabParam) ? tabParam : null;
  return {
    tab,
    selectId: parseOptionalInt(params.get('select')),
    companyId: parseOptionalInt(params.get('company_id')),
  };
}

/**
 * @param {{ tab?: string|null, selectId?: number|null, companyId?: number|string|null }} opts
 * @returns {string}
 */
export function buildDocumentRegistryPath({ tab, selectId, companyId } = {}) {
  const params = new URLSearchParams();
  if (selectId != null && !Number.isNaN(selectId)) {
    params.set('tab', 'tree');
    params.set('select', String(selectId));
  } else if (tab && tab !== 'priority') {
    params.set('tab', tab);
  }
  const cid = parseOptionalInt(
    companyId != null && companyId !== '' ? String(companyId) : null
  );
  if (cid != null) {
    params.set('company_id', String(cid));
  }
  const qs = params.toString();
  return qs ? `/documents?${qs}` : '/documents';
}

/**
 * Deep link citazioni / ricerca ? tab Albero con selezione documento.
 * @param {string|number} entityId
 * @returns {string}
 */
export function buildDocumentDeepLink(entityId) {
  const id = parseInt(entityId, 10);
  if (Number.isNaN(id)) return '/documents';
  return buildDocumentRegistryPath({ selectId: id });
}
