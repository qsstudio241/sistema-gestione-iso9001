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
 *
 * Controlli: zoom (50%-200%), adatta-larghezza, fullscreen toggle.
 */
import React, { useState, useEffect, useRef } from "react";
import apiService from "../services/apiService";
import "./DocumentPdfViewer.css";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.1;

export default function DocumentDocxViewer({ docId, attachmentId, fileName, onClose }) {
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(null);
  const [zoom,       setZoom]       = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
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

  const zoomIn   = () => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut  = () => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
  const zoomFit  = () => setZoom(1);

  const containerStyle = fullscreen
    ? { maxWidth: "none", width: "100vw", height: "100vh", borderRadius: 0 }
    : {};

  return (
    <div
      className="pdf-viewer-overlay"
      onClick={onClose}
      style={fullscreen ? { padding: 0 } : {}}
    >
      <div
        className="pdf-viewer-container"
        onClick={(e) => e.stopPropagation()}
        style={containerStyle}
      >
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
            {/* Zoom controls */}
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "#fff", border: "1px solid #d1d5db",
              borderRadius: 6, padding: "2px 4px", marginRight: 4
            }}>
              <button
                onClick={zoomOut}
                disabled={zoom <= ZOOM_MIN}
                title="Riduci zoom"
                style={{
                  border: "none", background: "transparent",
                  padding: "4px 8px", cursor: zoom <= ZOOM_MIN ? "not-allowed" : "pointer",
                  fontSize: 16, color: zoom <= ZOOM_MIN ? "#9ca3af" : "#374151"
                }}
              >
                {"\u2212"}
              </button>
              <button
                onClick={zoomFit}
                title="Adatta (100%)"
                style={{
                  border: "none", background: "transparent",
                  padding: "4px 8px", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, color: "#374151",
                  minWidth: 48, textAlign: "center"
                }}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={zoomIn}
                disabled={zoom >= ZOOM_MAX}
                title="Aumenta zoom"
                style={{
                  border: "none", background: "transparent",
                  padding: "4px 8px", cursor: zoom >= ZOOM_MAX ? "not-allowed" : "pointer",
                  fontSize: 16, color: zoom >= ZOOM_MAX ? "#9ca3af" : "#374151"
                }}
              >
                {"+"}
              </button>
            </div>

            {/* Fullscreen toggle */}
            <button
              className="pdf-viewer-btn"
              onClick={() => setFullscreen(f => !f)}
              title={fullscreen ? "Esci da schermo intero" : "Schermo intero"}
              style={{
                background: "#f3f4f6", color: "#374151",
                border: "1px solid #d1d5db",
              }}
            >
              {fullscreen ? "\u{2922}" : "\u{26F6}"} {fullscreen ? "Riduci" : "Schermo intero"}
            </button>

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

        <div
          className="pdf-viewer-body"
          style={{ background: "#f5f5f5", overflow: "auto", padding: 16 }}
        >
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
          {/* Wrapper centrale che applica lo zoom */}
          <div
            style={{
              display: loading || loadError ? "none" : "flex",
              justifyContent: "center",
            }}
          >
            <div
              ref={containerRef}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
                transition: "transform 0.15s ease",
                background: "#fff",
                boxShadow: "0 0 8px rgba(0,0,0,0.1)",
                /* Compensa la scala riservando spazio: width 100% così, altezza calcolata da contenuto */
                width: "fit-content",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
