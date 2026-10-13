/**
 * ProtectedFile — apertura e anteprima dei file protetti di /uploads (certificati).
 *
 * `/uploads/*` non è più pubblico: il file si scarica con fetch + Authorization e
 * si mostra con il visualizzatore in-app (`DocumentPdfViewer`, stesso chrome degli
 * altri documenti). Nessun `window.open` / `<a href>` verso il backend, quindi niente
 * popup bloccati su Safari iOS / Chrome Android: su mobile il viewer offre «Apri»
 * (condividi / nuova scheda da blob già scaricato) e «Scarica».
 */
import React, { useCallback, useEffect, useState } from "react";
import apiService from "../services/apiService";
import DocumentPdfViewer, { prefersMobilePdfFallback } from "./DocumentPdfViewer";
import { protectedFileErrorMessage, protectedFileName } from "../utils/protectedFile";
import "./ProtectedFile.css";

const stopBubbling = (e) => e.stopPropagation();

/**
 * Pulsante-link che apre il file nel visualizzatore.
 * @param {object} props
 * @param {string} props.fileUrl valore salvato nel record (`/uploads/...`)
 * @param {string} props.kind "qualifica" | "wpqr" | "materiale" (nome download = tipo-id)
 * @param {string|number} props.recordId
 */
export function ProtectedFileLink({ fileUrl, kind, recordId, className = "", title, children }) {
  const [open, setOpen] = useState(false);
  const load = useCallback(() => apiService.fetchProtectedFileBlob(fileUrl), [fileUrl]);

  if (!fileUrl) return null;
  return (
    <span className="protected-file" onClick={stopBubbling}>
      <button
        type="button"
        className={`protected-file-link ${className}`.trim()}
        title={title || "Apri certificato"}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && (
        <DocumentPdfViewer
          loadBlob={load}
          sourceKey={fileUrl}
          fileName={protectedFileName(kind, recordId)}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

/**
 * Anteprima incorporata (desktop: iframe da blob; mobile o errore: pulsante / messaggio).
 */
export function ProtectedFilePreview({ fileUrl, kind, recordId, className = "", title = "Anteprima file" }) {
  const mobile = prefersMobilePdfFallback();
  const [state, setState] = useState({ blobUrl: null, status: "idle" });

  useEffect(() => {
    if (!fileUrl || mobile) return undefined;
    let cancelled = false;
    let objectUrl = null;
    setState({ blobUrl: null, status: "loading" });
    apiService
      .fetchProtectedFileBlob(fileUrl)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ blobUrl: objectUrl, status: "ready" });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ blobUrl: null, status: "error", httpStatus: typeof err?.status === "number" ? err.status : null });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl, mobile]);

  if (!fileUrl) return null;

  if (mobile) {
    return (
      <div className="protected-file-fallback">
        <ProtectedFileLink fileUrl={fileUrl} kind={kind} recordId={recordId} className="protected-file-link--button">
          Apri il PDF
        </ProtectedFileLink>
        <p className="protected-file-hint">Su mobile il PDF si apre nel visualizzatore di sistema.</p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <p className="protected-file-error" role="alert">
        {protectedFileErrorMessage(state.httpStatus)}
      </p>
    );
  }
  if (state.status !== "ready") {
    return <p className="protected-file-hint">Caricamento anteprima...</p>;
  }
  return <iframe className={className} title={title} src={state.blobUrl} />;
}

export default ProtectedFileLink;
