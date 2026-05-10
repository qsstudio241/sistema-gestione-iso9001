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
import apiService from "../services/apiService";
import AutoTextarea from "./AutoTextarea";
import "./PendingIssuesCascade.css";

/** Config badge per status originale rilievo */
const ORIGIN_STATUS_CONFIG = {
  NC:  { label: "Non Conforme",  cssKey: "nc" },
  OSS: { label: "Osservazione",  cssKey: "oss" },
  NV:  { label: "Non Valutato", cssKey: "nv" },
};

/** Config pulsanti di risoluzione */
const RESOLUTION_ACTIONS = [
  { status: "resolved",    label: "✅ Risolto",     cls: "btn-resolved"    },
  { status: "in_progress", label: "🔄 In corso",    cls: "btn-in-progress" },
  { status: "persists",    label: "❌ Persiste",     cls: "btn-persists"    },
];

function PendingIssuesCascade({ onGoToQuestion }) {
  const { currentAudit } = useStorage();

  const [issues, setIssues]                   = useState([]);
  const [sourceAuditNumber, setSourceAuditNumber] = useState(null);
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
      setSourceAuditNumber(null);
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

          // Numero audit sorgente (fallback a ID numerico)
          setSourceAuditNumber(
            data.source_audit_number || (data.source_audit_id ? `#${data.source_audit_id}` : null)
          );
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
          <p className="pending-description">
            {sourceAuditNumber
              ? `Rilievi dell'audit ${sourceAuditNumber} da verificare in questo re-audit`
              : "Rilievi dell'audit precedente da verificare in questo re-audit"}
          </p>
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
          {/* Riepilogo statistiche */}
          <div className="pending-stats">
            <div className="stat-card">
              <span className="stat-value">{issues.length}</span>
              <span className="stat-label">Totali</span>
            </div>
            {ncCount > 0 && (
              <div className="stat-card stat-nc">
                <span className="stat-value">{ncCount}</span>
                <span className="stat-label">NC</span>
              </div>
            )}
            {ossCount > 0 && (
              <div className="stat-card stat-oss">
                <span className="stat-value">{ossCount}</span>
                <span className="stat-label">OSS</span>
              </div>
            )}
            {nvCount > 0 && (
              <div className="stat-card stat-nv">
                <span className="stat-value">{nvCount}</span>
                <span className="stat-label">NV</span>
              </div>
            )}
            {resolvedCount > 0 && (
              <div className="stat-card stat-resolved">
                <span className="stat-value">{resolvedCount}</span>
                <span className="stat-label">Risolti</span>
              </div>
            )}
            {persistsCount > 0 && (
              <div className="stat-card stat-persists">
                <span className="stat-value">{persistsCount}</span>
                <span className="stat-label">Persistono</span>
              </div>
            )}
          </div>

          {/* Lista rilievi */}
          <div className="issues-list">
            {sortedIssues.map((issue) => {
              const cfg         = ORIGIN_STATUS_CONFIG[issue.original_status] || null;
              const clauseLabel = issue.section_code || null;
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
                          <span className={`issue-status-badge badge-${cfg.cssKey}`}>
                            {issue.original_status}
                          </span>
                        )}
                        {clauseLabel && <span className="issue-clause">{clauseLabel}</span>}
                        <h4 className="issue-title">{description}</h4>
                      </div>
                      {/* Pulsante deep-link domanda */}
                      {onGoToQuestion && issue.section_code && (
                        <button
                          className="issue-goto-btn"
                          type="button"
                          onClick={() => onGoToQuestion(issue.section_code, issue.question_id)}
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
                    <strong>Note originali:</strong>{" "}
                    {issue.source_notes || <em>Nessuna nota registrata</em>}
                  </div>

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
