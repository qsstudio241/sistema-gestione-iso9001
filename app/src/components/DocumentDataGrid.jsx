import React, { useState, useMemo, useCallback } from "react";
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS } from "../data/documentTypes";
import { formatDate } from "../utils/dateHelpers";
import { shouldShowDocumentStatusBadge } from "../utils/documentValidity";
import { documentHasFile, formatDocumentFileLabel } from "../utils/documentRegistryFile";
import { getIncompleteReasons } from "../utils/documentIncompleteQueue";
import StatusBadge from "./StatusBadge";
import "./DocumentDataGrid.css";

function IncompleteReasonChips({ doc }) {
  const reasons = getIncompleteReasons(doc);
  if (!reasons.length) return null;
  return (
    <span className="incomplete-reason-row" aria-label="Da completare">
      {reasons.map((r) => (
        <StatusBadge
          key={r.key}
          type={r.priority === "high" ? "user" : "document"}
          status={r.badgeStatus}
          label={r.label}
          size="small"
        />
      ))}
    </span>
  );
}

const COLUMNS = [
  { id: "doc_code", label: "Codice", width: "100px", sortable: true },
  { id: "title", label: "Titolo", width: "1fr", sortable: true },
  { id: "has_file", label: "File", width: "100px", sortable: true },
  { id: "doc_type", label: "Tipo", width: "110px", sortable: true },
  { id: "revision", label: "Rev.", width: "55px", sortable: true },
  { id: "status", label: "Stato", width: "110px", sortable: true },
  { id: "expiry_date", label: "Scadenza", width: "110px", sortable: true },
  { id: "company_name", label: "Azienda", width: "120px", sortable: true },
  { id: "responsible", label: "Responsabile", width: "120px", sortable: true },
];

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Calcola lo stato visivo del vigore per le norme.
 * Restituisce: 'vigente' | 'superata' | 'da-verificare'
 */
function getNormValidityState(doc) {
  if (doc.doc_type !== 'norma') return null;
  const vs = doc.norm_validity_status;
  if (vs === 'superata') return 'superata';
  if (vs === 'vigente' || vs === 'rilasciato') {
    const lastCheck = doc.norm_last_check;
    if (!lastCheck) return 'da-verificare';
    const age = Date.now() - new Date(lastCheck).getTime();
    return age > NINETY_DAYS_MS ? 'da-verificare' : 'vigente';
  }
  return 'da-verificare';
}

const NORM_VALIDITY_LABEL = {
  'vigente':      'Vigente',
  'superata':     'Superata',
  'da-verificare': 'Da verificare',
};

function getExpiryClass(doc) {
  if (doc.status === "obsoleto") return "expiry-obsoleto";
  if (doc.is_expired) return "expiry-scaduto";
  if (doc.expiring_soon) return "expiry-warning";
  return "";
}

function DocumentFileBadge({ doc }) {
  const hasFile = documentHasFile(doc);
  const label = formatDocumentFileLabel(doc);
  return (
    <span
      className={`doc-file-badge${hasFile ? " doc-file-badge--ok" : " doc-file-badge--missing"}`}
      title={label.title}
    >
      <span className="doc-file-badge__icon" aria-hidden="true">
        {hasFile ? "\uD83D\uDCCE" : "\u26A0\uFE0F"}
      </span>
      <span className="doc-file-badge__text">{label.short}</span>
    </span>
  );
}

