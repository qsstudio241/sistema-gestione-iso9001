/**
 * SpreadsheetViewer — visualizzatore Excel in-app (privacy-friendly)
 *
 * Scarica il file .xlsx via fetch autenticato, lo parsa con SheetJS
 * e lo renderizza come tabella HTML scrollabile con supporto fogli multipli.
 * Pattern UX identico a DocumentPdfViewer (overlay modale full-screen).
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import apiService from "../services/apiService";
import "./SpreadsheetViewer.css";

const MAX_ROWS_INITIAL = 500;

export default function SpreadsheetViewer({ docId, attachmentId, fileName, onClose }) {
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const downloadUrl = useMemo(() => {
    if (!docId) return null;
    return apiService.getDocFileDownloadUrl(docId, attachmentId || null, false);
  }, [docId, attachmentId]);

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;

    async function fetchAndParse() {
      setLoading(true);
      setError(null);
      try {
        const url = apiService.getDocFileDownloadUrl(docId, attachmentId || null, true);
        const token = apiService.getToken();
        const response = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          throw new Error(`Errore download: HTTP ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array", cellStyles: true });

        if (cancelled) return;
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        setActiveSheet(0);
        setShowAll(false);
      } catch (err) {
        if (!cancelled) setError(err.message || "Impossibile leggere il file Excel");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAndParse();
    return () => { cancelled = true; };
  }, [docId, attachmentId]);

  const { headers, rows, totalRows } = useMemo(() => {
    if (!workbook || sheetNames.length === 0) return { headers: [], rows: [], totalRows: 0 };

    const sheet = workbook.Sheets[sheetNames[activeSheet]];
    if (!sheet) return { headers: [], rows: [], totalRows: 0 };

    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (json.length === 0) return { headers: [], rows: [], totalRows: 0 };

    const hdrs = json[0] || [];
    const allRows = json.slice(1);
    const total = allRows.length;
    const visibleRows = showAll ? allRows : allRows.slice(0, MAX_ROWS_INITIAL);

    return { headers: hdrs, rows: visibleRows, totalRows: total };
  }, [workbook, sheetNames, activeSheet, showAll]);

  const handleSheetChange = useCallback((idx) => {
    setActiveSheet(idx);
    setShowAll(false);
  }, []);

  if (!docId) return null;

  return (
    <div className="spreadsheet-viewer-overlay" onClick={onClose}>
      <div className="spreadsheet-viewer-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="spreadsheet-viewer-header">
          <div className="spreadsheet-viewer-header__info">
            <span className="spreadsheet-viewer-header__icon" aria-hidden>{"\u{1F4CA}"}</span>
            <span className="spreadsheet-viewer-header__title">
              {fileName || "Documento Excel"}
            </span>
          </div>
          <div className="spreadsheet-viewer-header__actions">
            {downloadUrl && (
              <a
                href={downloadUrl}
                className="spreadsheet-viewer-btn spreadsheet-viewer-btn--download"
                download
                title="Scarica file"
              >
                {"\u{1F4BE}"} Scarica
              </a>
            )}
            <button
              className="spreadsheet-viewer-btn spreadsheet-viewer-btn--close"
              onClick={onClose}
              title="Chiudi"
            >
              {"\u{00D7}"}
            </button>
          </div>
        </div>

        {/* Tab fogli */}
        {sheetNames.length > 1 && (
          <div className="spreadsheet-viewer-tabs">
            {sheetNames.map((name, idx) => (
              <button
                key={name}
                className={`spreadsheet-viewer-tab${idx === activeSheet ? " spreadsheet-viewer-tab--active" : ""}`}
                onClick={() => handleSheetChange(idx)}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="spreadsheet-viewer-body">
          {loading && (
            <div className="spreadsheet-viewer-loading">
              <div className="spreadsheet-viewer-spinner" />
              <span>Lettura file in corso...</span>
            </div>
          )}

          {error && (
            <div className="spreadsheet-viewer-error">
              <p>{"\u26A0\uFE0F"} {error}</p>
              <p className="spreadsheet-viewer-error__hint">
                Il file potrebbe essere corrotto o in un formato non supportato.
              </p>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  className="spreadsheet-viewer-btn spreadsheet-viewer-btn--download"
                  download
                >
                  {"\u{1F4BE}"} Scarica il file per aprirlo in Excel
                </a>
              )}
            </div>
          )}

          {!loading && !error && workbook && (
            <>
              {rows.length === 0 && headers.length === 0 ? (
                <div className="spreadsheet-viewer-empty">
                  Il foglio selezionato è vuoto.
                </div>
              ) : (
                <div className="spreadsheet-viewer-table-wrapper">
                  <table className="spreadsheet-viewer-table">
                    {headers.length > 0 && (
                      <thead>
                        <tr>
                          <th className="spreadsheet-viewer-row-num">#</th>
                          {headers.map((h, i) => (
                            <th key={i}>{h !== "" ? String(h) : `Col ${i + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td className="spreadsheet-viewer-row-num">{rIdx + 1}</td>
                          {headers.map((_, cIdx) => (
                            <td key={cIdx}>{row[cIdx] != null ? String(row[cIdx]) : ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {totalRows > MAX_ROWS_INITIAL && !showAll && (
                <div className="spreadsheet-viewer-truncated">
                  <span>
                    Visualizzate {MAX_ROWS_INITIAL} righe su {totalRows}.
                  </span>
                  <button
                    className="spreadsheet-viewer-btn spreadsheet-viewer-btn--show-all"
                    onClick={() => setShowAll(true)}
                  >
                    Mostra tutte le righe
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
