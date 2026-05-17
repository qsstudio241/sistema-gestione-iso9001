/**
 * DocumentPdfViewer  visualizzatore PDF inline nel browser
 *
 * Usa fetch via Axios (con cookie httpOnly) + blob URL per l'iframe.
 * Evita il problema del token mancante in querystring quando l'auth
 * desktop usa cookie httpOnly (non leggibili da JavaScript).
 */
import React, { useState, useEffect, useRef } from "react";
import apiService from "../services/apiService";
import "./DocumentPdfViewer.css";

export default function DocumentPdfViewer({ docId, attachmentId, fileName, onClose }) {
  const [blobUrl,   setBlobUrl]   = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const revokeRef = useRef(null);

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setBlobUrl(null);

    apiService.getDocFileBlob(docId, attachmentId || null)
      .then(blob => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revokeRef.current = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (revokeRef.current) {
        URL.revokeObjectURL(revokeRef.current);
        revokeRef.current = null;
      }
    };
  }, [docId, attachmentId]);

  const downloadUrl = apiService.getDocFileDownloadUrl(docId, attachmentId || null, false);

  if (!docId) return null;

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
          {loading && (
            <div className="pdf-viewer-fallback">
              <p>Caricamento PDF...</p>
            </div>
          )}
          {!loading && loadError && (
            <div className="pdf-viewer-fallback">
              <p>Il browser non riesce a visualizzare questo PDF.</p>
              <a href={downloadUrl} className="pdf-viewer-btn pdf-viewer-btn--download" download>
                {"\u{1F4BE}"} Scarica il file per visualizzarlo
              </a>
            </div>
          )}
          {!loading && blobUrl && (
            <iframe
              src={blobUrl}
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
