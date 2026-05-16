/**
 * useDocumentTree — stato e operazioni per l'albero documentale SGQ
 *
 * Lazy-loading: carica figli solo all'espansione del nodo.
 * Breadcrumb: aggiornato alla selezione del nodo.
 */
import { useState, useCallback } from "react";
import apiService from "../services/apiService";

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

export default function useDocumentTree() {
  const [treeNodes, setTreeNodes] = useState([]);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.get("/documents/tree");
      setTreeNodes(res.data ?? res ?? []);
    } catch (err) {
      setError(err.message || "Errore caricamento albero");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChildren = useCallback(async (parentId) => {
    try {
      const res = await apiService.get(
        "/documents/tree/" + parentId + "/children"
      );
      const children = res.data ?? res ?? [];
      setTreeNodes((prev) => insertChildren(prev, parentId, children));
    } catch (err) {
      console.error("[useDocumentTree] loadChildren error:", err.message);
    }
  }, []);

  const toggleNode = useCallback(
    (nodeId) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
          const node = findNodeById(treeNodes, nodeId);
          if (node && !node._childrenLoaded && node.children_count > 0) {
            loadChildren(nodeId);
          }
        }
        return next;
      });
    },
    [treeNodes, loadChildren]
  );

  const selectNode = useCallback(async (nodeId) => {
    setSelectedNodeId(nodeId);
    try {
      const res = await apiService.get(
        "/documents/" + nodeId + "/breadcrumb"
      );
      setBreadcrumb(res.data ?? res ?? []);
    } catch {
      setBreadcrumb([]);
    }
  }, []);

  const createFolder = useCallback(
    async (title, parentId) => {
      const res = await apiService.post("/documents/folder", {
        title,
        parent_id: parentId ?? null,
      });
      await loadTree();
      return res.data ?? res;
    },
    [loadTree]
  );

  const moveDocument = useCallback(
    async (docId, newParentId, displayOrder) => {
      await apiService.put("/documents/" + docId + "/move", {
        new_parent_id: newParentId,
        display_order: displayOrder,
      });
      await loadTree();
    },
    [loadTree]
  );

  return {
    treeNodes,
    expandedIds,
    selectedNodeId,
    breadcrumb,
    loading,
    error,
    loadTree,
    toggleNode,
    selectNode,
    createFolder,
    moveDocument,
  };
}
