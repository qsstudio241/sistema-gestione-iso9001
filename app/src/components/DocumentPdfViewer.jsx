/**
 * DocumentPdfViewer  visualizzatore PDF inline nel browser
 *
 * Usa fetch via Axios (con cookie httpOnly) + blob URL per l'iframe.
 * Evita il problema del token mancante in querystring quando l'auth
 * desktop usa cookie httpOnly (non leggibili da JavaScript).
 *
 * Su mobile (Android/iOS) l'iframe con blob mostra il placeholder nativo
 * «Apri» che spesso non funziona: usiamo pulsanti propri con blob + share.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import apiService from "../services/apiService";
import DocumentViewerChrome from "./DocumentViewerChrome";
import { fileNameWithExt, protectedFileErrorMessage } from "../utils/protectedFile";
import "./DocumentPdfViewer.css";

/** Touch / viewport stretto: iframe PDF blob inaffidabile (Chrome Android). */
export function prefersMobilePdfFallback() {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    if (window.matchMedia("(pointer: coarse)")?.matches) return true;
    if (window.matchMedia("(max-width: 640px)")?.matches) return true;
  }
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

function triggerBlobLink(blobUrl, { download, fileName, newTab } = {}) {
  const link = document.createElement("a");
  link.href = blobUrl;
  if (download) link.download = fileName || "documento.pdf";
  if (newTab) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function openPdfBlob(blob, blobUrl, fileName) {
  const safeName = fileName || "documento.pdf";

  if (navigator.canShare && blob instanceof Blob) {
    try {
      const file = new File([blob], safeName, { type: blob.type || "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: safeName });
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }

  triggerBlobLink(blobUrl, { newTab: true });
}

/**
 * @param {object} props
 * @param {() => Promise<Blob>} [props.loadBlob] sorgente alternativa a `docId` (es. file protetti
 *   di /uploads). Cambiando `sourceKey` il file viene ricaricato.
 */
export default function DocumentPdfViewer({ docId, attachmentId, fileName, onClose, loadBlob, sourceKey }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [errorStatus, setErrorStatus] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const loadBlobRef = useRef(loadBlob);
  loadBlobRef.current = loadBlob;
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const revokeRef = useRef(null);
  const blobRef = useRef(null);
  const useMobileLayout = prefersMobilePdfFallback();

  useEffect(() => {
    if (!docId && !loadBlobRef.current) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setErrorStatus(null);
    setBlobUrl(null);
    setPdfBlob(null);
    blobRef.current = null;

    const source = loadBlobRef.current
      ? loadBlobRef.current()
      : apiService.getDocFileBlob(docId, attachmentId || null);

    source
      .then((blob) => {
        if (cancelled) return;
        blobRef.current = blob;
        setPdfBlob(blob);
        const url = URL.createObjectURL(blob);
        revokeRef.current = url;
        setBlobUrl(url);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorStatus(typeof err?.status === "number" ? err.status : null);
        setLoadError(true);
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
      blobRef.current = null;
    };
  }, [docId, attachmentId, sourceKey, retryCount]);

  const downloadName = fileNameWithExt(fileName || "documento", pdfBlob?.type || "application/pdf");
  const isImage = String(pdfBlob?.type || "").startsWith("image/");

  const handleDownload = useCallback(() => {
    if (!blobUrl) return;
    triggerBlobLink(blobUrl, { download: true, fileName: downloadName });
  }, [blobUrl, downloadName]);

  const handleOpen = useCallback(async () => {
    if (!blobUrl || !blobRef.current) return;
    setOpening(true);
    try {
      await openPdfBlob(blobRef.current, blobUrl, downloadName);
    } catch {
      triggerBlobLink(blobUrl, { newTab: true });
    } finally {
      setOpening(false);
    }
  }, [blobUrl, downloadName]);

  if (!docId && !loadBlob) return null;

  return (
    <DocumentViewerChrome
      title={fileName || "Documento PDF"}
      icon={"\u{1F4C4}"}
      onClose={onClose}
      onDownload={handleDownload}
      downloadDisabled={!blobUrl}
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen((f) => !f)}
    >
        <div className="pdf-viewer-body">
          {loading && (
            <div className="pdf-viewer-fallback">
              <p>Caricamento PDF...</p>
            </div>
          )}
          {!loading && loadError && loadBlob && (
            <div className="pdf-viewer-fallback" role="alert">
              <p>{protectedFileErrorMessage(errorStatus)}</p>
              {errorStatus !== 401 && errorStatus !== 403 && errorStatus !== 404 && (
                <button
                  type="button"
                  className="pdf-viewer-btn pdf-viewer-btn--download"
                  onClick={() => setRetryCount((n) => n + 1)}
                >
                  Riprova
                </button>
              )}
            </div>
          )}
          {!loading && loadError && !loadBlob && (
            <div className="pdf-viewer-fallback">
              <p>Il browser non riesce a visualizzare questo PDF.</p>
              <button
                type="button"
                className="pdf-viewer-btn pdf-viewer-btn--download"
                onClick={() => {
                  const url = apiService.getDocFileDownloadUrl(docId, attachmentId || null, false);
                  triggerBlobLink(url, { download: true, fileName: fileName || "documento.pdf" });
                }}
              >
                {"\u{1F4BE}"} Scarica il file per visualizzarlo
              </button>
            </div>
          )}
          {!loading && blobUrl && useMobileLayout && (
            <div className="pdf-viewer-fallback pdf-viewer-mobile">
              <span className="pdf-viewer-mobile__icon" aria-hidden>
                PDF
              </span>
              <p className="pdf-viewer-mobile__name">{fileName || "Documento PDF"}</p>
              <p className="pdf-viewer-mobile__hint">
                Su mobile il PDF si apre nel visualizzatore di sistema o tramite condividi.
              </p>
              <button
                type="button"
                className="pdf-viewer-btn pdf-viewer-btn--open pdf-viewer-btn--open-lg"
                onClick={handleOpen}
                disabled={opening}
              >
                {opening ? "Apertura..." : "Apri"}
              </button>
            </div>
          )}
          {!loading && blobUrl && !useMobileLayout && isImage && (
            <img src={blobUrl} className="pdf-viewer-image" alt={fileName || "Documento"} />
          )}
          {!loading && blobUrl && !useMobileLayout && !isImage && (
            <iframe
              src={blobUrl}
              className="pdf-viewer-iframe"
              title={fileName || "PDF Viewer"}
              onError={() => setLoadError(true)}
            />
          )}
        </div>
    </DocumentViewerChrome>
  );
}
