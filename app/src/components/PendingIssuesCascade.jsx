/**
 * Pending Issues Cascade Component — Re-audit interattivo
 *
 * Carica i rilievi pendenti dall'audit precedente tramite GET /pending-issues
 * (che esegue lazy-init su DB). Permette all'auditor di segnare ciascun rilievo
 * come Risolto / Persiste / In corso e salva via PUT /pending-issues/:issueId.
 *
 * Flusso:
 *  1. Chiama getPendingIssues(currentAuditId) → crea record DB e li restituisce
 *  2. Per ogni rilievo mostra i 3 pulsanti di risoluzione
 *  3. PUT /audits/:id/pending-issues/:issueId aggiorna status + note
 *
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React, { useState, useEffect, useCallback } from "react";
import { useStorage } from "../contexts/StorageContext";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import AutoTextarea from "./AutoTextarea";
import "./ChecklistModule.css";
import "./AuditOutcomeSection.css";
import "./PendingIssuesCascade.css";

/** Stati NC del modulo organizzativo che indicano risoluzione (suggerimento UI). */
const NC_RESOLVED_STATUSES = new Set(["resolved", "verified", "closed"]);

/** Etichette stato NC dal modulo organizzativo. */
const NC_STATUS_LABELS = {
  open:        { label: "Aperta",     cls: "nc-open"        },
  in_progress: { label: "In corso",   cls: "nc-in-progress" },
  resolved:    { label: "Risolta",    cls: "nc-resolved"    },
  verified:    { label: "Verificata", cls: "nc-verified"    },
  closed:      { label: "Chiusa",     cls: "nc-closed"      },
};

/** Config badge per status originale rilievo */
const ORIGIN_STATUS_CONFIG = {
  NC:  { label: "Non Conforme",  cssKey: "nc",  statusBtnClass: "non-compliant" },
  OSS: { label: "Osservazione",  cssKey: "oss", statusBtnClass: "partial"       },
  OM:  { label: "Osservazione Minore", cssKey: "om", statusBtnClass: "om"       },
  NV:  { label: "Non Valutato",  cssKey: "nv",  statusBtnClass: "not-verified"  },
};

/** Mappa section_code → nome leggibile ISO 9001 (HLS clausole 4-10) */
const SECTION_LABELS = {
  clause4:  "4 - Contesto dell'organizzazione",
  clause5:  "5 - Leadership",
  clause6:  "6 - Pianificazione",
  clause7:  "7 - Supporto",
  clause8:  "8 - Attività operative",
  clause9:  "9 - Valutazione delle prestazioni",
  clause10: "10 - Miglioramento",
};

/**
 * Restituisce l'etichetta leggibile per un section_code.
 * Gestisce sia codici puri ("clause8") sia prefissati ("ISO_9001_clause8").
 */
function getSectionLabel(sectionCode) {
  if (!sectionCode) return null;
  const lower = sectionCode.toLowerCase();
  for (const [key, label] of Object.entries(SECTION_LABELS)) {
    if (lower === key || lower.endsWith(`_${key}`)) return label;
  }
  return sectionCode;
}

/** Config pulsanti di risoluzione */
const RESOLUTION_ACTIONS = [
  { status: "resolved",    label: "✅ Risolto",     cls: "btn-resolved"    },
  { status: "in_progress", label: "🔄 In corso",    cls: "btn-in-progress" },
  { status: "persists",    label: "❌ Persiste",     cls: "btn-persists"    },
];

