/**
 * DocumentPdfViewer  visualizzatore PDF inline nel browser
 *
 * Usa l'iframe nativo del browser per renderizzare PDF senza librerie esterne.
 * Supporta: zoom, navigazione pagine, stampa (tutti gestiti dal viewer nativo).
 * Fallback: link download se il browser non supporta PDF inline.
 */
import React, { useState, useMemo } from "react";
import apiService from "../services/apiService";
import "./DocumentPdfViewer.css";

export default function DocumentPdfViewer({ docId, attachmentId, fileName, onClose }) {
  const [loadError, setLoadError] = useState(false);

  const pdfUrl = useMemo(() => {
    if (!docId) return null;
    return apiService.getDocFileDownloadUrl(docId, attachmentId || null, true);
  }, [docId, attachmentId]);

  const downloadUrl = useMemo(() => {
    if (!docId) return null;
    return apiService.getDocFileDownloadUrl(docId, attachmentId || null, false);
  }, [docId, attachmentId]);

  if (!pdfUrl) return null;

  return (
    <div className="pdf-viewer-overlay" onClick={onClose}>
      <div className="pdf-viewer-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pdf-viewer-header">
          <div className="pdf-viewer-header__info">
            <span className="pdf-viewer-header__icon" aria-hidden>{"\u{1F4C4}"}</span>
            <span className="pdf-viewer-header__title">
              {fileName || "Documento PDF"}
            </span>
          </div>
          <div className="pdf-viewer-header__actions">
            <a
              href={downloadUrl}
              className="pdf-viewer-btn pdf-viewer-btn--download"
              download
              title="Scarica file"
            >
              {"\u{1F4BE}"} Scarica
            </a>
            <button
              className="pdf-viewer-btn pdf-viewer-btn--close"
              onClick={onClose}
              title="Chiudi"
            >
              {"\u{00D7}"}
            </button>
          </div>
        </div>

        {/* Viewer */}
        <div className="pdf-viewer-body">
          {loadError ? (
            <div className="pdf-viewer-fallback">
              <p>Il browser non riesce a visualizzare questo PDF.</p>
              <a href={downloadUrl} className="pdf-viewer-btn pdf-viewer-btn--download" download>
                {"\u{1F4BE}"} Scarica il file per visualizzarlo
              </a>
            </div>
          ) : (
            <iframe
              src={pdfUrl}
              className="pdf-viewer-iframe"
              title={fileName || "PDF Viewer"}
              onError={() => setLoadError(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
