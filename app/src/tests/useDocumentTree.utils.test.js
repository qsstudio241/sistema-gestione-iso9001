/**
 * Test L1 — useDocumentTree pure helper functions
 *
 * Copre: insertChildren (innesto ricorsivo figli), findNodeById (ricerca DFS)
 * Queste utility gestiscono la struttura ad albero lazy-loaded dei documenti SGQ.
 */
import { describe, it, expect } from 'vitest';

function insertChildren(nodes, parentId, children) {
  return nodes.map((n) => {
    if (n.id === parentId) {
      return { ...n, children, _childrenLoaded: true };
    }
    if (n.children?.length) {
      return { ...n, children: insertChildren(n.children, parentId, children) };
    }
    return n;
  });
}

function findNodeById(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

// ??? insertChildren ?????????????????????????????????????????????????????????

describe('useDocumentTree — insertChildren', () => {
  const baseTree = [
    { id: 1, title: 'A', children: [
      { id: 2, title: 'A.1', children: [] },
      { id: 3, title: 'A.2', children: [] },
    ]},
    { id: 4, title: 'B', children: [] },
  ];

  it('inserisce figli nel nodo corretto e setta _childrenLoaded', () => {
    const newChildren = [{ id: 5, title: 'A.1.1' }, { id: 6, title: 'A.1.2' }];
    const result = insertChildren(baseTree, 2, newChildren);

    const node = result[0].children[0]; // nodo A.1
    expect(node.children).toEqual(newChildren);
    expect(node._childrenLoaded).toBe(true);
  });

  it('non modifica nodi non-target', () => {
    const newChildren = [{ id: 5, title: 'new' }];
    const result = insertChildren(baseTree, 4, newChildren);

    expect(result[0]).toEqual(baseTree[0]); // A non cambiato
    expect(result[1].children).toEqual(newChildren);
    expect(result[1]._childrenLoaded).toBe(true);
  });

  it('inserisce in profondità ricorsiva (nodo annidato)', () => {
    const deepTree = [
      { id: 1, title: 'L0', children: [
        { id: 2, title: 'L1', children: [
          { id: 3, title: 'L2', children: [] },
        ]},
      ]},
    ];
    const newChildren = [{ id: 10, title: 'Inserted' }];
    const result = insertChildren(deepTree, 3, newChildren);

    const target = result[0].children[0].children[0];
    expect(target.children).toEqual(newChildren);
    expect(target._childrenLoaded).toBe(true);
  });

  it('non muta l\'array originale (immutabilità)', () => {
    const original = [{ id: 1, title: 'Test', children: [] }];
    const frozen = JSON.parse(JSON.stringify(original));
    insertChildren(original, 1, [{ id: 2, title: 'Child' }]);

    expect(original).toEqual(frozen);
  });

  it('ritorna array intatto se parentId non esiste', () => {
    const result = insertChildren(baseTree, 999, [{ id: 10, title: 'X' }]);
    expect(result).toEqual(baseTree);
  });

  it('gestisce array vuoto', () => {
    expect(insertChildren([], 1, [{ id: 2, title: 'X' }])).toEqual([]);
  });
});

// ??? findNodeById ???????????????????????????????????????????????????????????

describe('useDocumentTree — findNodeById', () => {
  const tree = [
    { id: 1, title: 'Root 1', children: [
      { id: 2, title: 'Child 1.1', children: [
        { id: 3, title: 'Grandchild 1.1.1' },
      ]},
      { id: 4, title: 'Child 1.2' },
    ]},
    { id: 5, title: 'Root 2' },
  ];

  it('trova nodo radice', () => {
    expect(findNodeById(tree, 1).title).toBe('Root 1');
  });

  it('trova nodo figlio', () => {
    expect(findNodeById(tree, 2).title).toBe('Child 1.1');
  });

  it('trova nodo nipote (DFS profondo)', () => {
    expect(findNodeById(tree, 3).title).toBe('Grandchild 1.1.1');
  });

  it('trova nodo in secondo albero', () => {
    expect(findNodeById(tree, 5).title).toBe('Root 2');
  });

  it('ritorna null per ID inesistente', () => {
    expect(findNodeById(tree, 999)).toBeNull();
  });

  it('ritorna null per array vuoto', () => {
    expect(findNodeById([], 1)).toBeNull();
  });

  it('gestisce nodi senza children (foglie)', () => {
    const leafTree = [
      { id: 1, title: 'Leaf' },
      { id: 2, title: 'Leaf 2' },
    ];
    expect(findNodeById(leafTree, 2).title).toBe('Leaf 2');
    expect(findNodeById(leafTree, 3)).toBeNull();
  });
});
