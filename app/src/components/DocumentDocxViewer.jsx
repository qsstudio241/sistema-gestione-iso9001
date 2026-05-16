/**
 * DocumentDocxViewer — visualizzatore .docx inline nel browser
 *
 * Usa la libreria docx-preview per renderizzare il documento Word come
 * HTML+CSS preservando il layout (tabelle, immagini, formattazione testo).
 * Funziona interamente lato client: il file viene scaricato come blob e
 * renderizzato. NON dipende da Microsoft Office Online o da Word desktop.
 *
 * Vera SOLA LETTURA: l'utente può solo leggere e scaricare. Non c'è modo
 * di modificare il documento da qui.
 */
import React, { useState, useEffect, useRef } from "react";
import apiService from "../services/apiService";
import "./DocumentPdfViewer.css";

export default function DocumentDocxViewer({ docId, attachmentId, fileName, onClose }) {
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const blob = await apiService.getDocFileBlob(docId, attachmentId || null);
        if (cancelled) return;

        // Import dinamico: la lib carica solo quando serve (riduce bundle)
        const { renderAsync } = await import("docx-preview");
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        await renderAsync(blob, containerRef.current, null, {
          className: "docx-preview",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          experimental: false,
          useBase64URL: true,
        });
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || "Impossibile renderizzare il documento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [docId, attachmentId]);

  const downloadUrl = apiService.getDocFileDownloadUrl(docId, attachmentId || null, false);

  if (!docId) return null;

  return (
    <div className="pdf-viewer-overlay" onClick={onClose}>
      <div className="pdf-viewer-container" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-viewer-header">
          <div className="pdf-viewer-header__info">
            <span className="pdf-viewer-header__icon" aria-hidden>{"\u{1F4C4}"}</span>
            <span className="pdf-viewer-header__title">
              {fileName || "Documento Word"}
            </span>
            <span style={{
              marginLeft: 12, padding: "2px 8px", borderRadius: 4,
              background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 600
            }}>
              Sola lettura
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

        <div className="pdf-viewer-body" style={{ background: "#f5f5f5", overflow: "auto", padding: 16 }}>
          {loading && (
            <div className="pdf-viewer-fallback">
              <p>Caricamento documento...</p>
            </div>
          )}
          {!loading && loadError && (
            <div className="pdf-viewer-fallback">
              <p>Anteprima non disponibile per questo file.</p>
              <a href={downloadUrl} className="pdf-viewer-btn pdf-viewer-btn--download" download>
                {"\u{1F4BE}"} Scarica per visualizzarlo in Word
              </a>
            </div>
          )}
          <div
            ref={containerRef}
            style={{
              display: loading || loadError ? "none" : "block",
              maxWidth: 900,
              margin: "0 auto",
              background: "#fff",
              boxShadow: "0 0 8px rgba(0,0,0,0.1)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
