/**
 * DocumentTree — sidebar navigazione ad albero dei documenti SGQ
 *
 * Nodi espandibili/collassabili, tooltip su nomi troncati,
 * azioni su cartelle custom (rinomina / elimina se vuota).
 */
import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  isTreeFolderNode,
  resolveNewFolderParentId,
  findNodeById,
} from "../hooks/useDocumentTree";
import { isDocumentFolder } from "../utils/documentValidity";
import "./DocumentTree.css";

/** In vista Albero la sidebar mostra solo cartelle; i documenti restano nel pannello centrale. */
export function filterTreeSidebarNodes(nodes, foldersOnly) {
  if (!foldersOnly || !Array.isArray(nodes)) return nodes;
  return nodes.filter((node) => isDocumentFolder(node));
}

function folderIconClass(isFolder, isSystem) {
  if (!isFolder) return "doc-tree__icon doc-tree__icon--file";
  return isSystem
    ? "doc-tree__icon doc-tree__icon--folder-system"
    : "doc-tree__icon doc-tree__icon--folder-custom";
}

/* ------------------------------------------------------------------ */
/*  TreeNode — nodo ricorsivo                                         */
/* ------------------------------------------------------------------ */
function TreeNode({ node, level, expandedIds, selectedNodeId, onToggle, onSelect, foldersOnly }) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = (node.children_count ?? node.children?.length ?? 0) > 0;
  const isFolder = isTreeFolderNode(node);
  const isSystem = Boolean(node.is_system_folder);
  const icon = isFolder ? "\uD83D\uDCC1" : "\uD83D\uDCC4";
  const fullTitle = node.title || "";

  function handleArrowClick(e) {
    e.stopPropagation();
    onToggle(node.id);
  }

  function handleNodeClick() {
    onSelect(node.id);
  }

  return (
    <li className="doc-tree__item">
      <div
        className={
          "doc-tree__node" +
          (isSelected ? " doc-tree__node--selected" : "") +
          (isFolder ? " doc-tree__node--folder" : "") +
          (isSystem ? " doc-tree__node--system-folder" : "")
        }
        style={{ paddingLeft: level * 16 + 8 + "px" }}
        onClick={handleNodeClick}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        title={fullTitle}
      >
        <span
          className={"doc-tree__arrow" + (isExpanded ? " doc-tree__arrow--open" : "")}
          onClick={hasChildren ? handleArrowClick : undefined}
          aria-hidden="true"
        >
          {hasChildren ? (isExpanded ? "\u25BC" : "\u25B6") : ""}
        </span>

        <span className={folderIconClass(isFolder, isSystem)} aria-hidden="true">
          {icon}
        </span>

        <span className="doc-tree__label" title={fullTitle}>
          {fullTitle}
        </span>

        {hasChildren && (
          <span className="doc-tree__badge">{node.children_count ?? node.children?.length}</span>
        )}
      </div>

      {isExpanded && node.children?.length > 0 && (
        <ul className="doc-tree__children" role="group">
          {filterTreeSidebarNodes(node.children, foldersOnly).map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              selectedNodeId={selectedNodeId}
              onToggle={onToggle}
              onSelect={onSelect}
              foldersOnly={foldersOnly}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  DocumentTree — componente principale                               */
/* ------------------------------------------------------------------ */
function DocumentTree({
  nodes,
  expandedIds,
  selectedNodeId,
  selectedNode,
  onToggle,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  loading,
  error,
  foldersOnly = false,
}) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const inputRef = useRef(null);
  const renameRef = useRef(null);

  const folderParentId = useMemo(
    () => resolveNewFolderParentId(selectedNode),
    [selectedNode]
  );

  const folderParentTitle = useMemo(() => {
    if (folderParentId == null) return null;
    const parent = findNodeById(nodes, folderParentId);
    return parent?.title || null;
  }, [nodes, folderParentId]);

  const selectedFolder = useMemo(() => {
    if (!selectedNode || !isTreeFolderNode(selectedNode)) return null;
    return selectedNode;
  }, [selectedNode]);

  const folderChildCount = selectedFolder?.children_count ?? 0;
  const isSystemFolder = Boolean(selectedFolder?.is_system_folder);
  const canRenameFolder =
    selectedFolder && !isSystemFolder && typeof onRenameFolder === "function";
  const canDeleteFolder =
    selectedFolder && !isSystemFolder && typeof onDeleteFolder === "function";
  const deleteBlockedReason = isSystemFolder
    ? "Le cartelle di sistema non possono essere eliminate"
    : folderChildCount > 0
      ? "Svuota la cartella (0 documenti e 0 sottocartelle) prima di eliminarla"
      : null;

  useEffect(() => {
    if (creatingFolder && inputRef.current) inputRef.current.focus();
  }, [creatingFolder]);

  useEffect(() => {
    if (renamingFolder && renameRef.current) renameRef.current.focus();
  }, [renamingFolder]);

  useEffect(() => {
    setRenamingFolder(false);
    setRenameValue("");
    setActionError(null);
  }, [selectedNodeId]);

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setSaving(true);
    setActionError(null);
    try {
      await onCreateFolder(name, folderParentId);
      setNewFolderName("");
      setCreatingFolder(false);
    } catch (err) {
      setActionError(err.message || "Errore creazione cartella");
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameFolder() {
    const name = renameValue.trim();
    if (!name || !selectedFolder) return;
    setSaving(true);
    setActionError(null);
    try {
      await onRenameFolder(selectedFolder.id, name);
      setRenamingFolder(false);
      setRenameValue("");
    } catch (err) {
      setActionError(err.message || "Errore rinomina cartella");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteFolder() {
    if (!selectedFolder || deleteBlockedReason) return;
    const ok = window.confirm(
      "Eliminare la cartella \"" + selectedFolder.title + "\"? L'operazione non è reversibile dall'interfaccia."
    );
    if (!ok) return;
    setSaving(true);
    setActionError(null);
    try {
      await onDeleteFolder(selectedFolder.id);
    } catch (err) {
      const msg =
        err?.data?.error ||
        err.message ||
        "Impossibile eliminare la cartella";
      setActionError(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleInputKeyDown(e) {
    if (e.key === "Enter") handleCreateFolder();
    if (e.key === "Escape") {
      setCreatingFolder(false);
      setNewFolderName("");
    }
  }

  function handleRenameKeyDown(e) {
    if (e.key === "Enter") handleRenameFolder();
    if (e.key === "Escape") {
      setRenamingFolder(false);
      setRenameValue("");
    }
  }

  function startRename() {
    if (!canRenameFolder) return;
    setRenameValue(selectedFolder.title || "");
    setRenamingFolder(true);
    setActionError(null);
  }

  if (loading) {
    return (
      <aside className="doc-tree">
        <div className="doc-tree__header">Documenti</div>
        <div className="doc-tree__loading">
          <span className="doc-tree__spinner" />
          Caricamento{"\u2026"}
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="doc-tree">
        <div className="doc-tree__header">Documenti</div>
        <div className="doc-tree__error">{error}</div>
      </aside>
    );
  }

  return (
    <aside className="doc-tree" role="tree" aria-label="Albero documenti">
      <div className="doc-tree__header">Documenti</div>

      {selectedFolder && (
        <div className="doc-tree__mobile-selection" aria-live="polite">
          <span className="doc-tree__mobile-selection-label">Cartella selezionata</span>
          <span className="doc-tree__mobile-selection-title">{selectedFolder.title}</span>
        </div>
      )}

      <ul className="doc-tree__list">
        {filterTreeSidebarNodes(nodes, foldersOnly).map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            level={0}
            expandedIds={expandedIds}
            selectedNodeId={selectedNodeId}
            onToggle={onToggle}
            onSelect={onSelect}
            foldersOnly={foldersOnly}
          />
        ))}

        {filterTreeSidebarNodes(nodes, foldersOnly).length === 0 && (
          <li className="doc-tree__empty">
            {foldersOnly ? "Nessuna cartella" : "Nessun documento"}
          </li>
        )}
      </ul>

      {actionError && (
        <p className="doc-tree__action-error" role="alert">
          {actionError}
        </p>
      )}

      <div className="doc-tree__footer">
        {renamingFolder && selectedFolder ? (
          <div className="doc-tree__rename">
            <input
              ref={renameRef}
              className="doc-tree__new-folder-input"
              type="text"
              aria-label="Nuovo nome cartella"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              disabled={saving}
            />
            <button
              type="button"
              className="doc-tree__new-folder-confirm"
              onClick={handleRenameFolder}
              disabled={saving || !renameValue.trim()}
              title="Conferma rinomina"
            >
              {saving ? "\u2026" : "\u2713"}
            </button>
            <button
              type="button"
              className="doc-tree__new-folder-cancel"
              onClick={() => { setRenamingFolder(false); setRenameValue(""); }}
              title="Annulla"
            >
              {"\u2715"}
            </button>
          </div>
        ) : creatingFolder ? (
          <div className="doc-tree__new-folder">
            {folderParentTitle && (
              <p className="doc-tree__parent-hint">
                {"Sottocartella di: "}
                <span title={folderParentTitle}>{folderParentTitle}</span>
              </p>
            )}
            <input
              ref={inputRef}
              className="doc-tree__new-folder-input"
              type="text"
              placeholder={folderParentTitle ? "Nome sottocartella\u2026" : "Nome cartella\u2026"}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={saving}
            />
            <button
              type="button"
              className="doc-tree__new-folder-confirm"
              onClick={handleCreateFolder}
              disabled={saving || !newFolderName.trim()}
            >
              {saving ? "\u2026" : "\u2713"}
            </button>
            <button
              type="button"
              className="doc-tree__new-folder-cancel"
              onClick={() => { setCreatingFolder(false); setNewFolderName(""); }}
            >
              {"\u2715"}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="doc-tree__add-btn"
              onClick={() => { setCreatingFolder(true); setActionError(null); }}
            >
              {folderParentId != null ? "+ Sottocartella" : "+ Nuova cartella"}
            </button>
            <div className="doc-tree__folder-actions">
              <button
                type="button"
                className="doc-tree__action-btn"
                onClick={startRename}
                disabled={!canRenameFolder || saving}
                title={
                  isSystemFolder
                    ? "Le cartelle di sistema non possono essere rinominate"
                    : !selectedFolder
                      ? "Seleziona una cartella personalizzata"
                      : "Rinomina cartella"
                }
              >
                Rinomina
              </button>
              <button
                type="button"
                className="doc-tree__action-btn doc-tree__action-btn--danger"
                onClick={handleDeleteFolder}
                disabled={!canDeleteFolder || Boolean(deleteBlockedReason) || saving}
                title={deleteBlockedReason || (selectedFolder ? "Elimina cartella vuota" : "Seleziona una cartella personalizzata")}
              >
                Elimina
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

export default DocumentTree;
