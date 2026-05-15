import React, { useState, useCallback, useEffect } from "react";
import { useAiAssist } from "../hooks/useAiAssist";
import "./AiConclusionsModal.css";

const RECOMMENDATION_LABELS = {
  conforme: { label: "Conforme", icon: "?" },
  conforme_con_osservazioni: { label: "Conforme con osservazioni", icon: "??" },
  non_conforme: { label: "Non conforme", icon: "?" },
};

/**
 * Modal that shows AI-generated audit conclusions with Accept / Rephrase / Discard.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onAccept: (text: string) => void  — called when the user accepts the AI text
 *  - auditContext: { auditMetrics, standardCodes, findings, existingConclusions,
 *                    byStandardConclusions, auditObject, auditDescription }
 *  - standardKey: string | null — if multi-standard, which norm this modal is for
 */
export default function AiConclusionsModal({
  open,
  onClose,
  onAccept,
  auditContext,
  standardKey,
}) {
  const { suggest, loading, error, clear } = useAiAssist();
  const [result, setResult] = useState(null);

  const hasExisting = !!(
    (auditContext?.existingConclusions || "").trim() ||
    (standardKey && (auditContext?.byStandardConclusions?.[standardKey] || "").trim())
  );
  const mode = hasExisting ? "refine" : "generate";

  const runSuggestion = useCallback(async () => {
    setResult(null);
    const ctx = { ...auditContext, mode };
    if (standardKey && auditContext?.byStandardConclusions?.[standardKey]) {
      ctx.existingConclusions = auditContext.byStandardConclusions[standardKey];
    }
    const s = await suggest("audit_conclusions", ctx);
    if (s) setResult(s);
  }, [suggest, auditContext, standardKey, mode]);

  useEffect(() => {
    if (open) {
      clear();
      setResult(null);
      runSuggestion();
    }
  }, [open]);

  if (!open) return null;

  const recKey = result?.recommendation || "";
  const recInfo = RECOMMENDATION_LABELS[recKey];

  return (
    <div className="ai-conclusions-overlay" onClick={onClose}>
      <div
        className="ai-conclusions-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ai-conclusions-modal__header">
          <div className="ai-conclusions-modal__title">
            <span className="ai-icon">??</span>
            Assistente AI — Conclusioni
            {standardKey && (
              <span style={{ fontWeight: 400, fontSize: "0.85rem", color: "#777" }}>
                {" "}({standardKey.replace(/_/g, " ")})
              </span>
            )}
          </div>
          <button className="ai-conclusions-modal__close" onClick={onClose}>
            ?
          </button>
        </div>

        {/* Body */}
        <div className="ai-conclusions-modal__body">
          <span className={`ai-conclusions-modal__mode-tag ${mode}`}>
            {mode === "refine" ? "Migliora bozza" : "Genera proposta"}
          </span>

          {loading && (
            <div className="ai-conclusions-modal__loading">
              <div className="spinner" />
              <p>Analisi in corso...</p>
              <p style={{ fontSize: "0.78rem", color: "#999" }}>
                L'AI sta leggendo le risposte dell'audit
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="ai-conclusions-modal__error">{error}</div>
          )}

          {result && !loading && (
            <>
              {recInfo && (
                <div className={`ai-conclusions-modal__recommendation ${recKey}`}>
                  {recInfo.icon} {recInfo.label}
                </div>
              )}
              <div className="ai-conclusions-modal__text">
                {result.conclusion_text || result.raw || "Nessun testo generato"}
              </div>
              {result.key_findings_summary && (
                <div className="ai-conclusions-modal__key-findings">
                  {result.key_findings_summary}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="ai-conclusions-modal__footer">
          <button
            className="ai-conclusions-modal__btn discard"
            onClick={onClose}
            disabled={loading}
          >
            Scarta
          </button>
          <button
            className="ai-conclusions-modal__btn rephrase"
            onClick={runSuggestion}
            disabled={loading}
          >
            {loading ? "..." : "Riformula"}
          </button>
          <button
            className="ai-conclusions-modal__btn accept"
            onClick={() => {
              if (result?.conclusion_text) {
                onAccept(result.conclusion_text);
              }
              onClose();
            }}
            disabled={loading || !result?.conclusion_text}
          >
            Accetta
          </button>
        </div>
      </div>
    </div>
  );
}
