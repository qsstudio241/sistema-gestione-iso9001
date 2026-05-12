/**
 * QuestionCard — Componente universale per domanda di checklist.
 *
 * Usato sia dalla checklist ISO standard (ChecklistModule) che dalla
 * checklist personalizzata (CustomChecklistAuditView).
 *
 * Props:
 *   question         {id, text, status, notes, questionId?, clauseRef?, displayOrder?}
 *   onStatusChange   (newStatus: string) => void
 *   onNotesChange    (newNotes: string) => void
 *   showStatusButtons bool (default true) — false nasconde i pulsanti C/NC/...
 *   displayRef       string — riferimento clausola (es. "4.1") o numero semplice
 *   checklistKey     string — usato per classe CSS del wrapper (es. "ISO_9001")
 *   attachmentManager  opzionale — da useAttachmentManager (standard ISO)
 *   auditId          number | null — audit_id numerico per AttachmentPreview
 *   children         React.ReactNode — slot per blocchi evidenza custom (custom checklist)
 */

import React, { useState } from "react";
import AttachmentSection from "./AttachmentSection";
import AttachmentPreview from "./AttachmentPreview";
import AutoTextarea from "./AutoTextarea";
import "./ChecklistModule.css";

const STATUS_BUTTONS = [
  { code: "C",   className: "compliant",       label: "Conforme" },
  { code: "NC",  className: "non-compliant",    label: "Non Conforme" },
  { code: "OSS", className: "partial",          label: "Osservazione" },
  { code: "OM",  className: "om",               label: "Opportunità di Miglioramento" },
  { code: "NA",  className: "not-applicable",   label: "Non Applicabile" },
  { code: "NV",  className: "not-verified",     label: "Non Verificato" },
];

export function QuestionCard({
  question,
  onStatusChange,
  onNotesChange,
  showStatusButtons = true,
  displayRef = "",
  checklistKey = "",
  attachmentManager = null,
  auditId = null,
  customItemId = null,
  readOnly = false,
  children,
}) {
  const [attachmentRefreshKey, setAttachmentRefreshKey] = useState(0);

  const cardClass = [
    "question-card",
    question.status ? `status-${question.status}` : "",
    checklistKey ? `standard-${checklistKey.toLowerCase().replace(/_/g, "-")}` : "",
    readOnly ? "readonly-mode" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cardClass}
      id={
        question.questionId   ? `question-${question.questionId}`
        : customItemId        ? `custom-item-${customItemId}`
        : undefined
      }
    >
      <div className="question-header">
        {displayRef && <span className="question-reference">{displayRef}</span>}
        <span className="question-text">{question.text}</span>
      </div>

      {showStatusButtons && (
        <div className="question-controls">
          <div className="status-buttons">
            {STATUS_BUTTONS.map(({ code, className, label }) => (
              <button
                key={code}
                type="button"
                className={`status-btn ${className}${question.status === code ? " active" : ""}`}
                onClick={() => onStatusChange?.(question.status === code ? null : code)}
                title={label}
                disabled={readOnly}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="question-details">
        <div className="question-field">
          <label className="field-label">📝 Note / Osservazioni</label>
          <AutoTextarea
            value={question.notes || ""}
            onChange={(e) => onNotesChange?.(e.target.value)}
            placeholder="Inserisci osservazioni, note e dettagli della verifica..."
            className="notes-textarea"
            disabled={readOnly}
          />
        </div>

        {/* Slot per contenuto extra (blocchi evidenza custom) */}
        {children}

        {/* Allegati upload */}
        {attachmentManager && (
          <AttachmentSection
            questionId={question.questionId || question.id}
            attachmentManager={attachmentManager}
            onUploadSuccess={() => setAttachmentRefreshKey((k) => k + 1)}
            customItemId={customItemId}
          />
        )}

        {/* Preview allegati già sul server (ISO: per questionId, custom: per customItemId) */}
        {auditId && (question.questionId || customItemId) && (
          <AttachmentPreview
            auditId={auditId}
            questionId={question.questionId || null}
            customItemId={customItemId}
            refreshKey={attachmentRefreshKey}
          />
        )}
      </div>
    </div>
  );
}

export default QuestionCard;