function DocumentCatalogCard({
  doc,
  isSelected,
  onSelect,
  onDoubleClick,
  onFileDialog,
}) {
  const expiryClass = getExpiryClass(doc);
  return (
    <article
      className={`catalog-doc-card${isSelected ? " catalog-doc-card--selected" : ""}${expiryClass ? ` catalog-doc-card--${expiryClass.replace("expiry-", "")}` : ""}`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="catalog-doc-card__head">
        <div className="catalog-doc-card__title-wrap">
          <h4 className="catalog-doc-card__title">{doc.title}</h4>
          {doc.doc_code && (
            <span className="catalog-doc-card__code">{doc.doc_code}</span>
          )}
        </div>
        <DocumentFileBadge doc={doc} />
      </div>
      <div className="catalog-doc-card__meta">
        <span className="doc-type-badge">
          {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
        </span>
        {shouldShowDocumentStatusBadge(doc) && (
          <StatusBadge type="document" status={doc.status} />
        )}
        <IncompleteReasonChips doc={doc} />
        {doc.revision && (
          <span className="catalog-doc-card__rev">Rev. {doc.revision}</span>
        )}
      </div>
      {doc.expiry_date && (
        <div className={`catalog-doc-card__expiry ${expiryClass}`}>
          {doc.is_expired && "\u26A0\uFE0F "}
          {doc.expiring_soon && !doc.is_expired && "\uD83D\uDFE1 "}
          Scadenza: {formatDate(doc.expiry_date)}
        </div>
      )}
      {!documentHasFile(doc) && (
        <button
          type="button"
          className="catalog-doc-card__upload-btn"
          onClick={(e) => {
            e.stopPropagation();
            onFileDialog?.(doc);
          }}
        >
          {"\uD83D\uDCCE"} Carica file
        </button>
      )}
    </article>
  );
}

function sortDocs(docs, sortCol, sortDir) {
  if (!sortCol) return docs;
  const sorted = [...docs].sort((a, b) => {
    let va = a[sortCol] ?? "";
    let vb = b[sortCol] ?? "";
    if (sortCol === "doc_type") {
      va = DOC_TYPE_LABELS[va] || va;
      vb = DOC_TYPE_LABELS[vb] || vb;
    }
    if (sortCol === "status") {
      va = DOC_STATUS_LABELS[va] || va;
      vb = DOC_STATUS_LABELS[vb] || vb;
    }
    if (sortCol === "has_file") {
      va = documentHasFile(a) ? 1 : 0;
      vb = documentHasFile(b) ? 1 : 0;
    }
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  return sorted;
}

function DocumentDataGrid({
  documents,
  loading,
  onEdit,
  onArchive,
  onFileDialog,
  onDocSelect,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [sortCol, setSortCol] = useState("title");
  const [sortDir, setSortDir] = useState("asc");

  // Deseleziona se la riga non esiste più (pagina/filtri cambiati)
  React.useEffect(() => {
    if (selectedId && !documents.some((d) => d.id === selectedId)) {
      setSelectedId(null);
    }
  }, [documents, selectedId]);

  const sortedDocs = useMemo(
    () => sortDocs(documents, sortCol, sortDir),
    [documents, sortCol, sortDir]
  );

  const selectedDoc = useMemo(
    () => documents.find((d) => d.id === selectedId) || null,
    [documents, selectedId]
  );

  const handleHeaderClick = useCallback((colId) => {
    setSortCol((prev) => {
      if (prev === colId) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return colId;
      }
      setSortDir("asc");
      return colId;
    });
  }, []);

  const handleRowClick = useCallback((doc) => {
    setSelectedId((prev) => (prev === doc.id ? null : doc.id));
  }, []);

  const handleRowDoubleClick = useCallback(
    (doc) => {
      if (onDocSelect) onDocSelect(doc);
    },
    [onDocSelect]
  );

  const handleFileDialog = useCallback(() => {
    if (selectedDoc && onFileDialog) onFileDialog(selectedDoc);
  }, [selectedDoc, onFileDialog]);

  const handleEdit = useCallback(() => {
    if (selectedDoc && onEdit) onEdit(selectedDoc);
  }, [selectedDoc, onEdit]);

  const handleArchive = useCallback(() => {
    if (selectedDoc && onArchive) onArchive(selectedDoc.id);
  }, [selectedDoc, onArchive]);

  if (loading) {
    return (
      <div className="docregistry-loading">
        <div className="loading-spinner-sm" />
        <span>Caricamento...</span>
      </div>
    );
  }

  return (
    <div className="datagrid">
      {/* Toolbar contestuale ? si attiva dopo selezione riga */}
      <div className={`datagrid-toolbar${selectedDoc ? " datagrid-toolbar--active" : ""}`}>
        <span className="datagrid-toolbar__hint">
          {selectedDoc
            ? "Azioni sul documento selezionato:"
            : "Seleziona un documento nell'elenco (clic singolo)"}
        </span>
        <div className="datagrid-toolbar__actions">
          <button
            className="datagrid-toolbar__btn"
            disabled={!selectedDoc}
            onClick={handleFileDialog}
            title="Allegato"
          >
            <span className="datagrid-toolbar__icon">{"\uD83D\uDCCE"}</span>
            <span className="datagrid-toolbar__label">Allegato</span>
          </button>
          <button
            className="datagrid-toolbar__btn"
            disabled={!selectedDoc}
            onClick={handleEdit}
            title="Modifica"
          >
            <span className="datagrid-toolbar__icon">{"\u270F\uFE0F"}</span>
            <span className="datagrid-toolbar__label">Modifica</span>
          </button>
          <button
            className="datagrid-toolbar__btn datagrid-toolbar__btn--muted"
            disabled={!selectedDoc || selectedDoc?.status === "obsoleto"}
            onClick={handleArchive}
            title="Archivia"
          >
            <span className="datagrid-toolbar__icon">{"\uD83D\uDDC4\uFE0F"}</span>
            <span className="datagrid-toolbar__label">Archivia</span>
          </button>
        </div>
        {selectedDoc && (
          <span className="datagrid-toolbar__selection">
            <strong>{selectedDoc.doc_code || selectedDoc.title}</strong>
            {selectedDoc.doc_code && (
              <span className="datagrid-toolbar__selection-title">{selectedDoc.title}</span>
            )}
          </span>
        )}
      </div>

      {/* Card mobile */}
      <div className="datagrid-cards" aria-label="Elenco documenti">
        {sortedDocs.length === 0 ? (
          <div className="datagrid-cards-empty">Nessun documento trovato.</div>
        ) : (
          sortedDocs.map((doc) => (
            <DocumentCatalogCard
              key={doc.id}
              doc={doc}
              isSelected={selectedId === doc.id}
              onSelect={() => handleRowClick(doc)}
              onDoubleClick={() => handleRowDoubleClick(doc)}
              onFileDialog={onFileDialog}
            />
          ))
        )}
      </div>

      {/* Table desktop */}
      <div className="datagrid-table-wrap">
        <table className="datagrid-table">
          <thead>
            <tr>
              <th className="datagrid-th datagrid-th--select" aria-label="Selezione" />
              {COLUMNS.map((col) => (
                <th
                  key={col.id}
                  className={`datagrid-th${col.sortable ? " datagrid-th--sortable" : ""}${sortCol === col.id ? " datagrid-th--active" : ""}`}
                  onClick={col.sortable ? () => handleHeaderClick(col.id) : undefined}
                  style={{ width: col.width !== "1fr" ? col.width : undefined }}
                  title={col.sortable ? "Clicca per ordinare" : undefined}
                  aria-sort={
                    col.sortable && sortCol === col.id
                      ? sortDir === "asc" ? "ascending" : "descending"
                      : col.sortable ? "none" : undefined
                  }
                >
                  <span className="datagrid-th__label">{col.label}</span>
                  {col.sortable && (
                    <span
                      className={`datagrid-th__arrow${sortCol === col.id ? " datagrid-th__arrow--active" : ""}`}
                      aria-hidden="true"
                    >
                      {sortCol === col.id
                        ? (sortDir === "asc" ? "\u25B2" : "\u25BC")
                        : "\u21C5"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedDocs.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="datagrid-empty-cell">
                  Nessun documento trovato.
                </td>
              </tr>
            ) : (
              sortedDocs.map((doc) => {
                const isSelected = selectedId === doc.id;
                return (
                  <tr
                    key={doc.id}
                    className={`datagrid-row${isSelected ? " datagrid-row--selected" : ""} ${getExpiryClass(doc)}`}
                    onClick={() => handleRowClick(doc)}
                    onDoubleClick={() => handleRowDoubleClick(doc)}
                    aria-selected={isSelected}
                  >
                    <td className="datagrid-cell datagrid-cell--select">
                      <span
                        className={`datagrid-select${isSelected ? " datagrid-select--on" : ""}`}
                        aria-hidden="true"
                      />
                    </td>
                    <td className="datagrid-cell datagrid-cell--code" title={doc.doc_code || ""}>
                      {doc.doc_code || "-"}
                    </td>
                    <td className="datagrid-cell datagrid-cell--title" title={doc.title}>
                      <span className="datagrid-cell__title">{doc.title}</span>
                      {doc.clause_ref && (
                        <span className="datagrid-cell__clause">
                          {doc.standard_code} {"\u00A7"}{doc.clause_ref}
                        </span>
                      )}
                      {(() => {
                        const vs = getNormValidityState(doc);
                        if (!vs) return null;
                        return (
                          <span
                            className={`norm-validity-badge norm-validity-badge--${vs}`}
                            title={`Vigore norma: ${NORM_VALIDITY_LABEL[vs]}`}
                          >
                            {NORM_VALIDITY_LABEL[vs]}
                          </span>
                        );
                      })()}
                      <IncompleteReasonChips doc={doc} />
                    </td>
                    <td className="datagrid-cell datagrid-cell--file">
                      <DocumentFileBadge doc={doc} />
                    </td>
                    <td className="datagrid-cell datagrid-cell--type">
                      <span className="doc-type-badge">
                        {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                      </span>
                    </td>
                    <td className="datagrid-cell datagrid-cell--rev">
                      {doc.revision || "-"}
                    </td>
                    <td className="datagrid-cell datagrid-cell--status">
                      {shouldShowDocumentStatusBadge(doc) ? (
                        <StatusBadge type="document" status={doc.status} />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className={`datagrid-cell datagrid-cell--expiry ${getExpiryClass(doc)}`}>
                      {doc.expiry_date ? (
                        <span>
                          {doc.is_expired && "\u26A0\uFE0F "}
                          {doc.expiring_soon && !doc.is_expired && "\uD83D\uDFE1 "}
                          {formatDate(doc.expiry_date)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="datagrid-cell datagrid-cell--company" title={doc.company_name || ""}>
                      {doc.company_name || "-"}
                    </td>
                    <td className="datagrid-cell datagrid-cell--responsible" title={doc.responsible || ""}>
                      {doc.responsible || "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DocumentDataGrid;
