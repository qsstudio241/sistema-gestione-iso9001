/**
 * WbWeldAttachments — foto cordone per singola riga sequenza Welding Book (ISO-5b)
 *
 * Pattern identico a RdpTestAttachments / NdtItemAttachments: server-first dopo
 * il primo salvataggio della riga (id numerico), endpoint /attachments con
 * welding_book_weld_id.
 */

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import apiService from "../services/apiService";
import { compressImageFile } from "../hooks/useAttachmentManager";
import "./RdpTestAttachments.css";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/heic,image/heif,image/webp";
const MAX_SIZE_MB = 20;

export function isAcceptedImage(file) {
  if (!file) return false;
  const t = String(file.type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  const name = String(file.name || "").toLowerCase();
  return /\.(jpe?g|png|heic|heif|webp)$/.test(name);
}

const WbWeldAttachments = forwardRef(function WbWeldAttachments(
  { weldId, readOnly = false, onStateChange },
  ref
) {
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!weldId) return;
    apiService.get(`/attachments?welding_book_weld_id=${weldId}`)
      .then((res) => setAttachments(res?.data || res?.attachments || []))
      .catch(() => setAttachments([]));
  }, [weldId]);

  useEffect(() => {
    onStateChange?.({
      count: attachments.length,
      uploading,
      error,
    });
  }, [attachments.length, uploading, error, onStateChange]);

  useImperativeHandle(ref, () => ({
    openFilePicker() {
      if (!readOnly) inputRef.current?.click();
    },
  }), [readOnly]);

  const handleFileSelect = async (eOrFiles) => {
    const files = Array.from(eOrFiles?.target?.files || eOrFiles || []);
    if (!files.length) return;
    setError(null);
    setUploading(true);

    for (const file of files) {
      try {
        if (!isAcceptedImage(file)) {
          setError(`Formato non supportato: ${file.name}`);
          continue;
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          setError(`File troppo grande (max ${MAX_SIZE_MB}MB): ${file.name}`);
          continue;
        }

        const fileToUpload = file.type.startsWith("image/")
          ? await compressImageFile(file).catch(() => file)
          : file;

        const formData = new FormData();
        formData.append("file", fileToUpload, fileToUpload.name || file.name);
        formData.append("welding_book_weld_id", String(weldId));
        formData.append("category", "photo");
        formData.append("description", "Foto cordone Welding Book");

        const token = apiService.getToken ? apiService.getToken() : null;
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const resp = await fetch(`${apiService.baseUrl}/attachments/upload`, {
          method: "POST",
          headers,
          credentials: "include",
          body: formData,
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || `Upload fallito (${resp.status})`);
        }

        await resp.json();
        const listResp = await apiService.get(`/attachments?welding_book_weld_id=${weldId}`);
        setAttachments(listResp?.data || listResp?.attachments || []);
      } catch (err) {
        setError("Upload fallito: " + (err.message || "errore sconosciuto"));
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDelete = async (attachmentId) => {
    if (!window.confirm("Eliminare questa foto cordone?")) return;
    try {
      await apiService.delete(`/attachments/${attachmentId}`);
      setAttachments((prev) => prev.filter((a) => a.attachment_id !== attachmentId));
    } catch {
      setError("Errore eliminazione foto");
    }
  };

  const getPreviewUrl = (att) => {
    const token = apiService.getToken ? apiService.getToken() : null;
    const base = `${apiService.baseUrl}/attachments/${att.attachment_id}/download`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  };

  if (!weldId) return null;

  const hasContent = attachments.length > 0 || uploading || !!error;

  return (
    <div
      className={`rdp-att-root${hasContent ? "" : " rdp-att-root-hidden"}`}
      data-testid="wb-weld-attachments"
      onDragOver={(e) => {
        if (readOnly || uploading) return;
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (readOnly || uploading) return;
        handleFileSelect(e.dataTransfer?.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFileSelect}
        disabled={readOnly || uploading}
      />

      {uploading && (
        <span className="rdp-att-status">{"\u23F3"} Caricamento foto cordone...</span>
      )}

      {attachments.length > 0 && (
        <div className="rdp-att-gallery">
          {attachments.map((att) => (
            <div key={att.attachment_id} className="rdp-att-thumb">
              <img
                src={getPreviewUrl(att)}
                alt={att.file_name}
                className="rdp-att-img"
                onClick={() => window.open(getPreviewUrl(att), "_blank")}
                title={att.file_name}
                onError={(e) => { e.target.style.display = "none"; }}
              />
              {!readOnly && (
                <button
                  type="button"
                  className="rdp-att-delete"
                  onClick={() => handleDelete(att.attachment_id)}
                  title="Elimina foto"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <span className="rdp-att-error">{error}</span>}
    </div>
  );
});

export default WbWeldAttachments;
