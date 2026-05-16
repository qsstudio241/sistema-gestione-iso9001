/**
 * DocumentTree ù sidebar navigazione ad albero dei documenti SGQ
 *
 * Nodi espandibili/collassabili con lazy-loading dei figli.
 * Input inline per creazione rapida cartelle.
 */
import React, { useState, useRef, useEffect } from "react";
import "./DocumentTree.css";

/* ------------------------------------------------------------------ */
/*  TreeNode ù nodo ricorsivo                                         */
/* ------------------------------------------------------------------ */
function TreeNode({ node, level, expandedIds, selectedNodeId, onToggle, onSelect }) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = (node.children_count ?? node.children?.length ?? 0) > 0;
  const isFolder = node.doc_type === "folder" || node.is_folder;
  const isSystem = node.is_system_folder;

  const icon = isSystem ? "\uD83D\uDD12" : isFolder ? "\uD83D\uDCC1" : "\uD83D\uDCC4";

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
          (isFolder ? " doc-tree__node--folder" : "")
        }
        style={{ paddingLeft: level * 20 + 8 + "px" }}
        onClick={handleNodeClick}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
      >
        <span
          className={"doc-tree__arrow" + (isExpanded ? " doc-tree__arrow--open" : "")}
          onClick={hasChildren ? handleArrowClick : undefined}
          aria-hidden="true"
        >
          {hasChildren ? (isExpanded ? "\u25BC" : "\u25B6") : ""}
        </span>

        <span className="doc-tree__icon" aria-hidden="true">{icon}</span>

        <span className="doc-tree__label">{node.title}</span>

        {hasChildren && (
          <span className="doc-tree__badge">{node.children_count ?? node.children?.length}</span>
        )}
      </div>

      {isExpanded && node.children?.length > 0 && (
        <ul className="doc-tree__children" role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              selectedNodeId={selectedNodeId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  DocumentTree ù componente principale                               */
/* ------------------------------------------------------------------ */
function DocumentTree({
  nodes,
  expandedIds,
  selectedNodeId,
  onToggle,
  onSelect,
  onCreateFolder,
  loading,
  error,
}) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (creatingFolder && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creatingFolder]);

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await onCreateFolder(name, selectedNodeId);
      setNewFolderName("");
      setCreatingFolder(false);
    } catch {
      /* error gestito nel hook */
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

  if (loading) {
    return (
      <aside className="doc-tree">
        <div className="doc-tree__header">Documenti</div>
        <div className="doc-tree__loading">
          <span className="doc-tree__spinner" />
          Caricamentoù
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

      <ul className="doc-tree__list">
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            level={0}
            expandedIds={expandedIds}
            selectedNodeId={selectedNodeId}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}

        {nodes.length === 0 && (
          <li className="doc-tree__empty">Nessun documento</li>
        )}
      </ul>

      {creatingFolder ? (
        <div className="doc-tree__new-folder">
          <input
            ref={inputRef}
            className="doc-tree__new-folder-input"
            type="text"
            placeholder="Nome cartellaù"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={saving}
          />
          <button
            className="doc-tree__new-folder-confirm"
            onClick={handleCreateFolder}
            disabled={saving || !newFolderName.trim()}
          >
            {saving ? "ù" : "\u2713"}
          </button>
          <button
            className="doc-tree__new-folder-cancel"
            onClick={() => { setCreatingFolder(false); setNewFolderName(""); }}
          >
            {"\u2715"}
          </button>
        </div>
      ) : (
        <button
          className="doc-tree__add-btn"
          onClick={() => setCreatingFolder(true)}
        >
          + Nuova cartella
        </button>
      )}
    </aside>
  );
}

export default DocumentTree;
