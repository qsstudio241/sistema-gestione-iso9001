import { describe, it, expect } from 'vitest';
import {
  isVisibleInTreeFolder,
  isVisibleInCatalogList,
  compareTreeFolderVsCatalog,
} from '../utils/documentTreeCoherence';

describe('documentTreeCoherence', () => {
  const folderId = 10;
  const child = { id: 1, parent_id: 10, status: 'rilasciato' };
  const obsoleto = { id: 2, parent_id: 10, status: 'obsoleto' };
  const orphan = { id: 3, parent_id: null, status: 'rilasciato' };

  it('isVisibleInTreeFolder richiede parent_id e non obsoleto', () => {
    expect(isVisibleInTreeFolder(child, folderId)).toBe(true);
    expect(isVisibleInTreeFolder(obsoleto, folderId)).toBe(false);
    expect(isVisibleInTreeFolder(orphan, folderId)).toBe(false);
  });

  it('isVisibleInCatalogList esclude obsoleti', () => {
    expect(isVisibleInCatalogList(child)).toBe(true);
    expect(isVisibleInCatalogList(obsoleto)).toBe(false);
    expect(isVisibleInCatalogList(orphan)).toBe(true);
  });

  it('compareTreeFolderVsCatalog: foglie albero ? catalogo flat', () => {
    const treeChildren = [child, obsoleto];
    const catalog = [child, orphan];
    const result = compareTreeFolderVsCatalog(treeChildren, catalog, folderId);
    expect(result.treeIds).toEqual([1]);
    expect(result.onlyInTree).toEqual([]);
    expect(result.onlyInCatalog).toContain(3);
  });
});
