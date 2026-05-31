/**
 * Regola unica visibilità documenti: albero vs catalogo/priorità.
 *
 * - Foglie albero: figli diretti di parent_id = cartella selezionata, status ? obsoleto.
 * - Catalogo/priorità: elenco piatto per filtri API (scadenza, tipo, …), senza parent_id;
 *   esclude obsoleti salvo filtro status esplicito.
 * - Orfani (parent_id assente): in Inbox e catalogo, non sotto un ramo albero finché archiviati.
 */

/**
 * @param {{ parent_id?: number|null, status?: string }} doc
 * @param {number} folderId
 * @returns {boolean}
 */
export function isVisibleInTreeFolder(doc, folderId) {
  if (!doc || folderId == null) return false;
  const status = doc.status ?? 'rilasciato';
  return doc.parent_id === folderId && status !== 'obsoleto';
}

/**
 * @param {{ status?: string }} doc
 * @returns {boolean}
 */
export function isVisibleInCatalogList(doc) {
  if (!doc) return false;
  const status = doc.status ?? 'rilasciato';
  return status !== 'obsoleto';
}

/**
 * Confronto insiemi id (test/diagnostica): foglie albero ? catalogo (stesso filtro obsoleto).
 * @param {Array<{ id: number, parent_id?: number, status?: string }>} treeChildren
 * @param {Array<{ id: number, status?: string }>} catalogDocs
 * @param {number} folderId
 * @returns {{ treeIds: number[], catalogIds: number[], onlyInTree: number[], onlyInCatalog: number[] }}
 */
export function compareTreeFolderVsCatalog(treeChildren, catalogDocs, folderId) {
  const treeIds = (treeChildren || [])
    .filter((d) => isVisibleInTreeFolder(d, folderId))
    .map((d) => d.id);
  const catalogIds = (catalogDocs || [])
    .filter(isVisibleInCatalogList)
    .map((d) => d.id);
  const treeSet = new Set(treeIds);
  const catalogSet = new Set(catalogIds);
  return {
    treeIds,
    catalogIds,
    onlyInTree: treeIds.filter((id) => !catalogSet.has(id)),
    onlyInCatalog: catalogIds.filter((id) => !treeSet.has(id)),
  };
}
