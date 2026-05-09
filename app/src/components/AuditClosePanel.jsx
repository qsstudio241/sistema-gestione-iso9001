/**
 * AuditClosePanel - Pannello chiusura formale audit
 *
 * Mostra checklist pre-chiusura, validazione guidata e pulsante "Chiudi Audit".
 * Dopo la chiusura l'audit diventa read-only (soft-lock).
 * Da stato "completed" e' disponibile anche il pulsante "Approva".
 *
 * Sistema Gestione ISO 9001 - QS Studio
 */
import React, { useState, useMemo } from "react";
import apiService from "../services/apiService";
import { useStorage } from "../contexts/StorageContext";
import { calculateFindingsMetrics, calculateCustomFindingsMetrics } from "../utils/metricsCalculator";
import "./AuditClosePanel.css";

/** Soglia minima completamento checklist per poter chiudere (%) */
const COMPLETION_THRESHOLD = 80;

function calcCompletion(checklist) {
  if (!checklist || typeof checklist !== "object") return 0;
  let total = 0;
  let answered = 0;
  Object.values(checklist).forEach((norm) => {
    if (!norm || typeof norm !== "object") return;
    Object.values(norm).forEach((clause) => {
      (clause?.questions || []).forEach((q) => {
        total++;
        if (q.status && q.status !== "NOT_ANSWERED") answered++;
      });
    });
  });
  return total === 0 ? 0 : Math.round((answered / total) * 100);
}

