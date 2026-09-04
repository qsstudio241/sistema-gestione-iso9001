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
 * Controlli: zoom (50%-200%), adatta-larghezza, fullscreen toggle (chrome condiviso).
 */
import React, { useState, useEffect, useRef } from "react";
import apiService from "../services/apiService";
import DocumentViewerChrome from "./DocumentViewerChrome";
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

  const extraActions = (
    <div className="pdf-viewer-zoom">
      <button
        type="button"
        onClick={zoomOut}
        disabled={zoom <= ZOOM_MIN}
        title="Riduci zoom"
        className="pdf-viewer-zoom__btn"
      >
        {"\u2212"}
      </button>
      <button
        type="button"
        onClick={zoomFit}
        title="Adatta (100%)"
        className="pdf-viewer-zoom__value"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        onClick={zoomIn}
        disabled={zoom >= ZOOM_MAX}
        title="Aumenta zoom"
        className="pdf-viewer-zoom__btn"
      >
        {"+"}
      </button>
    </div>
  );

  return (
    <DocumentViewerChrome
      title={fileName || "Documento Word"}
      icon={"\u{1F4C4}"}
      onClose={onClose}
      downloadHref={downloadUrl}
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen((f) => !f)}
      extraActions={extraActions}
      badge={<span className="pdf-viewer-header__badge">Sola lettura</span>}
    >
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
              width: "fit-content",
            }}
          />
        </div>
      </div>
    </DocumentViewerChrome>
  );
}
