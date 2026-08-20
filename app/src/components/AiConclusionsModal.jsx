import React, { useState, useCallback, useEffect, useRef } from "react";
import { useAiAssist } from "../hooks/useAiAssist";
import apiService from "../services/apiService";
import AiDisclaimer from "./AiDisclaimer";
import "./AiConclusionsModal.css";

const RECOMMENDATION_LABELS = {
  conforme: { label: "Conforme", icon: "\u2705" },
  conforme_con_osservazioni: { label: "Conforme con osservazioni", icon: "\u26A0\uFE0F" },
  non_conforme: { label: "Non conforme", icon: "\u274C" },
};

/**
 * Modal that shows AI-generated audit conclusions with Accept / Rephrase / Discard.
 * Sends feedback to /ai/feedback for personalization learning (Level B).
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onAccept: (text: string) => void
 *  - auditContext: { auditMetrics, standardCodes, findings, existingConclusions,
 *                    byStandardConclusions, auditObject, auditDescription }
 *  - standardKey: string | null
 *  - auditId: string | null
 */
export default function AiConclusionsModal({
  open,
  onClose,
  onAccept,
  auditContext,
  standardKey,
  auditId,
}) {
  const { suggest, loading, error, clear } = useAiAssist();
  const [result, setResult] = useState(null);
  const [editedText, setEditedText] = useState("");
  const metaRef = useRef(null);

  const applySuggestion = useCallback((s) => {
    if (!s) return;
    setResult(s);
    setEditedText(s.conclusion_text || s.raw || "");
  }, []);

  const hasExisting = !!(
    (auditContext?.existingConclusions || "").trim() ||
    (standardKey && (auditContext?.byStandardConclusions?.[standardKey] || "").trim())
  );
  const mode = hasExisting ? "refine" : "generate";

  const sendFeedback = useCallback((action, finalText) => {
    if (!result?.conclusion_text) return;
    apiService.aiFeedback({
      feature: "audit_conclusions",
      action,
      aiText: result.conclusion_text,
      finalText: finalText || null,
      recommendation: result.recommendation || null,
      auditId: auditId || null,
      contextSummary: metaRef.current?.contextSummary || null,
      modelUsed: metaRef.current?.model || null,
    }).catch(() => {});
  }, [result, auditId]);

  const runSuggestion = useCallback(async () => {
    if (result) {
      sendFeedback("rejected", null);
    }
    setResult(null);
    setEditedText("");
    metaRef.current = null;
    const ctx = { ...auditContext, mode };
    if (standardKey && auditContext?.byStandardConclusions?.[standardKey]) {
      ctx.existingConclusions = auditContext.byStandardConclusions[standardKey];
    }
    const s = await suggest("audit_conclusions", ctx);
    applySuggestion(s);
  }, [suggest, auditContext, standardKey, mode, result, sendFeedback, applySuggestion]);

  useEffect(() => {
    if (open) {
      clear();
      setResult(null);
      setEditedText("");
      metaRef.current = null;
      const ctx = { ...auditContext, mode };
      if (standardKey && auditContext?.byStandardConclusions?.[standardKey]) {
        ctx.existingConclusions = auditContext.byStandardConclusions[standardKey];
      }
      suggest("audit_conclusions", ctx).then(applySuggestion);
    }
  }, [open]);

  if (!open) return null;

  const recKey = result?.recommendation || "";
  const recInfo = RECOMMENDATION_LABELS[recKey];

  const handleAccept = () => {
    const text = editedText.trim();
    if (text) {
      sendFeedback("accepted", text);
      onAccept(text);
    }
    onClose();
  };

  const handleDiscard = () => {
    sendFeedback("rejected", null);
    onClose();
  };

  return (
    <div className="ai-conclusions-overlay" onClick={handleDiscard}>
      <div
        className="ai-conclusions-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ai-conclusions-modal__header">
          <div className="ai-conclusions-modal__title">
            <span className="ai-icon">{"\uD83E\uDD16"}</span>
            Assistente AI &mdash; Conclusioni
            {standardKey && (
              <span style={{ fontWeight: 400, fontSize: "0.85rem", color: "#777" }}>
                {" "}({standardKey.replace(/_/g, " ")})
              </span>
            )}
          </div>
          <button className="ai-conclusions-modal__close" onClick={handleDiscard}>
            {"\u2715"}
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
                L&apos;AI sta leggendo le risposte dell&apos;audit
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
              <p className="ai-conclusions-modal__edit-hint">
                Puoi modificare il testo prima di accettare
              </p>
              <textarea
                className="ai-conclusions-modal__text"
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={10}
                aria-label="Testo proposto dall'assistente AI, modificabile"
                placeholder="Nessun testo generato"
              />
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
            onClick={handleDiscard}
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
            onClick={handleAccept}
            disabled={loading || !editedText.trim()}
          >
            Accetta
          </button>
        </div>
        <AiDisclaimer style={{ marginTop: '0.75rem' }} />
      </div>
    </div>
  );
}
