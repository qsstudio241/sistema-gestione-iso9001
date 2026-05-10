/**
 * AuditClosePanel - Pannello chiusura formale audit
 *
 * Mostra checklist pre-chiusura, validazione guidata e pulsante "Chiudi Audit".
 * Dopo la chiusura l'audit diventa read-only (soft-lock).
 * Da stato "completed" e' disponibile anche il pulsante "Approva".
 *
 * Sistema Gestione ISO 9001 - QS Studio
 */
import React, { useState, useMemo, useEffect, useRef } from "react";
import apiService from "../services/apiService";
import { useStorage } from "../contexts/StorageContext";
import { useAuth } from "../contexts/AuthContext";
import { calculateFindingsMetrics, calculateCustomFindingsMetrics } from "../utils/metricsCalculator";
import { STANDARD_TO_SUBSID, getSelectedStandardEntries } from "../data/standardsRegistry";
import { useGuidedCompletion } from "../hooks/useGuidedCompletion";
import "./AuditClosePanel.css";

/** Finestra di grazia (secondi) per annullare il trasferimento delle NC al modulo organizzativo. */
const NC_PUSH_UNDO_SECONDS = 10;

/** Tutti i punti norma devono essere valutati (anche NA/NV contano come risposta) */
const COMPLETION_THRESHOLD = 100;

function calcNormCompletion(normData) {
  if (!normData || typeof normData !== "object") return 0;
  let total = 0, answered = 0;
  Object.values(normData).forEach((clause) => {
    (clause?.questions || []).forEach((q) => {
      total++;
      if (q.status && q.status !== "NOT_ANSWERED") answered++;
    });
  });
  return total === 0 ? 0 : Math.round((answered / total) * 100);
}