function PendingIssuesCascade() {
  const { currentAudit } = useStorage();
  const { hasLicensedModule } = useAuth();
  const hasNcLicense = hasLicensedModule("nc");

  const [issues, setIssues]                   = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState(null);
  const [retryCount, setRetryCount]           = useState(0);

  // Stato nota per ogni issue: { [issue_id]: string }
  const [notes, setNotes]       = useState({});
  // Saving per issue: { [issue_id]: boolean }
  const [saving, setSaving]     = useState({});
  // Errore per issue: { [issue_id]: string }
  const [issueError, setIssueError] = useState({});

  const auditUuid  = currentAudit?.metadata?.id || currentAudit?.id;
  const auditId    = currentAudit?.metadata?.auditId ?? currentAudit?.audit_id;
  const clientName = currentAudit?.metadata?.clientName;

  // ─── Caricamento rilievi ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!clientName || (!auditUuid && !auditId)) {
      setIssues([]);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // getPendingIssues usa GET /audits/:id/pending-issues
        // che esegue lazy-init e restituisce issue_id per aggiornamenti successivi
        const ref = auditId || auditUuid;
        const data = await apiService.getPendingIssues(ref);

        if (!cancelled) {
          const loaded = data.pending_issues || [];
          setIssues(loaded);
          // Pre-popola note dai dati già salvati
          const initialNotes = {};
          loaded.forEach((pi) => {
            if (pi.resolution_notes) initialNotes[pi.issue_id] = pi.resolution_notes;
          });
          setNotes(initialNotes);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[PendingIssues] Errore:", err?.status, err?.message, err);
          // 404 = nessun audit precedente → silenzioso (nessun rilievo)
          if (err?.status === 404 || err?.code === 'AUDIT_NOT_FOUND') {
            setIssues([]);
          } else {
            setError(`Impossibile caricare i rilievi pendenti (${err?.status || 'NET'}: ${err?.message || String(err)})`);
            setIssues([]);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [clientName, auditUuid, auditId, retryCount]);

  // ─── Aggiornamento risoluzione ───────────────────────────────────────────────
  const handleResolution = useCallback(async (issue, newStatus) => {
    const issueId = issue.issue_id;
    const ref     = auditId || auditUuid;

    // Toggle: click stesso pulsante → torna a 'open'
    const finalStatus = issue.issue_status === newStatus ? "open" : newStatus;
    const note        = notes[issueId] || "";

    setSaving((prev)     => ({ ...prev, [issueId]: true }));
    setIssueError((prev) => ({ ...prev, [issueId]: null }));

    try {
      const result = await apiService.updatePendingIssue(ref, issueId, {
        status: finalStatus,
        resolution_notes: note || null,
      });

      const updated = result?.pending_issue || {};
      setIssues((prev) =>
        prev.map((pi) =>
          pi.issue_id === issueId
            ? { ...pi, issue_status: updated.status ?? finalStatus }
            : pi
        )
      );
    } catch (err) {
      console.error("[PendingIssues] Errore update:", err);
      setIssueError((prev) => ({
        ...prev,
        [issueId]: err?.message || "Errore durante il salvataggio",
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [issueId]: false }));
    }
  }, [auditId, auditUuid, notes]);

  const handleNoteChange = useCallback((issueId, value) => {
    setNotes((prev) => ({ ...prev, [issueId]: value }));
  }, []);

  const handleNoteSave = useCallback(async (issue) => {
    const issueId  = issue.issue_id;
    const ref      = auditId || auditUuid;
    const note     = notes[issueId] || "";
    const curStatus = issue.issue_status || "open";

    setSaving((prev) => ({ ...prev, [issueId]: true }));
    try {
      await apiService.updatePendingIssue(ref, issueId, {
        status: curStatus,
        resolution_notes: note || null,
      });
    } catch (err) {
      setIssueError((prev) => ({
        ...prev,
        [issueId]: err?.message || "Errore durante il salvataggio nota",
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [issueId]: false }));
    }
  }, [auditId, auditUuid, notes]);

  // Ordinamento esplicito: NC prima, poi OSS, poi NV
  const STATUS_ORDER = { NC: 0, OSS: 1, NV: 2 };
  const sortedIssues = [...issues].sort(
    (a, b) => (STATUS_ORDER[a.original_status] ?? 9) - (STATUS_ORDER[b.original_status] ?? 9)
  );

  // ─── Sezione nascosta se nessun rilievo ─────────────────────────────────────
  if (!loading && issues.length === 0 && !error) {
    if (!clientName) return null;
    return (
      <div className="pending-cascade pending-cascade--empty">
        <p className="pending-empty-msg">✅ Nessun rilievo pendente dall'audit precedente.</p>
      </div>
    );
  }

  const ncCount      = issues.filter((r) => r.original_status === "NC").length;
  const ossCount     = issues.filter((r) => r.original_status === "OSS").length;
  const nvCount      = issues.filter((r) => r.original_status === "NV").length;
  const resolvedCount = issues.filter((r) => r.issue_status === "resolved").length;
  const persistsCount = issues.filter((r) => r.issue_status === "persists").length;

  return (
    <div className="pending-cascade">
      <div className="pending-header">
        <div>
          <h3>🔁 Rilievi Pendenti</h3>
        </div>
      </div>

      {loading && <div className="pending-loading">⏳ Caricamento rilievi pendenti...</div>}

      {error && (
        <div className="pending-error">
          ⚠️ {error}
          <button className="pending-retry-btn" onClick={() => setRetryCount((n) => n + 1)}>
            Riprova
          </button>
        </div>
      )}

      {!loading && !error && issues.length > 0 && (
        <>
          {/* Riepilogo statistiche — badge compatte, stesso stile di Rilievi Emergenti */}
          <div className="findings-metrics-compact">
            <span className="metric-compact nc-severe"><strong>NC:</strong> {ncCount}</span>
            <span className="metric-compact oss"><strong>OSS:</strong> {ossCount}</span>
            <span className="metric-compact nv"><strong>NV:</strong> {nvCount}</span>
          </div>

          {/* Lista rilievi */}
          <div className="issues-list">
            {sortedIssues.map((issue) => {
              const cfg         = ORIGIN_STATUS_CONFIG[issue.original_status] || null;
              const clauseLabel = issue.section_code ? getSectionLabel(issue.section_code) : null;
              const description = issue.question_text || clauseLabel || `Risposta #${issue.source_response_id}`;
              const curStatus   = issue.issue_status || "open";
              const isResolved  = curStatus === "resolved";
              const isPersists  = curStatus === "persists";
              const isSavingThis = saving[issue.issue_id];

              return (
                <div
                  key={issue.issue_id}
                  className={`issue-card${cfg ? ` status-${cfg.cssKey}` : ""}${isResolved ? " resolved" : ""}`}
                >
                  <div className="issue-header">
                    <div className="issue-title-section">
                      <div className="issue-title-row">
                        {cfg && (
                          <span
                            className={`status-btn ${cfg.statusBtnClass} active`}
                            style={{ cursor: "default", pointerEvents: "none" }}
                            aria-label={cfg.label}
                          >
                            {issue.original_status}
                          </span>
                        )}
                        {clauseLabel && <span className="issue-clause">{clauseLabel}</span>}
                        <h4 className="issue-title">{description}</h4>
                      </div>
                      {/* Pulsante deep-link domanda */}
                      {issue.section_code && (
                        <button
                          className="issue-goto-btn"
                          type="button"
                          onClick={() =>
                            window.dispatchEvent(
                              new CustomEvent("sgq:goto-question", {
                                detail: {
                                  questionId: issue.question_id,
                                  sectionCode: issue.section_code,
                                },
                              })
                            )
                          }
                          title={`Vai alla clausola ${issue.section_code} nella checklist`}
                        >
                          🔍 Vai alla domanda
                        </button>
                      )}
                    </div>
                    {/* Badge stato corrente */}
                    {curStatus !== "open" && (
                      <span className={`resolution-badge resolution-badge--${curStatus}`}>
                        {curStatus === "resolved"    && "✅ Risolto"}
                        {curStatus === "in_progress" && "🔄 In corso"}
                        {curStatus === "persists"    && "❌ Persiste"}
                      </span>
                    )}
                  </div>

                  {/* Note originali rilievo */}
                  <div className={`issue-notes${!issue.source_notes ? " issue-notes-empty" : ""}`}>
                    {issue.source_notes || <em>Nessuna nota registrata</em>}
                  </div>

                  {/* Stato dal modulo NC organizzativo (solo se licenza attiva e linkato) */}
                  {hasNcLicense && issue.nc_id && issue.nc_status && (
                    <div className={`issue-nc-link ${NC_STATUS_LABELS[issue.nc_status]?.cls || ""}`}>
                      <span className="issue-nc-icon">📋</span>
                      <span className="issue-nc-text">
                        <strong>{issue.nc_number || `#${issue.nc_id}`}</strong>
                        {" — "}
                        <span className={`issue-nc-status-badge nc-badge--${issue.nc_status}`}>
                          {NC_STATUS_LABELS[issue.nc_status]?.label || issue.nc_status}
                        </span>
                      </span>
                      {NC_RESOLVED_STATUSES.has(issue.nc_status) && curStatus === "open" && (
                        <span className="issue-nc-suggest">
                          ✓ Suggerimento: NC risolta dal modulo → conferma "Risolto" qui sotto
                        </span>
                      )}
                      {issue.nc_corrective_action && (
                        <div className="issue-nc-corrective">
                          <strong>Azione correttiva intrapresa:</strong>{" "}
                          {issue.nc_corrective_action}
                        </div>
                      )}
                      {issue.nc_verification_notes && (
                        <div className="issue-nc-verification">
                          <strong>Verifica efficacia:</strong>{" "}
                          {issue.nc_verification_notes}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pulsanti risoluzione */}
                  <div className="resolution-actions">
                    <span className="resolution-label">Esito verifica:</span>
                    {RESOLUTION_ACTIONS.map((action) => (
                      <button
                        key={action.status}
                        className={`resolution-btn ${action.cls}${curStatus === action.status ? " active" : ""}`}
                        disabled={isSavingThis}
                        onClick={() => handleResolution(issue, action.status)}
                        title={action.label}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>

                  {/* Textarea note risoluzione (visibile se non open) */}
                  {curStatus !== "open" && (
                    <div className="resolution-note-block">
                      <label className="resolution-note-label">Note di risoluzione:</label>
                      <AutoTextarea
                        className="resolution-note-textarea notes-textarea"
                        placeholder="Descrivi come il rilievo è stato verificato..."
                        value={notes[issue.issue_id] || ""}
                        onChange={(e) => handleNoteChange(issue.issue_id, e.target.value)}
                        onBlur={() => handleNoteSave(issue)}
                        disabled={isSavingThis}
                      />
                    </div>
                  )}

                  {/* Messaggi saving/errore */}
                  {isSavingThis && (
                    <div className="issue-saving">💾 Salvataggio...</div>
                  )}
                  {issueError[issue.issue_id] && (
                    <div className="issue-error">⚠️ {issueError[issue.issue_id]}</div>
                  )}

                  {/* Avviso carry-forward */}
                  {isPersists && (
                    <div className="issue-persists-warning">
                      ⚠️ Questo rilievo sarà riportato nel prossimo re-audit.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default PendingIssuesCascade;