function AuditClosePanel({ currentAudit, onCompleted }) {
  const { updateCurrentAudit } = useStorage();

  // Stato chiusura
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  // Stato approvazione
  const [approving, setApproving]         = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError]   = useState(null);

  const status = currentAudit?.metadata?.status || "draft";
  const isAlreadyClosed = ["completed", "approved", "archived"].includes(status);

  // ─── Navigazione guidata ai campi mancanti ──────────────────────────────────
  function navigateTo(sectionId, fieldId) {
    window.dispatchEvent(
      new CustomEvent("sgq:openAndScrollToSection", { detail: { sectionId, fieldId } })
    );
  }

  // ─── Validazioni pre-chiusura ───────────────────────────────────────────────
  const validation = useMemo(() => {
    // Ogni blocker ha: text, sectionId, fieldId (per navigazione guidata)
    const blockers = [];
    const warnings = [];

    const gd = currentAudit?.metadata?.generalData || {};
    const ao = currentAudit?.metadata?.auditObjective || {};
    const oc = currentAudit?.metadata?.auditOutcome || {};

    if (!gd.auditObject?.trim())
      blockers.push({ text: "Oggetto dell'audit mancante", sectionId: "general-data", fieldId: "field-auditObject" });
    if (!gd.scope?.trim())
      blockers.push({ text: "Campo di applicazione mancante", sectionId: "general-data", fieldId: "field-scope" });
    if (!ao.description?.trim())
      blockers.push({ text: "Obiettivo dell'audit mancante", sectionId: "general-data", fieldId: "field-auditDescription" });
    if (!oc.conclusions?.trim())
      blockers.push({ text: "Conclusioni mancanti (Sezione 12)", sectionId: "conclusions", fieldId: "conclusions" });

    const hasIsoChecklist = Object.keys(currentAudit?.checklist || {}).length > 0;
    if (hasIsoChecklist) {
      const pct = calcCompletion(currentAudit.checklist);
      if (pct < COMPLETION_THRESHOLD) {
        blockers.push({
          text: `Checklist completata al ${pct}% (minimo ${COMPLETION_THRESHOLD}%)`,
          sectionId: "checklist",
          fieldId: null,
        });
      }
    }

    const hasCustomChecklist = !!(currentAudit?.customChecklist || currentAudit?.metadata?.customChecklistId);
    if (hasCustomChecklist && !hasIsoChecklist) {
      const customStatuses = currentAudit?.customStatuses || {};
      const customTotal = Object.keys(customStatuses).length;
      const customAnswered = Object.values(customStatuses).filter((s) => s && s !== 'NOT_ANSWERED').length;
      if (customTotal === 0) {
        blockers.push({ text: "Nessuna risposta nella checklist personalizzata", sectionId: "checklist", fieldId: null });
      } else {
        const customPct = Math.round((customAnswered / customTotal) * 100);
        if (customPct < COMPLETION_THRESHOLD) {
          blockers.push({
            text: `Checklist personalizzata al ${customPct}% (minimo ${COMPLETION_THRESHOLD}%)`,
            sectionId: "checklist",
            fieldId: null,
          });
        }
      }
    }

    const isoMetrics = calculateFindingsMetrics(currentAudit?.checklist);
    const customMetrics = currentAudit?.customChecklist?.has_outcome_buttons
      ? calculateCustomFindingsMetrics(currentAudit.customStatuses)
      : { totalNC: 0, totalOSS: 0, totalOM: 0 };
    const metrics = {
      totalNC:  isoMetrics.totalNC  + customMetrics.totalNC,
      totalOSS: isoMetrics.totalOSS + customMetrics.totalOSS,
      totalOM:  isoMetrics.totalOM  + customMetrics.totalOM,
    };

    if (metrics.totalNC > 0) {
      warnings.push(
        `${metrics.totalNC} Non Conformit\u00e0 rilevate \u2014 verificare note e azioni correttive`
      );
    }

    return {
      blockers,
      warnings,
      completion: hasIsoChecklist ? calcCompletion(currentAudit.checklist) : null,
      metrics,
    };
  }, [currentAudit]);

  const canClose = validation.blockers.length === 0;

  // ─── Chiusura ────────────────────────────────────────────────────────────────
  async function handleConfirmClose() {
    setLoading(true);
    setError(null);
    try {
      const auditId = currentAudit?.metadata?.auditId ?? currentAudit?.audit_id;
      const uuid    = currentAudit?.metadata?.id      ?? currentAudit?.id;
      if (!auditId && !uuid) throw new Error("ID audit non disponibile");

      await apiService.completeAudit(auditId || uuid);

      updateCurrentAudit((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          status: "completed",
          completedAt: new Date().toISOString(),
        },
      }));
      onCompleted?.();
      setConfirming(false);
    } catch (err) {
      setError(err?.message || "Errore durante la chiusura dell'audit. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Approvazione ────────────────────────────────────────────────────────────
  async function handleApprove() {
    setApproveLoading(true);
    setApproveError(null);
    try {
      const auditId = currentAudit?.metadata?.auditId ?? currentAudit?.audit_id;
      const uuid    = currentAudit?.metadata?.id      ?? currentAudit?.id;
      await apiService.approveAudit(auditId || uuid);
      updateCurrentAudit((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          status: "approved",
          approvedAt: new Date().toISOString(),
        },
      }));
      setApproving(false);
    } catch (err) {
      setApproveError(err?.message || "Errore durante l'approvazione.");
    } finally {
      setApproveLoading(false);
    }
  }

  // ─── Render: audit già chiuso ────────────────────────────────────────────────
  if (isAlreadyClosed) {
    const statusLabels = {
      completed: { label: "COMPLETATO", cls: "completed" },
      approved:  { label: "APPROVATO",  cls: "approved"  },
      archived:  { label: "ARCHIVIATO", cls: "archived"  },
    };
    const s = statusLabels[status] || { label: status.toUpperCase(), cls: "" };

    return (
      <div className="close-panel close-panel--done">
        <div className={`close-done-badge badge-${s.cls}`}>
          {status === "completed" && "✅ "}
          {status === "approved"  && "✅ "}
          {status === "archived"  && "📁 "}Audit {s.label}
        </div>

        {currentAudit?.metadata?.completedAt && (
          <p className="close-done-date">
            Chiuso il{" "}
            {new Date(currentAudit.metadata.completedAt).toLocaleDateString("it-IT", {
              day: "2-digit", month: "long", year: "numeric",
            })}
          </p>
        )}
        {currentAudit?.metadata?.approvedAt && (
          <p className="close-done-date">
            Approvato il{" "}
            {new Date(currentAudit.metadata.approvedAt).toLocaleDateString("it-IT", {
              day: "2-digit", month: "long", year: "numeric",
            })}
          </p>
        )}

        {/* Pulsante Approva � solo da completed, per ruolo responsabile/admin */}
        {status === "completed" && !approving && (
          <button
            className="close-btn close-btn--approve"
            style={{ marginTop: "16px" }}
            onClick={() => setApproving(true)}
          >
            ✅ Approva Audit
          </button>
        )}

        {status === "completed" && approving && (
          <div className="close-confirm" style={{ marginTop: "16px", textAlign: "left" }}>
            <p className="close-confirm__text">
              <strong>Confermi l'approvazione?</strong>
              <br />
              L'audit sara' definitivamente bloccato e non potra' essere modificato.
            </p>
            {approveError && <div className="close-api-error">⚠️ {approveError}</div>}
            <div className="close-confirm__actions">
              <button
                className="close-btn close-btn--approve"
                disabled={approveLoading}
                onClick={handleApprove}
              >
                {approveLoading ? "Approvazione..." : "✅ Sì, approva"}
              </button>
              <button
                className="close-btn close-btn--secondary"
                disabled={approveLoading}
                onClick={() => { setApproving(false); setApproveError(null); }}
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {status !== "approved" && !approving && (
          <p className="close-done-hint" style={{ marginTop: "12px" }}>
            L'audit e' in sola lettura. Per modifiche contatta il responsabile.
          </p>
        )}
        {status === "approved" && (
          <p className="close-done-hint" style={{ marginTop: "12px" }}>
            Audit approvato � nessuna modifica consentita.
          </p>
        )}
      </div>
    );
  }

  // ─── Render: pannello pre-chiusura ─────────────────────────────────────────
  return (
    <div className="close-panel">
      <div className="close-panel__header">
        <h3>🔒 Chiusura Audit</h3>
        <p className="close-panel__subtitle">
          Verifica i requisiti prima di chiudere formalmente l'audit.
          Dopo la chiusura l'audit sara' in sola lettura.
        </p>
      </div>

      {/* Barra completamento checklist */}
      {validation.completion !== null && (
        <div className="close-completion">
          <div className="close-completion__label">
            <span>Completamento checklist</span>
            <strong className={validation.completion >= COMPLETION_THRESHOLD ? "ok" : "fail"}>
              {validation.completion}%
            </strong>
          </div>
          <div className="close-completion__bar">
            <div
              className={`close-completion__fill ${
                validation.completion >= COMPLETION_THRESHOLD ? "ok" : "fail"
              }`}
              style={{ width: `${Math.min(validation.completion, 100)}%` }}
            />
            <div
              className="close-completion__threshold"
              style={{ left: `${COMPLETION_THRESHOLD}%` }}
              title={`Soglia minima: ${COMPLETION_THRESHOLD}%`}
            />
          </div>
        </div>
      )}

      {/* Blockers con navigazione guidata */}
      {validation.blockers.length > 0 && (
        <div className="close-checklist close-checklist--blockers">
          <h4>❌ Campi obbligatori mancanti</h4>
          <ul>
            {validation.blockers.map((b, i) => (
              <li key={i} className="blocker-item">
                <span className="blocker-icon">❌</span>
                <span className="blocker-text">{b.text}</span>
                <button
                  className="blocker-goto-btn"
                  title="Vai al campo"
                  onClick={() => navigateTo(b.sectionId, b.fieldId)}
                >
                  Vai →
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className="close-checklist close-checklist--warnings">
          <h4>⚠️ Attenzione (non bloccante)</h4>
          <ul>
            {validation.warnings.map((w, i) => (
              <li key={i} className="warning-item">
                <span className="warning-icon">!</span> {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tutto OK */}
      {canClose && validation.warnings.length === 0 && (
        <div className="close-checklist close-checklist--ok">
          <h4>✅ Audit pronto per la chiusura</h4>
          <p>Tutti i requisiti obbligatori sono soddisfatti.</p>
        </div>
      )}

      {error && <div className="close-api-error">⚠️ {error}</div>}

      {/* Azioni */}
      {!confirming ? (
        <div className="close-actions">
          {canClose ? (
            <button
              className="close-btn close-btn--primary"
              disabled={loading}
              onClick={() => setConfirming(true)}
            >
              🔒 Chiudi Audit
            </button>
          ) : (
            <>
              <button
                className="close-btn close-btn--navigate"
                onClick={() => {
                  const first = validation.blockers[0];
                  if (first) navigateTo(first.sectionId, first.fieldId);
                }}
              >
                📍 Vai al primo campo da completare ({validation.blockers.length})
              </button>
              <button
                className="close-btn close-btn--force"
                onClick={() => setConfirming(true)}
                title="Forza chiusura anche con campi mancanti"
              >
                Chiudi comunque →
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="close-confirm">
          <p className="close-confirm__text">
            <strong>Confermi la chiusura dell'audit?</strong>
            <br />
            Questa operazione non puo' essere annullata senza il supporto del responsabile.
          </p>
          <div className="close-confirm__actions">
            <button
              className="close-btn close-btn--danger"
              disabled={loading}
              onClick={handleConfirmClose}
            >
              {loading ? "Chiusura in corso..." : "✓ Sì, chiudi audit"}
            </button>
            <button
              className="close-btn close-btn--secondary"
              disabled={loading}
              onClick={() => { setConfirming(false); setError(null); }}
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditClosePanel;
