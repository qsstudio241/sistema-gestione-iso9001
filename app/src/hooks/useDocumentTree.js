/**
 * useDocumentTree — stato e operazioni per l'albero documentale SGQ
 *
 * Lazy-loading: carica figli solo all'espansione del nodo.
 * Breadcrumb: aggiornato alla selezione del nodo.
 * companyId: filtra cartelle/documenti per azienda (null = tutto lo studio).
 */
import { useState, useCallback, useMemo } from "react";
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

export function findNodeById(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function isTreeFolderNode(node) {
  return node?.doc_type === "folder" || node?.is_folder === true;
}

/** Parent per nuova cartella: cartella selezionata, altrimenti parent del documento selezionato. */
export function resolveNewFolderParentId(selectedNode) {
  if (!selectedNode) return null;
  if (isTreeFolderNode(selectedNode)) return selectedNode.id;
  return selectedNode.parent_id ?? null;
}

function normalizeCompanyId(companyId) {
  if (companyId == null || companyId === "") return null;
  const n = parseInt(companyId, 10);
  return Number.isNaN(n) ? null : n;
}

export default function useDocumentTree(companyId = null) {
  const scopedCompanyId = normalizeCompanyId(companyId);

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
      const res = await apiService.getDocumentTree(2, scopedCompanyId);
      setTreeNodes(res.data ?? res ?? []);
    } catch (err) {
      setError(err.message || "Errore caricamento albero");
    } finally {
      setLoading(false);
    }
  }, [scopedCompanyId]);

  const loadChildren = useCallback(async (parentId, options) => {
    try {
      const res = await apiService.getDocumentTreeChildren(parentId, scopedCompanyId);
      const children = res.data ?? res ?? [];
      setTreeNodes((prev) => insertChildren(prev, parentId, children));
    } catch (err) {
      console.error("[useDocumentTree] loadChildren error:", err.message);
    }
  }, [scopedCompanyId]);

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

  const selectedNode = useMemo(
    () => (selectedNodeId != null ? findNodeById(treeNodes, selectedNodeId) : null),
    [treeNodes, selectedNodeId]
  );

  const createFolder = useCallback(
    async (title, parentId) => {
      const resolvedParent =
        parentId !== undefined ? parentId : resolveNewFolderParentId(selectedNode);
      const payload = {
        title,
        parent_id: resolvedParent ?? null,
      };
      if (scopedCompanyId != null) {
        payload.company_id = scopedCompanyId;
      }
      const res = await apiService.post("/documents/folder", payload);
      await loadTree();
      if (resolvedParent != null) {
        setExpandedIds((prev) => new Set(prev).add(resolvedParent));
      }
      return res.data ?? res;
    },
    [loadTree, selectedNode, scopedCompanyId]
  );

  const renameFolder = useCallback(
    async (folderId, title) => {
      await apiService.put("/documents/" + folderId, { title: title.trim() });
      await loadTree();
    },
    [loadTree]
  );

  const deleteFolder = useCallback(
    async (folderId) => {
      await apiService.delete("/documents/" + folderId);
      await loadTree();
      if (selectedNodeId === folderId) {
        setSelectedNodeId(null);
        setBreadcrumb([]);
      }
    },
    [loadTree, selectedNodeId]
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

  /**
   * Espande l'albero fino al documento (breadcrumb API) e seleziona la cartella contenitore.
   * @param {number} docId
   * @returns {Promise<object|null>} documento o null
   */
  const expandToDocument = useCallback(async (docId) => {
    try {
      const [bcRes, docRes] = await Promise.all([
        apiService.getDocumentBreadcrumb(docId),
        apiService.getDocument(docId),
      ]);
      const breadcrumb = bcRes?.data ?? bcRes ?? [];
      const doc = docRes?.data;
      if (!doc?.id) return null;

      await loadTree();

      const ancestors = breadcrumb.slice(0, -1);
      for (const item of ancestors) {
        setExpandedIds((prev) => new Set(prev).add(item.id));
        await loadChildren(item.id);
      }

      const isFolder = doc.doc_type === "folder";
      const folderToSelect = isFolder
        ? doc.id
        : (doc.parent_id ?? ancestors[ancestors.length - 1]?.id ?? null);

      if (folderToSelect != null) {
        await selectNode(folderToSelect);
      }

      return doc;
    } catch (err) {
      console.error("[useDocumentTree] expandToDocument error:", err.message);
      return null;
    }
  }, [loadTree, loadChildren, selectNode]);

  const resetSelection = useCallback(() => {
    setSelectedNodeId(null);
    setBreadcrumb([]);
    setExpandedIds(new Set());
  }, []);

  return {
    treeNodes,
    expandedIds,
    selectedNodeId,
    breadcrumb,
    loading,
    error,
    companyId: scopedCompanyId,
    loadTree,
    loadChildren,
    toggleNode,
    selectNode,
    selectedNode,
    createFolder,
    renameFolder,
    deleteFolder,
    moveDocument,
    expandToDocument,
    resetSelection,
  };
}
