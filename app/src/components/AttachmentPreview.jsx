/**
 * AttachmentPreview.jsx
 *
 * Lista banner cliccabili degli allegati sul server per una domanda checklist.
 *
 * Props:
 * - auditId:    UUID dell audit
 * - questionId: ID numerico della domanda
 * - refreshKey: incrementato dal parent per forzare re-fetch post-upload
 *
 * Pattern blob lazy (fetch solo al click, non al mount):
 *  - Immagini / PDF / testo: fetch blob -> URL.createObjectURL -> window.open(newTab)
 *    Blob in RAM (nessun file su disco). Revocato dopo 10s.
 *  - Word / Excel / altri:   fetch blob -> <a download> -> cartella Download browser
 *    Revocato subito (il browser ha gia copiato i byte nel file di destinazione).
 */

import React, { useEffect, useState, useCallback } from "react";
import apiService from "../services/apiService";
import "./AttachmentPreview.css";

// ---- helpers ----------------------------------------------------------------

function getFileInfo(mimeType) {
  if (!mimeType) return { icon: "📎", action: "download" };
  if (mimeType.startsWith("image/")) return { icon: "🖼️", action: "open" };
  if (mimeType === "application/pdf") return { icon: "📄", action: "open" };
  if (mimeType.startsWith("text/")) return { icon: "📃", action: "open" };
  if (mimeType.includes("word") || mimeType.includes("msword"))
    return { icon: "📝", action: "download" };
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
    return { icon: "📊", action: "download" };
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation"))
    return { icon: "📊", action: "download" };
  return { icon: "📎", action: "download" };
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- component --------------------------------------------------------------

function AttachmentPreview({ auditId, questionId, refreshKey = 0, customItemId = null }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(null);
  const [replacing, setReplacing] = useState(null);

  const fetchAttachments = useCallback(async () => {
    // Richiede auditId e almeno uno tra questionId e customItemId
    if (!auditId || (!questionId && !customItemId)) return;
    setLoading(true);
    try {
      const result = customItemId
        ? await apiService.getAttachments(auditId, null, null, customItemId)
        : await apiService.getAttachments(auditId, null, questionId);
      const data = result?.data ?? result ?? [];
      setAttachments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("[AttachmentPreview] Errore fetch:", err.message);
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, [auditId, questionId, customItemId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments, refreshKey]);

  /**
   * Lazy blob fetch al click.
   * - open (img/PDF/testo): blob in RAM -> nuova scheda. Revocato dopo 10s.
   * - download (Word/Excel/...): blob -> <a download> -> Downloads. Revocato subito.
   */
  const handleOpen = useCallback(async (att) => {
    setOpening(att.attachment_id);
    try {
      const { action } = getFileInfo(att.mime_type);

      const endpoint = action === "open" ? "view" : "download";
      const { blob } = await apiService.fetchAttachmentBlob(att.attachment_id, endpoint);
      const blobUrl = URL.createObjectURL(blob);

      if (action === "open") {
        // Blob in RAM → nuova scheda. Revocato dopo 10s (il browser ha già caricato il contenuto).
        window.open(blobUrl, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
      } else {
        // Download → cartella Downloads utente. Revoca immediata.
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = att.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      alert(`Impossibile aprire "${att.file_name}":\n${err.message}`);
    } finally {
      setOpening(null);
    }
  }, []);

  const handleDelete = async (attachmentId, fileName) => {
    if (!window.confirm(`Eliminare "${fileName}" dal server?\n\nQuesta operazione non puo essere annullata.`)) return;
    try {
      await apiService.deleteAttachment(attachmentId);
      setAttachments((prev) => prev.filter((a) => a.attachment_id !== attachmentId));
    } catch (err) {
      alert(`Errore eliminazione: ${err.message}`);
    }
  };

  const handleReplace = useCallback((att) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = att.mime_type?.startsWith("image/") ? "image/*" : "*/*";
    input.style.display = "none";

    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      document.body.removeChild(input);
      if (!file) return;
      setReplacing(att.attachment_id);
      try {
        await apiService.replaceAttachment(att.attachment_id, file);
        await fetchAttachments();
      } catch (err) {
        alert(`Errore sostituzione: ${err.message}`);
      } finally {
        setReplacing(null);
      }
    };

    input.oncancel = () => { document.body.removeChild(input); };
    document.body.appendChild(input);
    input.click();
  }, [fetchAttachments]);

  if (!auditId || (!questionId && !customItemId)) return null;

  if (loading && attachments.length === 0) {
    return (
      <div className="attachment-preview-loading">
        <span className="preview-loading-spinner" />
        <span>Caricamento allegati...</span>
      </div>
    );
  }

  if (attachments.length === 0) return null;

  return (
    <div className="attachment-preview-section">
      <div className="preview-section-header">
        <span>📎</span>
        <span>Allegati sul server ({attachments.length})</span>
      </div>

      <div className="preview-list">
        {attachments.map((att) => {
          const id = att.attachment_id;
          const { icon, action } = getFileInfo(att.mime_type);
          const isOpening = opening === id;
          const isReplacing = replacing === id;

          return (
            <div key={id} className="preview-file-row">
              <button
                type="button"
                className={`preview-file-banner${isOpening ? " loading" : ""}`}
                onClick={() => !isOpening && handleOpen(att)}
                disabled={isOpening}
                title={action === "open" ? `Apri ${att.file_name}` : `Scarica ${att.file_name}`}
              >
                <span className="pf-icon">
                  {isOpening
                    ? <span className="preview-loading-spinner banner-spinner" />
                    : icon}
                </span>
                <span className="pf-meta">
                  <span className="pf-name">{att.file_name}</span>
                  {att.file_size > 0 && (
                    <span className="pf-size">{formatSize(att.file_size)}</span>
                  )}
                </span>
                <span className="pf-cta">
                  {isOpening
                    ? "Caricamento..."
                    : action === "open"
                    ? "↗ Apri"
                    : "⬇ Scarica"}
                </span>
              </button>

              <div className="preview-file-actions">
                <button
                  type="button"
                  className="pf-action-btn replace"
                  onClick={() => handleReplace(att)}
                  disabled={isReplacing}
                  title="Sostituisci file"
                >
                  {isReplacing ? "..." : "✏️"}
                </button>
                <button
                  type="button"
                  className="pf-action-btn delete"
                  onClick={() => handleDelete(id, att.file_name)}
                  title="Elimina allegato"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AttachmentPreview;