function calcCompletion(checklist) {
  if (!checklist || typeof checklist !== "object") return 0;
  let total = 0, answered = 0;
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
  const { hasLicensedModule } = useAuth();

  // Stato chiusura
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  // Stato approvazione
  const [approving, setApproving]         = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError]   = useState(null);

  // Stato push NC verso modulo organizzativo (solo con licenza 'nc')
  // Fasi: idle -> pushing -> pushed (con countdown undo) -> finalized / undone
  const [ncPushState, setNcPushState] = useState({
    phase: "idle", // 'idle' | 'pushing' | 'pushed' | 'undoing' | 'finalized' | 'undone' | 'error'
    countdown: 0,
    summary: null, // { created_count, skipped_count, total_findings }
    error: null,
  });
  const ncPushTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (ncPushTimerRef.current) clearInterval(ncPushTimerRef.current);
    };
  }, []);

  const hasNcLicense = hasLicensedModule("nc");

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

  // Completamento per-norma (usato per barre multi-standard e fieldDescriptors)
  const normCompletions = standardEntries.map(({ key, shortLabel, label }) => {
    const normData = currentAudit?.checklist?.[key];
    const pct = normData ? calcNormCompletion(normData) : 0;
    const hasDomande = normData && Object.values(normData).some(c => (c?.questions?.length ?? 0) > 0);
    const firstUnansweredNorm = (hasDomande && pct < COMPLETION_THRESHOLD)
      ? getFirstUnansweredTarget({ [key]: normData })
      : { subsId: null, fieldId: null };
    return { key, shortLabel, label, pct, hasDomande, firstUnansweredNorm };
  });

  const hasCustomChecklist = !!(currentAudit?.customChecklist || currentAudit?.metadata?.customChecklistId);
  const customStatuses    = currentAudit?.customStatuses || {};
  const customTotal       = Object.keys(customStatuses).length;
  const customAnswered    = Object.values(customStatuses).filter((s) => s && s !== "NOT_ANSWERED").length;
  const customPct         = customTotal > 0 ? Math.round((customAnswered / customTotal) * 100) : 0;

  // Per audit mono-standard: target dinamico legacy
  const firstUnanswered = (!isMultiStandard && hasIsoChecklistForGuide && checklistPct < COMPLETION_THRESHOLD)
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
    // Completamento per-norma (multi-standard) o unico (mono)
    ...(isMultiStandard
      ? normCompletions.filter(n => n.hasDomande).map(({ key, shortLabel, pct, firstUnansweredNorm }) => ({
          id: `checklistPct-${key}`,
          text: `${shortLabel}: checklist al ${pct}% (minimo ${COMPLETION_THRESHOLD}%)`,
          isMissing: pct < COMPLETION_THRESHOLD,
          fieldId: firstUnansweredNorm.fieldId,
          path: [
            { type: "section", key: "checklist" },
            { type: "subsection", key: firstUnansweredNorm.subsId },
            { type: "clauseExpand" },
          ].filter((s) => !(s.type === "subsection" && !s.key)),
        }))
      : hasIsoChecklistForGuide ? [{
          id: "checklistPct",
          text: `Checklist al ${checklistPct}% (minimo ${COMPLETION_THRESHOLD}%)`,
          isMissing: checklistPct < COMPLETION_THRESHOLD,
          fieldId: firstUnanswered.fieldId,
          path: [
            { type: "section", key: "checklist" },
            { type: "subsection", key: firstUnanswered.subsId },
            { type: "clauseExpand" },
          ].filter((s) => !(s.type === "subsection" && !s.key)),
        }] : []
    ),
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

  // ─── Trasferimento NC/OSS al modulo organizzativo (richiede licenza 'nc') ──
  // Conteggio rilievi disponibili per il push (NC + OSS sia ISO sia custom)
  const ncPushAvailable = useMemo(() => {
    const isoM = calculateFindingsMetrics(currentAudit?.checklist);
    const cuM  = currentAudit?.customChecklist?.has_outcome_buttons
      ? calculateCustomFindingsMetrics(currentAudit.customStatuses)
      : { totalNC: 0, totalOSS: 0 };
    return {
      nc:  (isoM.totalNC  || 0) + (cuM.totalNC  || 0),
      oss: (isoM.totalOSS || 0) + (cuM.totalOSS || 0),
    };
  }, [currentAudit]);

  const ncPushTotal = ncPushAvailable.nc + ncPushAvailable.oss;

  async function handleNcPush() {
    const auditRef = currentAudit?.metadata?.auditId ?? currentAudit?.audit_id
                  ?? currentAudit?.metadata?.id     ?? currentAudit?.id;
    if (!auditRef) {
      setNcPushState((s) => ({ ...s, phase: "error", error: "ID audit non disponibile" }));
      return;
    }
    setNcPushState({ phase: "pushing", countdown: 0, summary: null, error: null });
    try {
      const res = await apiService.pushAuditToNcRegister(auditRef);
      const data = res?.data || res || {};
      const summary = data.summary || {
        created_count: (data.created || []).length,
        skipped_count: (data.skipped || []).length,
        total_findings: 0,
      };

      // Avvia countdown undo
      let secs = NC_PUSH_UNDO_SECONDS;
      setNcPushState({ phase: "pushed", countdown: secs, summary, error: null });
      if (ncPushTimerRef.current) clearInterval(ncPushTimerRef.current);
      ncPushTimerRef.current = setInterval(() => {
        secs -= 1;
        if (secs <= 0) {
          clearInterval(ncPushTimerRef.current);
          ncPushTimerRef.current = null;
          setNcPushState((s) => ({ ...s, phase: "finalized", countdown: 0 }));
        } else {
          setNcPushState((s) => ({ ...s, countdown: secs }));
        }
      }, 1000);
    } catch (err) {
      setNcPushState({
        phase: "error",
        countdown: 0,
        summary: null,
        error: err?.response?.data?.error || err?.message || "Errore durante il trasferimento.",
      });
    }
  }

  async function handleNcPushUndo() {
    const auditRef = currentAudit?.metadata?.auditId ?? currentAudit?.audit_id
                  ?? currentAudit?.metadata?.id     ?? currentAudit?.id;
    if (!auditRef) return;
    if (ncPushTimerRef.current) {
      clearInterval(ncPushTimerRef.current);
      ncPushTimerRef.current = null;
    }
    setNcPushState((s) => ({ ...s, phase: "undoing" }));
    try {
      await apiService.undoPushAuditToNcRegister(auditRef);
      setNcPushState((s) => ({ ...s, phase: "undone", countdown: 0 }));
    } catch (err) {
      setNcPushState((s) => ({
        ...s,
        phase: "error",
        error: err?.response?.data?.error || err?.message || "Impossibile annullare il trasferimento.",
      }));
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
      <p className="close-panel__subtitle">Elenco informazioni mancanti. Dopo la chiusura l'audit sarà in sola lettura.</p>

      {/* Barre completamento: una per norma (multi) o unica (mono) */}
      {hasIsoChecklistForGuide && (isMultiStandard ? normCompletions.filter(n => n.hasDomande) : [{ shortLabel: "Checklist", pct: checklistPct }]).map(({ shortLabel, pct }, i) => (
        <div key={i} className="close-completion">
          <div className="close-completion__label">
            <span>{isMultiStandard ? shortLabel : "Completamento checklist"}</span>
            <strong className={pct >= COMPLETION_THRESHOLD ? "ok" : "fail"}>{pct}%</strong>
          </div>
          <div className="close-completion__bar">
            <div className={`close-completion__fill ${pct >= COMPLETION_THRESHOLD ? "ok" : "fail"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            <div className="close-completion__threshold" style={{ left: `${COMPLETION_THRESHOLD}%` }} title={`Soglia: ${COMPLETION_THRESHOLD}%`} />
          </div>
        </div>
      ))}

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

      {/* ─── Trasferimento al modulo NC (solo con licenza 'nc') ───────────── */}
      {hasNcLicense && ncPushTotal > 0 && (
        <div className="close-checklist close-nc-push">
          <h4>📋 Trasferimento al modulo Non Conformità</h4>
          {ncPushState.phase === "idle" && (
            <>
              <p className="close-nc-push__text">
                Rilevate <strong>{ncPushAvailable.nc} NC</strong>
                {ncPushAvailable.oss > 0 && (
                  <> e <strong>{ncPushAvailable.oss} OSS</strong></>
                )}.
                Trasferiscile al modulo organizzativo per gestire azioni correttive,
                responsabili e verifiche di efficacia.
              </p>
              <button
                className="close-btn close-btn--secondary"
                onClick={handleNcPush}
                title="Trasferisce NC e OSS al registro organizzativo (potrai annullare entro 10 secondi)"
              >
                📤 Trasferisci NC e OSS al modulo NC
              </button>
            </>
          )}
          {ncPushState.phase === "pushing" && (
            <p className="close-nc-push__text">⏳ Trasferimento in corso...</p>
          )}
          {ncPushState.phase === "pushed" && (
            <div className="close-nc-push__toast">
              <p>
                ✅ <strong>Trasferiti {ncPushState.summary?.created_count ?? 0} rilievi</strong>
                {ncPushState.summary?.skipped_count > 0 && (
                  <> ({ncPushState.summary.skipped_count} già presenti, saltati)</>
                )} al modulo NC.
              </p>
              <p className="close-nc-push__countdown">
                Annullabile entro <strong>{ncPushState.countdown}s</strong>
              </p>
              <button
                className="close-btn close-btn--force"
                onClick={handleNcPushUndo}
              >
                ↩ Annulla trasferimento
              </button>
            </div>
          )}
          {ncPushState.phase === "undoing" && (
            <p className="close-nc-push__text">⏳ Annullamento in corso...</p>
          )}
          {ncPushState.phase === "finalized" && (
            <p className="close-nc-push__text close-nc-push__text--ok">
              ✅ Trasferimento completato. {ncPushState.summary?.created_count ?? 0} NC/OSS
              ora gestibili dal <a href="/nc" target="_blank" rel="noreferrer">modulo NC</a>.
              Per modifiche o eliminazioni, agire dal modulo NC.
            </p>
          )}
          {ncPushState.phase === "undone" && (
            <p className="close-nc-push__text close-nc-push__text--ok">
              ✅ Trasferimento annullato. Le NC/OSS sono state rimosse dal modulo.
              {" "}
              <button
                className="close-link-btn"
                onClick={() => setNcPushState({ phase: "idle", countdown: 0, summary: null, error: null })}
              >
                Riprova
              </button>
            </p>
          )}
          {ncPushState.phase === "error" && (
            <p className="close-api-error">⚠️ {ncPushState.error}</p>
          )}
        </div>
      )}

      {/* Nota informativa quando la licenza NC NON e' attiva: il flusso pending_issues
          resta comunque attivo, le NC/OSS verranno presentate al re-audit successivo. */}
      {!hasNcLicense && ncPushTotal > 0 && (
        <div className="close-checklist close-checklist--info">
          <h4>ℹ️ Gestione rilievi senza modulo NC</h4>
          <p>
            Le <strong>{ncPushAvailable.nc} NC</strong>
            {ncPushAvailable.oss > 0 && (
              <> e <strong>{ncPushAvailable.oss} OSS</strong></>
            )} rilevate saranno automaticamente presentate come <strong>rilievi pendenti</strong>
            nel prossimo audit dello stesso cliente. Attiva il modulo "Non Conformità" per
            gestire azioni correttive, responsabili e verifiche di efficacia in modo strutturato.
          </p>
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
