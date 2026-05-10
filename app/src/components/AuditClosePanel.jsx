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
import { STANDARD_TO_SUBSID, getSelectedStandardEntries } from "../data/standardsRegistry";
import { useGuidedCompletion } from "../hooks/useGuidedCompletion";
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

function AuditClosePanel({ currentAudit, onCompleted, onNavigateTo }) {
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

  // Mappa standard → subsId accordion: importata da `data/standardsRegistry.js`
  // (ADR-009 Fase 1). Aggiungere uno standard al registry aggiorna in
  // automatico la guided close senza modifiche qui.

  // Trova il primo item custom senza status: ritorna il customItemId o null
  function getFirstUnansweredCustomItem(audit) {
    const sections = audit?.customChecklist?.sections || [];
    const statuses = audit?.customStatuses || {};
    for (const sec of sections) {
      for (const item of (sec.items || [])) {
        const s = statuses[item.id];
        if (!s || s === "NOT_ANSWERED") return item.id;
      }
    }
    return null;
  }

  // Trova la prima domanda non risposta: ritorna { subsId, fieldId }
  function getFirstUnansweredTarget(checklist) {
    for (const [normKey, normData] of Object.entries(checklist || {})) {
      if (!normData || typeof normData !== "object") continue;
      for (const clause of Object.values(normData)) {
        for (const q of (clause?.questions || [])) {
          if (!q.status || q.status === "NOT_ANSWERED") {
            const subsId = STANDARD_TO_SUBSID[normKey] ?? null;
            const fieldId = q.questionId ? `question-${q.questionId}` : null;
            return { subsId, fieldId };
          }
        }
      }
    }
    return { subsId: null, fieldId: null };
  }

  // ─── Descrittori campi obbligatori (fonte unica, riusabile via useGuidedCompletion) ──
  const gd = currentAudit?.metadata?.generalData    || {};
  const ao = currentAudit?.metadata?.auditObjective || {};
  const oc = currentAudit?.metadata?.auditOutcome   || {};
  const selectedStandards = currentAudit?.metadata?.selectedStandards || [];
  const standardEntries   = getSelectedStandardEntries(selectedStandards);
  const isMultiStandard   = standardEntries.length > 1;

  const hasIsoChecklistForGuide = Object.keys(currentAudit?.checklist || {}).length > 0;
  const checklistPct = hasIsoChecklistForGuide ? calcCompletion(currentAudit.checklist) : 100;

  const hasCustomChecklist = !!(currentAudit?.customChecklist || currentAudit?.metadata?.customChecklistId);
  const customStatuses    = currentAudit?.customStatuses || {};
  const customTotal       = Object.keys(customStatuses).length;
  const customAnswered    = Object.values(customStatuses).filter((s) => s && s !== "NOT_ANSWERED").length;
  const customPct         = customTotal > 0 ? Math.round((customAnswered / customTotal) * 100) : 0;

  // Target dinamico per checklist ISO (prima domanda non risposta)
  const firstUnanswered = (hasIsoChecklistForGuide && checklistPct < COMPLETION_THRESHOLD)
    ? getFirstUnansweredTarget(currentAudit?.checklist) : { subsId: null, fieldId: null };

  const fieldDescriptors = [
    {
      id: "auditObject", text: "Oggetto dell'audit", isMissing: !gd.auditObject?.trim(),
      fieldId: "field-auditObject",
      path: [{ type: "section", key: "general-data" }, { type: "subsection", key: "general-data-form" }],
    },
    {
      id: "scope", text: "Campo di applicazione", isMissing: !gd.scope?.trim(),
      fieldId: "field-scope",
      path: [{ type: "section", key: "general-data" }, { type: "subsection", key: "general-data-form" }],
    },
    {
      id: "auditDescription", text: "Obiettivo dell'audit", isMissing: !ao.description?.trim(),
      fieldId: "field-auditDescription",
      path: [{ type: "section", key: "general-data" }, { type: "subsection", key: "objective" }],
    },
    // Conclusioni: per multi-standard una voce per norma, per singolo una voce unica
    ...(isMultiStandard
      ? standardEntries.map(({ key, shortLabel }) => ({
          id: `conclusions-${key}`,
          text: `Conclusioni ${shortLabel} (Sezione 12)`,
          isMissing: !oc.byStandard?.[key]?.conclusions?.trim(),
          fieldId: `conclusions-${key}`,
          path: [{ type: "section", key: "conclusions" }],
        }))
      : [{
          id: "conclusions", text: "Conclusioni (Sezione 12)", isMissing: !oc.conclusions?.trim(),
          fieldId: "conclusions",
          path: [{ type: "section", key: "conclusions" }],
        }]
    ),
    {
      id: "checklistPct",
      text: `Checklist al ${checklistPct}% (minimo ${COMPLETION_THRESHOLD}%)`,
      isMissing: hasIsoChecklistForGuide && checklistPct < COMPLETION_THRESHOLD,
      fieldId: firstUnanswered.fieldId,
      path: [
        { type: "section",      key: "checklist" },
        { type: "subsection",   key: firstUnanswered.subsId },
        { type: "clauseExpand" },               // apre tutte le clausole del ChecklistModule
      ].filter((s) => !(s.type === "subsection" && !s.key)),
    },
    {
      id: "customChecklistPct",
      text: customTotal === 0 ? "Nessuna risposta nella checklist personalizzata" : `Checklist personalizzata al ${customPct}% (minimo ${COMPLETION_THRESHOLD}%)`,
      isMissing: hasCustomChecklist && (customTotal === 0 || customPct < COMPLETION_THRESHOLD),
      fieldId: (() => {
        if (!(hasCustomChecklist && (customTotal === 0 || customPct < COMPLETION_THRESHOLD))) return null;
        const itemId = getFirstUnansweredCustomItem(currentAudit);
        return itemId ? `custom-item-${itemId}` : "sgq-subsection-custom-checklist";
      })(),
      path: [{ type: "section", key: "checklist" }, { type: "subsection", key: "custom-checklist" }],
    },
  ];

  const { missingFields, currentIndex, navigateToFirst, navigateToNext } =
    useGuidedCompletion(fieldDescriptors, onNavigateTo);

  // ─── Warnings e metriche (solo informativi, non bloccanti) ─────────────────
  const warnings = useMemo(() => {
    const ws = [];
    const isoMetrics  = calculateFindingsMetrics(currentAudit?.checklist);
    const customMetrics = currentAudit?.customChecklist?.has_outcome_buttons
      ? calculateCustomFindingsMetrics(currentAudit.customStatuses)
      : { totalNC: 0 };
    const totalNC = isoMetrics.totalNC + customMetrics.totalNC;
    if (totalNC > 0)
      ws.push(`${totalNC} Non Conformità rilevate — verificare note e azioni correttive`);
    return ws;
  }, [currentAudit]);

  const canClose = missingFields.length === 0;
  const completionPct = hasIsoChecklistForGuide ? checklistPct : null;

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
      <p className="close-panel__subtitle">
        Verifica i requisiti prima di chiudere. Dopo la chiusura l'audit sarà in sola lettura.
      </p>

      {/* Barra completamento checklist */}
      {completionPct !== null && (
        <div className="close-completion">
          <div className="close-completion__label">
            <span>Completamento checklist</span>
            <strong className={completionPct >= COMPLETION_THRESHOLD ? "ok" : "fail"}>
              {completionPct}%
            </strong>
          </div>
          <div className="close-completion__bar">
            <div
              className={`close-completion__fill ${completionPct >= COMPLETION_THRESHOLD ? "ok" : "fail"}`}
              style={{ width: `${Math.min(completionPct, 100)}%` }}
            />
            <div
              className="close-completion__threshold"
              style={{ left: `${COMPLETION_THRESHOLD}%` }}
              title={`Soglia minima: ${COMPLETION_THRESHOLD}%`}
            />
          </div>
        </div>
      )}

      {/* Campi obbligatori mancanti — lista semplice, navigazione via pulsante principale */}
      {missingFields.length > 0 && (
        <div className="close-checklist close-checklist--blockers">
          <h4>❌ Campi obbligatori mancanti</h4>
          <ul>
            {missingFields.map((f, i) => (
              <li key={f.id} className={`blocker-item ${i === currentIndex ? "blocker-item--current" : ""}`}>
                <span className="blocker-icon">❌</span>
                <span className="blocker-text">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings non bloccanti */}
      {warnings.length > 0 && (
        <div className="close-checklist close-checklist--warnings">
          <h4>⚠️ Attenzione (non bloccante)</h4>
          <ul>
            {warnings.map((w, i) => (
              <li key={i} className="warning-item">
                <span className="warning-icon">!</span> {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tutto OK */}
      {canClose && warnings.length === 0 && (
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
                onClick={currentIndex === 0 ? navigateToFirst : navigateToNext}
              >
                📍 {currentIndex === 0
                  ? `Vai al primo campo da completare (${missingFields.length})`
                  : `Vai al campo ${currentIndex + 1} di ${missingFields.length} →`}
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
