/**
 * Mapping risultati ricerca unificata ? route SGQ (History API).
 * Stesso pattern di aiCitations.js per deep link.
 */

const SEARCH_ENTITY_ROUTES = {
  non_conformity: '/nc',
  document: '/documents',
  audit: '/audit',
  complaint: '/reclami',
  risk: '/rischi',
  qualification: '/qualifiche',
};

export const SEARCH_GROUP_LABELS = {
  non_conformity: 'Non conformità',
  document: 'Documenti',
  audit: 'Audit',
  complaint: 'Reclami',
  risk: 'Rischi',
  qualification: 'Qualifiche',
};

export const SEARCH_GROUP_ORDER = [
  'non_conformity',
  'document',
  'audit',
  'complaint',
  'risk',
  'qualification',
];

/**
 * Path navigabile per un risultato ricerca esatta.
 * @param {{ entityType: string, id?: number|string }} item
 * @returns {string|null}
 */
export function getSearchResultPath(item) {
  const base = SEARCH_ENTITY_ROUTES[item?.entityType];
  if (!base) return null;

  if (item.entityType === 'non_conformity' && item.id != null && item.id !== '') {
    const id = parseInt(item.id, 10);
    if (!Number.isNaN(id)) return `${base}?select=${id}`;
  }

  return base;
}

export { SEARCH_ENTITY_ROUTES };
