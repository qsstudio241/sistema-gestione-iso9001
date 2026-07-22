/**
 * SgqDataGrid  -  griglia tabellare riusabile (sort, loading, empty)
 * theme="plain" | theme="catalog" (classi datagrid-* da DocumentDataGrid.css)
 */
import React, { useState, useMemo, useCallback, useEffect } from "react";
import "./SgqDataGrid.css";

function defaultSortValue(row, colId) {
  const v = row[colId];
  if (v == null) return "";
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v;
  return String(v).toLowerCase();
}

function sortRows(rows, sortCol, sortDir, getSortValue) {
  if (!sortCol) return rows;
  const sorted = [...rows].sort((a, b) => {
    let va = getSortValue(a, sortCol);
    let vb = getSortValue(b, sortCol);
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  return sorted;
}

function SgqDataGrid({
  rows = [],
  columns = [],
  loading = false,
  emptyMessage = "Nessun elemento trovato.",
  theme = "plain",
  renderCell,
  getRowKey = (row) => row.id,
  getSortValue = defaultSortValue,
  rowClassName,
  selectable = false,
  selectedRowKey = null,
  onRowSelect,
  renderToolbar,
  onRowDoubleClick,
  onRowClick,
  className = "",
}) {
  const [sortCol, setSortCol] = useState(columns.find((c) => c.sortable)?.id || null);
  const [sortDir, setSortDir] = useState("asc");
  const [internalSelected, setInternalSelected] = useState(null);

  const isCatalog = theme === "catalog";
  const rootClass = isCatalog ? "datagrid" : "sgq-datagrid";
  const selectedKey = selectable ? (selectedRowKey ?? internalSelected) : null;

  useEffect(() => {
    if (selectedKey && !rows.some((r) => getRowKey(r) === selectedKey)) {
      if (onRowSelect) onRowSelect(null);
      else setInternalSelected(null);
    }
  }, [rows, selectedKey, getRowKey, onRowSelect]);

  const sortedRows = useMemo(
    () => sortRows(rows, sortCol, sortDir, getSortValue),
    [rows, sortCol, sortDir, getSortValue]
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

  const handleRowClick = useCallback(
    (row) => {
      if (!selectable) return;
      const key = getRowKey(row);
      const next = selectedKey === key ? null : key;
      if (onRowSelect) onRowSelect(next, next ? row : null);
      else setInternalSelected(next);
    },
    [selectable, getRowKey, selectedKey, onRowSelect]
  );

  if (loading) {
    return (
      <div className={`${rootClass} ${rootClass}--loading ${className}`.trim()}>
        <div className={isCatalog ? "docregistry-loading" : "sgq-datagrid-loading"}>
          {!isCatalog && <div className="loading-spinner-sm" aria-hidden="true" />}
          <span>Caricamento...</span>
        </div>
      </div>
    );
  }

  const tableClass = isCatalog ? "datagrid-table" : "sgq-datagrid-table";
  const wrapClass = isCatalog ? "datagrid-table-wrap" : "sgq-datagrid-table-wrap";

  return (
    <div className={`${rootClass} ${className}`.trim()}>
      {selectable && renderToolbar && (
        <div className={`datagrid-toolbar${selectedKey ? " datagrid-toolbar--active" : ""}`}>
          {renderToolbar({ selectedRow: rows.find((r) => getRowKey(r) === selectedKey) || null })}
        </div>
      )}

      <div className={wrapClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              {selectable && (
                <th className={`${isCatalog ? "datagrid-th datagrid-th--select" : "sgq-datagrid-th sgq-datagrid-th--select"}`} aria-label="Selezione" />
              )}
              {columns.map((col) => {
                const thClass = isCatalog ? "datagrid-th" : "sgq-datagrid-th";
                const sortable = col.sortable === true;
                return (
                  <th
                    key={col.id}
                    className={`${thClass}${sortable ? ` ${thClass}--sortable` : ""}${sortCol === col.id ? ` ${thClass}--active` : ""}${col.headerClassName ? ` ${col.headerClassName}` : ""}`}
                    style={col.width && col.width !== "1fr" ? { width: col.width } : undefined}
                    onClick={sortable ? () => handleHeaderClick(col.id) : undefined}
                    title={sortable ? "Clicca per ordinare" : undefined}
                    aria-sort={
                      sortable && sortCol === col.id
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : sortable
                          ? "none"
                          : undefined
                    }
                  >
                    <span className={isCatalog ? "datagrid-th__label" : "sgq-datagrid-th__label"}>{col.label}</span>
                    {sortable && (
                      <span
                        className={`${isCatalog ? "datagrid-th__arrow" : "sgq-datagrid-th__arrow"}${sortCol === col.id ? ` ${isCatalog ? "datagrid-th__arrow--active" : "sgq-datagrid-th__arrow--active"}` : ""}`}
                        aria-hidden="true"
                      >
                        {sortCol === col.id ? (sortDir === "asc" ? "\u25B2" : "\u25BC") : "\u21C5"}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className={isCatalog ? "datagrid-empty-cell" : "sgq-datagrid-empty-cell"}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const rowKey = getRowKey(row);
                const isSelected = selectable && selectedKey === rowKey;
                const extraClass = rowClassName ? rowClassName(row) : "";
                const clickable = !selectable && (onRowClick || onRowDoubleClick);
                const trClass = isCatalog
                  ? `datagrid-row${isSelected ? " datagrid-row--selected" : ""}${clickable ? " datagrid-row--clickable" : ""}${extraClass ? ` ${extraClass}` : ""}`
                  : `sgq-datagrid-row${isSelected ? " sgq-datagrid-row--selected" : ""}${clickable ? " sgq-datagrid-row--clickable" : ""}${extraClass ? ` ${extraClass}` : ""}`;
                const tdClass = isCatalog ? "datagrid-cell" : "sgq-datagrid-cell";
                return (
                  <tr
                    key={rowKey}
                    className={trClass}
                    onClick={
                      selectable
                        ? () => handleRowClick(row)
                        : onRowClick
                          ? () => onRowClick(row)
                          : undefined
                    }
                    onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row) : undefined}
                    aria-selected={selectable ? isSelected : undefined}
                  >
                    {selectable && (
                      <td className={`${tdClass} ${isCatalog ? "datagrid-cell--select" : "sgq-datagrid-cell--select"}`}>
                        <span
                          className={`${isCatalog ? "datagrid-select" : "sgq-datagrid-select"}${isSelected ? ` ${isCatalog ? "datagrid-select--on" : "sgq-datagrid-select--on"}` : ""}`}
                          aria-hidden="true"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={`${tdClass}${col.cellClassName ? ` ${col.cellClassName}` : ""}`}
                        style={col.width && col.width !== "1fr" ? { width: col.width } : undefined}
                      >
                        {renderCell ? renderCell(row, col) : row[col.id] ?? "-"}
                      </td>
                    ))}
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

export default SgqDataGrid;
