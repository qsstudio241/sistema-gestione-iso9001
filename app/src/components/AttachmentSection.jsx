/**
 * AttachmentSection.jsx
 *
 * Sezione allegati per domande checklist audit ISO 9001.
 * Gestisce upload foto, documenti e verbali con preview e rimozione.
 *
 * Props:
 * - questionId: ID domanda (es. "4.1", "7.5.3")
 * - attachmentManager: Hook useAttachmentManager
 */

import React, { useState } from "react";
import "./AttachmentSection.css";

function AttachmentSection({ questionId, attachmentManager }) {
  const [showUploadMenu, setShowUploadMenu] = useState(false);

  // Get attachments for this question
  const questionAttachments = attachmentManager.listAttachments(questionId);
  const stats = attachmentManager.getStats(questionId);

  /**
   * Handle file upload for specific category
   */
  const handleUpload = async (category, source = "gallery") => {
    setShowUploadMenu(false);

    const result = await attachmentManager.openFilePicker(
      questionId,
      category,
      source
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
  };

  /**
   * Handle attachment removal
   */
  const handleRemove = async (index) => {
    const attachment = questionAttachments[index];
    if (
      !window.confirm(
        `Rimuovere "${attachment.name}"?\n\n(Il file fisico rimarrà sul disco per tracciabilità)`
      )
    ) {
      return;
    }

    const result = await attachmentManager.removeAttachment(questionId, index);

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
            {stats.count} file ({stats.totalSizeMB} MB) - Rimanenti:{" "}
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
                  </span>
                  <span className="attachment-meta">
                    {formatSize(attachment.size)} •{" "}
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
