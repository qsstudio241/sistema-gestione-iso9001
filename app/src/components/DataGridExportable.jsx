/**
 * DataGridExportable — griglia tabellare con export Excel integrato.
 *
 * Primo banco prova standard per griglie esportabili (ADR-013 §6.2 / §11.4).
 * Riutilizzabile per qualifiche, NC, azioni, scadenzari e qualsiasi lista futura.
 *
 * Props:
 *   columns        {Array<{id, label, sortable?, width?, exportSkip?}>}
 *                  exportSkip=true esclude la colonna dall'export Excel
 *   data           {Array<object>}  righe complete (pre-filtrate o meno)
 *   filters        {Array<{id, label, options, value, onChange}>}
 *                  filtri da mostrare nella toolbar; il chiamante applica i filtri
 *                  e passa `data` già filtrata — DataGridExportable esporta ciò che vede
 *   exportFileName {string}  nome file .xlsx senza estensione (default: "export")
 *   loading        {boolean}
 *   emptyMessage   {string}
 *   renderCell     {(row, col) => ReactNode}  renderer custom per cella
 *   getRowKey      {(row) => string|number}
 *   rowClassName   {(row) => string}
 *   onRowClick     {(row) => void}
 *   onRowDoubleClick {(row) => void}
 *   getExportValue {(row, col) => *}  valore raw per l'export (default: row[col.id])
 *
 * Stile: riusa le classi CSS di SgqDataGrid (tema plain).
 */

import React, { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import SgqDataGrid from './SgqDataGrid';
import './DataGridExportable.css';

// ?? Formattazione date per export 

/**
 * Formatta un valore data in DD/MM/YYYY per l'export.
 * Accetta Date, stringhe ISO, null/undefined ? '' o valore originale.
 */
function formatDateForExport(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function isDateValue(v) {
  if (v instanceof Date) return true;
  if (typeof v === 'string' && v.length >= 8) {
    return /^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(v);
  }
  return false;
}

// ?? Export logica ?

/**
 * Genera e scarica un file .xlsx con i dati correnti (filtrati).
 *
 * @param {Array} data       righe visibili
 * @param {Array} columns    definizione colonne
 * @param {string} fileName  nome file senza estensione
 * @param {Function} getExportValue  valore raw per cella
 */
function exportToExcel(data, columns, fileName, getExportValue) {
  const exportCols = columns.filter(c => !c.exportSkip);

  const header = exportCols.map(c => c.label);

  const rows = data.map(row =>
    exportCols.map(col => {
      const raw = getExportValue ? getExportValue(row, col) : row[col.id];
      if (raw == null) return '';
      if (isDateValue(raw)) return formatDateForExport(raw);
      return raw;
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

  // Larghezza colonne automatica (max 50 char)
  ws['!cols'] = exportCols.map((col, i) => {
    const maxLen = Math.max(
      col.label.length,
      ...rows.map(r => String(r[i] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dati');
  XLSX.writeFile(wb, `${fileName || 'export'}.xlsx`);
}

// ?? Componente filtro 

function FilterSelect({ id, label, options, value, onChange }) {
  return (
    <div className="dgx-filter">
      <label className="dgx-filter__label" htmlFor={`dgx-filter-${id}`}>
        {label}
      </label>
      <select
        id={`dgx-filter-${id}`}
        className="dgx-filter__select"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
      >
        {options.map(opt => (
          <option key={opt.value ?? ''} value={opt.value ?? ''}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ?? Componente principale ??

function DataGridExportable({
  columns = [],
  data = [],
  filters = [],
  exportFileName = 'export',
  loading = false,
  emptyMessage = 'Nessun elemento trovato.',
  renderCell,
  getRowKey = row => row.id,
  rowClassName,
  onRowClick,
  onRowDoubleClick,
  getExportValue,
  className = '',
}) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(() => {
    if (!data.length) return;
    setExporting(true);
    try {
      exportToExcel(data, columns, exportFileName, getExportValue);
    } finally {
      // Timeout minimo per feedback visivo
      setTimeout(() => setExporting(false), 600);
    }
  }, [data, columns, exportFileName, getExportValue]);

  const hasFilters = filters.length > 0;

  const toolbar = useMemo(() => (
    <div className="dgx-toolbar">
      {hasFilters && (
        <div className="dgx-toolbar__filters">
          {filters.map(f => (
            <FilterSelect key={f.id} {...f} />
          ))}
        </div>
      )}
      <div className="dgx-toolbar__actions">
        <span className="dgx-row-count">
          {data.length} {data.length === 1 ? 'riga' : 'righe'}
        </span>
        <button
          type="button"
          className={`dgx-export-btn${exporting ? ' dgx-export-btn--busy' : ''}`}
          onClick={handleExport}
          disabled={exporting || !data.length}
          title="Esporta in Excel (.xlsx)"
          aria-busy={exporting}
        >
          <span className="dgx-export-btn__icon" aria-hidden="true">
            {'\uD83D\uDCCA'}
          </span>
          <span className="dgx-export-btn__label">
            {exporting ? 'Esportazione...' : 'Esporta Excel'}
          </span>
        </button>
      </div>
    </div>
  ), [hasFilters, filters, data.length, exporting, handleExport]);

  return (
    <div className={`dgx-root${className ? ` ${className}` : ''}`}>
      {toolbar}
      <SgqDataGrid
        rows={data}
        columns={columns}
        loading={loading}
        emptyMessage={emptyMessage}
        renderCell={renderCell}
        getRowKey={getRowKey}
        rowClassName={rowClassName}
        onRowClick={onRowClick}
        onRowDoubleClick={onRowDoubleClick}
        theme="plain"
      />
    </div>
  );
}

export default DataGridExportable;
