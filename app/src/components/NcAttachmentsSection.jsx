/**
 * NcAttachmentsSection - allegati evidenze su NC (nc_id)
 * Pattern API diretto (upload/list/delete via apiService), riuso CSS AttachmentSection.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import apiService from "../services/apiService";
import "./AttachmentSection.css";

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {object} props
 * @param {number} props.ncId
 * @param {boolean} [props.readOnly]
 */
export default function NcAttachmentsSection({ ncId, readOnly = false }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    if (!ncId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getAttachments(null, ncId);
      setAttachments(res?.data || []);
    } catch {
      setAttachments([]);
      setError("Impossibile caricare gli allegati.");
    } finally {
      setLoading(false);
    }
  }, [ncId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || readOnly) return;

    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        await apiService.uploadAttachment(file, {
          ncId,
          category: "evidence",
          description: "Evidenza NC",
        });
      }
      await load();
    } catch {
      setError("Errore durante il caricamento. Riprovare.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(att) {
    if (readOnly) return;
    const name = att.file_name || "allegato";
    if (!window.confirm(`Eliminare "${name}"?`)) return;
    try {
      await apiService.deleteAttachment(att.attachment_id);
      await load();
    } catch {
      setError("Errore durante l'eliminazione.");
    }
  }

  function handleDownload(att) {
    const url = apiService.getAttachmentDownloadUrl(att.attachment_id);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="nc-form-row nc-attachments-section">
      <label>Allegati evidenze</label>

      {loading && <p className="nc-loading">Caricamento allegati...</p>}

      {!loading && attachments.length === 0 && (
        <p className="nc-empty-actions">Nessun allegato caricato.</p>
      )}

      {!loading && attachments.length > 0 && (
        <ul className="nc-attachments-list">
          {attachments.map(att => (
            <li key={att.attachment_id} className="nc-attachment-item">
              <button
                type="button"
                className="nc-attachment-link"
                onClick={() => handleDownload(att)}
              >
                {att.file_name}
              </button>
              <span className="nc-attachment-meta">
                {formatSize(att.file_size)}
                {att.category ? ` � ${att.category}` : ""}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  className="btn-action-del"
                  onClick={() => handleDelete(att)}
                  aria-label={`Elimina ${att.file_name}`}
                >
                  Elimina
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="nc-error">{error}</p>}

      {!readOnly && (
        <div className="nc-attachments-actions">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*/*"
            className="nc-file-input-hidden"
            onChange={handleFilesSelected}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Caricamento..." : "+ Aggiungi allegato"}
          </button>
        </div>
      )}
    </div>
  );
}
