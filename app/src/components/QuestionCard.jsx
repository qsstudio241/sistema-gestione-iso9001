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
  showSatButton = false,
  satisfiedBy = null,
  onSatisfiedByChange = null,
  children,
}) {
  const [attachmentRefreshKey, setAttachmentRefreshKey] = useState(0);
  const [satExpanded, setSatExpanded] = useState(false);

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
        {/* SAT — Soddisfatto dal SGQ (solo audit iso_process con azienda che ha certificazione HLS) */}
        {showSatButton && (
          <div className="sat-bridge">
            <button
              type="button"
              className={`sat-bridge__btn${satisfiedBy?.standard ? " sat-bridge__btn--active" : ""}`}
              onClick={() => {
                if (readOnly) return;
                if (satisfiedBy?.standard) {
                  onSatisfiedByChange?.({ standard: null, clause: null, doc_ref: null });
                } else {
                  setSatExpanded(e => !e);
                }
              }}
              disabled={readOnly}
              title="Requisito soddisfatto dal Sistema di Gestione Qualita' (es. ISO 9001)"
            >
              {satisfiedBy?.standard ? `SAT ${satisfiedBy.standard}` : "SAT"}
            </button>
            {satExpanded && !satisfiedBy?.standard && (
              <div className="sat-bridge__form">
                <select
                  className="sat-bridge__select"
                  value=""
                  onChange={(e) => {
                    const std = e.target.value;
                    if (std) {
                      onSatisfiedByChange?.({ standard: std, clause: "", doc_ref: "" });
                      setSatExpanded(false);
                    }
                  }}
                >
                  <option value="">Seleziona norma di riferimento...</option>
                  <option value="ISO_9001">ISO 9001 — SGQ</option>
                  <option value="ISO_14001">ISO 14001 — Ambiente</option>
                  <option value="ISO_45001">ISO 45001 — Sicurezza</option>
                </select>
              </div>
            )}
            {satisfiedBy?.standard && (
              <div className="sat-bridge__details">
                <input
                  type="text"
                  className="sat-bridge__input"
                  placeholder="Clausola (es. 7.1.5)"
                  value={satisfiedBy.clause || ""}
                  onChange={(e) => onSatisfiedByChange?.({ ...satisfiedBy, clause: e.target.value })}
                  disabled={readOnly}
                />
                <input
                  type="text"
                  className="sat-bridge__input"
                  placeholder="Doc. di riferimento (es. PG-01 rev.3)"
                  value={satisfiedBy.doc_ref || ""}
                  onChange={(e) => onSatisfiedByChange?.({ ...satisfiedBy, doc_ref: e.target.value })}
                  disabled={readOnly}
                />
              </div>
            )}
          </div>
        )}

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
