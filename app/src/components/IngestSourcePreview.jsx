/**
 * IngestSourcePreview — anteprima documento sorgente nella revisione ingest (IG-3+)
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import apiService from "../services/apiService";
import { openPdfBlob, prefersMobilePdfFallback } from "./DocumentPdfViewer";
import "./IngestSourcePreview.css";

function isImageMime(mime) {
  return typeof mime === "string" && mime.startsWith("image/");
}

function openBlobInNewTab(blobUrl) {
  const win = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!win) {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export default function IngestSourcePreview({
  stagingId = null,
  fileName = "",
  mimeType = "application/pdf",
  previewFile = null,
}) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [blobRef, setBlobRef] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const revokeRef = useRef(null);
  const useMobileLayout = prefersMobilePdfFallback();
  const isImage = isImageMime(mimeType) || /\.(jpe?g|png)$/i.test(fileName || "");

  const cleanupUrl = useCallback(() => {
    if (revokeRef.current) {
      URL.revokeObjectURL(revokeRef.current);
      revokeRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setExpanded(false);
    cleanupUrl();
    setBlobUrl(null);
    setBlobRef(null);

    async function load() {
      try {
        let blob;
        if (previewFile instanceof Blob) {
          blob = previewFile;
        } else if (stagingId) {
          blob = await apiService.getIngestStagingFileBlob(stagingId);
        } else {
          throw new Error("Nessuna sorgente anteprima");
        }
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revokeRef.current = url;
        setBlobRef(blob);
        setBlobUrl(url);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      cleanupUrl();
    };
  }, [stagingId, previewFile, cleanupUrl]);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const handleOpenNewTab = useCallback(async () => {
    if (!blobUrl || !blobRef) return;
    setOpening(true);
    try {
      if (isImage || !useMobileLayout) {
        openBlobInNewTab(blobUrl);
      } else {
        await openPdfBlob(blobRef, blobUrl, fileName || "documento.pdf");
      }
    } finally {
      setOpening(false);
    }
  }, [blobUrl, blobRef, fileName, isImage, useMobileLayout]);

  const renderPreviewContent = (fullscreen = false) => {
    if (loading) {
      return <p className="ingest-source-preview__status">Caricamento anteprima...</p>;
    }
    if (loadError) {
      return (
        <p className="ingest-source-preview__status ingest-source-preview__status--error">
          Anteprima non disponibile. Usa &quot;Apri in nuova scheda&quot; o il PDF sul PC.
        </p>
      );
    }
    if (!blobUrl) return null;

    if (isImage) {
      return (
        <img
          src={blobUrl}
          alt={fileName || "Anteprima documento"}
          className={fullscreen ? "ingest-source-preview__image ingest-source-preview__image--fullscreen" : "ingest-source-preview__image"}
        />
      );
    }

    if (useMobileLayout && !fullscreen) {
      return (
        <div className="ingest-source-preview__mobile">
          <p>Su mobile l&apos;anteprima inline può non funzionare.</p>
          <button type="button" className="ingest-source-preview__open-btn" onClick={handleOpenNewTab}>
            Apri PDF
          </button>
        </div>
      );
    }

    return (
      <iframe
        title={fileName || "Anteprima PDF"}
        src={blobUrl}
        className={fullscreen ? "ingest-source-preview__iframe ingest-source-preview__iframe--fullscreen" : "ingest-source-preview__iframe"}
      />
    );
  };

  return (
    <>
      <div className={`ingest-source-preview ${expanded ? "ingest-source-preview--hidden" : ""}`}>
        <div className="ingest-source-preview__toolbar">
          <span className="ingest-source-preview__label">{"\uD83D\uDCC4"} Documento sorgente</span>
          {blobUrl && (
            <div className="ingest-source-preview__toolbar-actions">
              <button
                type="button"
                className="ingest-source-preview__open-btn"
                onClick={() => setExpanded(true)}
              >
                Ingrandisci
              </button>
              <button
                type="button"
                className="ingest-source-preview__open-btn"
                onClick={handleOpenNewTab}
                disabled={opening}
              >
                {opening ? "Apertura..." : "Nuova scheda"}
              </button>
            </div>
          )}
        </div>
        <div className="ingest-source-preview__frame">
          {renderPreviewContent(false)}
        </div>
      </div>

      {expanded && blobUrl && (
        <div className="ingest-source-preview__fullscreen" role="dialog" aria-label="Anteprima documento ingrandita">
          <div className="ingest-source-preview__fullscreen-header">
            <strong className="ingest-source-preview__fullscreen-title">{fileName || "Documento"}</strong>
            <div className="ingest-source-preview__toolbar-actions">
              <button
                type="button"
                className="ingest-source-preview__open-btn"
                onClick={handleOpenNewTab}
                disabled={opening}
              >
                Nuova scheda
              </button>
              <button
                type="button"
                className="ingest-source-preview__open-btn ingest-source-preview__open-btn--primary"
                onClick={() => setExpanded(false)}
              >
                Riduci
              </button>
            </div>
          </div>
          <div className="ingest-source-preview__fullscreen-body">
            {renderPreviewContent(true)}
          </div>
          <p className="ingest-source-preview__fullscreen-hint">ESC o &quot;Riduci&quot; per tornare ai campi</p>
        </div>
      )}
    </>
  );
}
