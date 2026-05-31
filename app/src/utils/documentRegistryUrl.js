/**
 * URL deep link Registro Documenti — contratto allineato a NCPage (?select=).
 * tab: priority | catalog | tree
 * select: id documento ? tab Albero + drawer dettaglio
 */

export const VALID_DOC_REGISTRY_TABS = ['priority', 'catalog', 'tree'];

/**
 * @param {string} [search] — query string (es. window.location.search)
 * @returns {{ tab: string|null, selectId: number|null }}
 */
export function parseDocumentRegistrySearch(search) {
  const params = new URLSearchParams(
    search ?? (typeof window !== 'undefined' ? window.location.search : '')
  );
  const tabParam = params.get('tab');
  const tab = VALID_DOC_REGISTRY_TABS.includes(tabParam) ? tabParam : null;
  const selectRaw = params.get('select');
  const selectId = selectRaw != null && selectRaw !== ''
    ? parseInt(selectRaw, 10)
    : null;
  return {
    tab,
    selectId: selectId != null && !Number.isNaN(selectId) ? selectId : null,
  };
}

/**
 * @param {{ tab?: string|null, selectId?: number|null }} opts
 * @returns {string}
 */
export function buildDocumentRegistryPath({ tab, selectId } = {}) {
  const params = new URLSearchParams();
  if (selectId != null && !Number.isNaN(selectId)) {
    params.set('tab', 'tree');
    params.set('select', String(selectId));
  } else if (tab && tab !== 'priority') {
    params.set('tab', tab);
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
