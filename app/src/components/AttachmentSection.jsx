/**
 * AttachmentSection.jsx
 *
 * Sezione allegati per domande checklist audit ISO 9001.
 * Gestisce upload foto, documenti e verbali con preview e rimozione.
 * Per le foto mostra PhotoEditModal prima del caricamento (rotazione + crop opzionali).
 *
 * Props:
 * - questionId: ID domanda (es. "4.1", "7.5.3")
 * - attachmentManager: Hook useAttachmentManager
 */

import React, { useState, useRef, useCallback } from "react";
import "./AttachmentSection.css";
import PhotoEditModal from "./PhotoEditModal";
import FileDropzone from "./FileDropzone";

function AttachmentSection({ questionId, attachmentManager, onUploadSuccess, customItemId = null }) {
  const [showUploadMenu, setShowUploadMenu] = useState(false);

  // Stato photo editor: null = modal chiuso, File[] = modal aperto con quelle foto
  const [photoEditQueue, setPhotoEditQueue] = useState(null);
  const photoInputRef = useRef(null);

  // Mostra solo allegati NON ancora confermati sul server (pendingSync=true o senza serverAttachmentId)
  // Quelli confermati sono già visibili in AttachmentPreview — evita doppio banner
  const allAttachments = attachmentManager.listAttachments(questionId);
  const questionAttachments = allAttachments.filter(
    (att) => att.pendingSync || !att.serverAttachmentId
  );
  const stats = attachmentManager.getStats(questionId);

  /**
   * Handle file upload for specific category.
   * Per le foto apre prima PhotoEditModal (editor opzionale); per documenti/verbali procede direttamente.
   */
  const handleUpload = async (category, source = "gallery") => {
    setShowUploadMenu(false);

    if (category === "foto") {
      // Apri file picker raw: i file vengono inviati al modal di editing (opzionale)
      if (!photoInputRef.current) return;
      photoInputRef.current.accept = "image/*";
      photoInputRef.current.capture = source === "camera" ? "environment" : "";
      photoInputRef.current.multiple = true;
      photoInputRef.current.click();
      return;
    }

    // Documenti / verbali: flusso diretto senza editing
    const result = await attachmentManager.openFilePicker(
      questionId,
      category,
      source,
      customItemId ? { customItemId } : {}
    );

    if (!result.success) {
      alert(`❌ Errore: ${result.error}`);
      return;
    }

    if (result.partial) {
      alert(
        `⚠️ Upload parziale:\n✅ ${result.uploaded} caricati\n❌ ${result.failed} falliti`
      );
    } else {
      // Success notification (silent - no alert)
      console.log(`✅ ${result.uploaded} allegati caricati`);
    }

    // Notifica parent per aggiornare AttachmentPreview
    if (result.success && onUploadSuccess) {
      onUploadSuccess(questionId);
    }
  };

  const handleDroppedFiles = useCallback(async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const allImages = list.every((f) => (f.type || "").startsWith("image/"));
    if (allImages) {
      setPhotoEditQueue(list);
      return;
    }
    const result = await attachmentManager.addAttachments(
      questionId,
      "documenti",
      list,
      customItemId ? { customItemId } : {}
    );
    if (!result.success) {
      alert(`Errore: ${result.error}`);
      return;
    }
    if (result.partial) {
      alert(`Upload parziale:\n${result.uploaded} caricati\n${result.failed} falliti`);
    }
    if (result.success && onUploadSuccess) {
      onUploadSuccess(questionId);
    }
  }, [attachmentManager, questionId, customItemId, onUploadSuccess]);

  /** Input change per le foto (hidden input ref) -> apre l'editor opzionale */
  const handlePhotoInputChange = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    // Reset input per permettere di riselezionare lo stesso file
    e.target.value = "";
    if (!files.length) return;
    setPhotoEditQueue(files);
  }, []);

  /** PhotoEditModal: foto confermate (editate o originali) -> upload batch + compressione esistente */
  const handlePhotoEditConfirmAll = useCallback(async (editedFiles) => {
    setPhotoEditQueue(null);
    const result = await attachmentManager.addAttachments(
      questionId,
      "foto",
      editedFiles,
      customItemId ? { customItemId } : {}
    );

    if (!result.success) {
      alert(`❌ Errore: ${result.error}`);
      return;
    }
    if (result.partial) {
      alert(
        `⚠️ Upload parziale:\n✅ ${result.uploaded} caricati\n❌ ${result.failed} falliti`
      );
    } else {
      console.log(`✅ ${result.uploaded} foto caricate`);
    }
    if (result.success && onUploadSuccess) {
      onUploadSuccess(questionId);
    }
  }, [attachmentManager, questionId, customItemId, onUploadSuccess]);

  /** PhotoEditModal: annulla tutto -> non caricare nulla */
  const handlePhotoEditCancel = useCallback(() => {
    setPhotoEditQueue(null);
  }, []);

  /**
   * Handle attachment removal
   */
  const handleRemove = async (indexInFiltered) => {
    const attachment = questionAttachments[indexInFiltered];
    if (
      !window.confirm(
        `Rimuovere "${attachment.name}"?\n\n(Il file fisico rimarrà sul disco per tracciabilità)`
      )
    ) {
      return;
    }
    // Indice nella lista completa (removeAttachment usa listAttachments, non la lista filtrata)
    const indexInFull = allAttachments.findIndex(
      (a) => (a.storedName === attachment.storedName || a.name === attachment.name) &&
        (a.path === attachment.path || (a.size === attachment.size && !a.path && !attachment.path))
    );
    const result = await attachmentManager.removeAttachment(questionId, indexInFull >= 0 ? indexInFull : indexInFiltered);

    if (!result.success) {
      alert(`❌ Errore: ${result.error}`);
    }
  };

  /**
   * Format file size to human readable
   */
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Get icon for file type
   */
  const getFileIcon = (attachment) => {
    if (attachment.category === "foto") return "📷";
    if (attachment.type?.startsWith("application/pdf")) return "📄";
    if (
      attachment.type?.includes("word") ||
      attachment.name?.endsWith(".doc") ||
      attachment.name?.endsWith(".docx")
    )
      return "📝";
    if (
      attachment.type?.includes("excel") ||
      attachment.name?.endsWith(".xls") ||
      attachment.name?.endsWith(".xlsx")
    )
      return "📊";
    return "📎";
  };

  return (
    <div className="attachment-section">
      {/* Input nascosto per selezione foto (attivato da handleUpload "foto") */}
      <input
        ref={photoInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handlePhotoInputChange}
      />

      {/* Modal editing foto (aperto solo quando photoEditQueue != null) */}
      {photoEditQueue && (
        <PhotoEditModal
          files={photoEditQueue}
          onConfirmAll={handlePhotoEditConfirmAll}
          onCancel={handlePhotoEditCancel}
        />
      )}

      <FileDropzone
        multiple
        accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
        onFiles={handleDroppedFiles}
        hint="Foto, PDF, Word, Excel. Fotocamera: usa il menu sotto."
      />

      {/* Upload buttons con stats inline */}
      <div className="attachment-actions">
        <div className="upload-menu-wrapper">
          <button
            type="button"
            className="btn-upload primary"
            onClick={() => setShowUploadMenu(!showUploadMenu)}
          >
            ➕ Aggiungi Allegati
          </button>

          {showUploadMenu && (
            <div className="upload-menu">
              <button
                type="button"
                className="upload-option foto"
                onClick={() => handleUpload("foto", "gallery")}
              >
                📷 Foto (Gallery)
              </button>
              <button
                type="button"
                className="upload-option foto"
                onClick={() => handleUpload("foto", "camera")}
              >
                📸 Foto (Camera)
              </button>
              <button
                type="button"
                className="upload-option documenti"
                onClick={() => handleUpload("documenti")}
              >
                📎 Documenti
              </button>
              <button
                type="button"
                className="upload-option verbali"
                onClick={() => handleUpload("verbali")}
              >
                📄 Verbali
              </button>
            </div>
          )}
        </div>

        {/* Stats inline a destra (solo quando ci sono allegati) */}
        {questionAttachments.length > 0 && (
          <span className="attachment-stats-inline">
            {stats.count} file ({stats.totalSizeMB.toFixed(2)} MB) - Rimanenti:{" "}
            {stats.remaining}
          </span>
        )}
      </div>

      {/* Upload progress */}
      {attachmentManager.isUploading && attachmentManager.uploadProgress && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${
                  (attachmentManager.uploadProgress.current /
                    attachmentManager.uploadProgress.total) *
                  100
                }%`,
              }}
            />
          </div>
          <span className="progress-text">
            Caricamento {attachmentManager.uploadProgress.current} di{" "}
            {attachmentManager.uploadProgress.total}:{" "}
            {attachmentManager.uploadProgress.fileName}
          </span>
        </div>
      )}

      {/* Attachment list */}
      {questionAttachments.length > 0 && (
        <div className="attachment-list">
          {questionAttachments.map((attachment, index) => (
            <div
              key={index}
              className={`attachment-item ${attachment.category}`}
            >
              <div className="attachment-info">
                <span className="attachment-icon">
                  {getFileIcon(attachment)}
                </span>
                <div className="attachment-details">
                  <span
                    className="attachment-name"
                    title={attachment.storedName}
                  >
                    {attachment.name}
                    {attachment.pendingSync && (
                      <span
                        className="attachment-pending-badge"
                        title="In attesa di upload al server - verrà caricato al ripristino della connessione"
                      >
                        ⏳
                      </span>
                    )}
                  </span>
                  <span className="attachment-meta">
                    {formatSize(attachment.size)} |{" "}
                    {new Date(attachment.uploadDate).toLocaleDateString(
                      "it-IT"
                    )}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-remove"
                onClick={() => handleRemove(index)}
                title="Rimuovi allegato"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Limits info (collapsed) */}
      {questionAttachments.length === 0 && (
        <details className="limits-info">
          <summary>ℹ️ Limiti upload</summary>
          <ul>
            <li>
              Max {attachmentManager.limits.maxFilesPerQuestion} file per
              domanda
            </li>
            <li>
              Max{" "}
              {(attachmentManager.limits.maxFileSize / (1024 * 1024)).toFixed(
                0
              )}{" "}
              MB per file
            </li>
            <li>
              Max{" "}
              {(
                attachmentManager.limits.maxCumulativeSize /
                (1024 * 1024)
              ).toFixed(0)}{" "}
              MB cumulativi
            </li>
          </ul>
        </details>
      )}
    </div>
  );
}

export default AttachmentSection;
