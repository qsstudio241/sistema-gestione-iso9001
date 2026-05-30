/**
 * NcActionsList - elenco azioni correttive/preventive per una NC (ISO 10.2)
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import RichTextField, {
  resolveNcFieldInitial,
  clearNcFieldDraftsForScope,
} from "./RichTextField";
import { formatDate } from "../utils/dateHelpers";
import {
  canVerifyAction,
  filterActionsByDue,
  getActionDueStatus,
} from "../utils/ncWorkflow";
import "./ChecklistModule.css";

const ACTION_STATUS_CFG = {
  open:        { label: "Aperta",     cls: "act-open" },
  in_progress: { label: "In corso",   cls: "act-in-progress" },
  completed:   { label: "Completata", cls: "act-completed" },
  verified:    { label: "Verificata", cls: "act-verified" },
};

const ACTION_STEP_CFG = {
  in_progress: { label: "Avvia", statusBtn: "partial" },
  completed:   { label: "Completa", statusBtn: "compliant" },
  verified:    { label: "Verifica", statusBtn: "compliant" },
};

/**
 * @param {{ ncId: number, ncStatus: string, embedded?: boolean }} props
 */
export default function NcActionsList({ ncId, ncStatus, embedded = false }) {
  const { user } = useAuth();
  const organizationId = user?.organization_id ?? null;
  const actionDraftScope = `nc:${ncId}:actions`;

  const [actions, setActions]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(() => ({
    action_type: "corrective",
    description: resolveNcFieldInitial(
      "",
      organizationId,
      actionDraftScope,
      "new_action_description",
    ),
    responsible: "",
    due_date: "",
  }));
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const [verifyDraft, setVerifyDraft] = useState({ actionId: null, note: "" });
  const [verifyError, setVerifyError] = useState(null);
  const [dueFilter, setDueFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getNcActions(ncId);
      setActions(res?.data || []);
    } catch {
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [ncId]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiService.createNcAction(ncId, {
        action_type: form.action_type,
        description: form.description.trim(),
        responsible: form.responsible.trim() || null,
        due_date: form.due_date || null,
      });
      if (organizationId) {
        clearNcFieldDraftsForScope(organizationId, actionDraftScope, ["new_action_description"]);
      }
      setForm({
        action_type: "corrective",
        description: "",
        responsible: "",
        due_date: "",
      });
      setShowForm(false);
      await load();
    } catch {
      setError("Errore durante il salvataggio dell'azione.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(action, newStatus) {
    if (newStatus === "verified") {
      const verifyScope = `${actionDraftScope}:verify:${action.action_id}`;
      setVerifyDraft({
        actionId: action.action_id,
        note: resolveNcFieldInitial(
          action.verification_note,
          organizationId,
          verifyScope,
          "verification_note",
        ),
      });
      setVerifyError(null);
      return;
    }
    try {
      await apiService.updateNcAction(ncId, action.action_id, { status: newStatus });
      await load();
    } catch {
      alert("Impossibile aggiornare lo stato dell'azione.");
    }
  }

  async function handleConfirmVerify(action) {
    const note = verifyDraft.note.trim();
    if (!canVerifyAction(note)) {
      setVerifyError("Inserire la nota verifica prima di segnare l'azione come verificata.");
      return;
    }
    try {
      await apiService.updateNcAction(ncId, action.action_id, {
        status: "verified",
        verification_note: note,
      });
      if (organizationId) {
        clearNcFieldDraftsForScope(
          organizationId,
          `${actionDraftScope}:verify:${action.action_id}`,
          ["verification_note"],
        );
      }
      setVerifyDraft({ actionId: null, note: "" });
      setVerifyError(null);
      await load();
    } catch {
      alert("Impossibile verificare l'azione.");
    }
  }

  function handleCancelVerify() {
    if (verifyDraft.actionId && organizationId) {
      clearNcFieldDraftsForScope(
        organizationId,
        `${actionDraftScope}:verify:${verifyDraft.actionId}`,
        ["verification_note"],
      );
    }
    setVerifyDraft({ actionId: null, note: "" });
    setVerifyError(null);
  }

  async function handleDelete(action) {
    if (!window.confirm(`Eliminare l'azione "${action.description.substring(0, 50)}..."?`)) return;
    try {
      await apiService.deleteNcAction(ncId, action.action_id);
      await load();
    } catch {
      alert("Errore durante l'eliminazione.");
    }
  }

  const isClosed = ["closed", "verified"].includes(ncStatus);
  const filteredActions = useMemo(
    () => filterActionsByDue(actions, dueFilter),
    [actions, dueFilter]
  );
  const overdueActionsCount = useMemo(
    () => actions.filter(a => getActionDueStatus(a) === "overdue").length,
    [actions]
  );
  const dueSoonActionsCount = useMemo(
    () => actions.filter(a => getActionDueStatus(a) === "due_soon").length,
    [actions]
  );

  if (loading) return <p className="nc-loading">Caricamento azioni...</p>;

  return (
    <div className={`nc-actions-panel${embedded ? " nc-actions-panel--embedded" : ""}`}>
      <div className="nc-actions-header">
        {!embedded && <h4>Azioni correttive ({actions.length})</h4>}
        {embedded && <span className="nc-actions-count">{actions.length} azioni</span>}
        {!isClosed && (
          <button type="button" className="btn-secondary btn-add-action" onClick={() => setShowForm(v => !v)}>
            {showForm ? "\u2715 Annulla" : "+ Aggiungi azione"}
          </button>
        )}
      </div>

      {actions.length > 0 && (overdueActionsCount > 0 || dueSoonActionsCount > 0) && (
        <div className="nc-action-due-filters" role="group" aria-label="Filtro scadenze azioni">
          <button
            type="button"
            className={`status-btn not-applicable${dueFilter === "all" ? " active" : ""}`}
            onClick={() => setDueFilter("all")}
          >
            Tutte ({actions.length})
          </button>
          {overdueActionsCount > 0 && (
            <button
              type="button"
              className={`status-btn non-compliant${dueFilter === "overdue" ? " active" : ""}`}
              onClick={() => setDueFilter("overdue")}
            >
              Scadute ({overdueActionsCount})
            </button>
          )}
          {dueSoonActionsCount > 0 && (
            <button
              type="button"
              className={`status-btn partial${dueFilter === "due_soon" ? " active" : ""}`}
              onClick={() => setDueFilter("due_soon")}
            >
              In scadenza 7 gg ({dueSoonActionsCount})
            </button>
          )}
        </div>
      )}

      {showForm && (
        <form className="nc-action-form" onSubmit={handleSubmit}>
          <div className="nc-form-row">
            <label>Tipo</label>
            <select value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}>
              <option value="immediate">Immediata</option>
              <option value="corrective">Correttiva</option>
              <option value="preventive">Preventiva</option>
            </select>
          </div>
          <div className="nc-form-row">
            <label>Descrizione *</label>
            <RichTextField
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descrivi l'azione da intraprendere..."
              draftScopeId={actionDraftScope}
              draftFieldId="new_action_description"
              persistLocalDraft
              organizationId={organizationId}
            />
          </div>
          <div className="nc-form-row nc-form-row-2col">
            <div>
              <label>Responsabile attuazione</label>
              <input
                type="text"
                value={form.responsible}
                onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))}
                placeholder="Chi esegue l'azione"
              />
            </div>
            <div>
              <label>Scadenza</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>
          {error && <p className="nc-error">{error}</p>}
          <div className="nc-form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvataggio..." : "Salva azione"}
            </button>
          </div>
        </form>
      )}

      {actions.length === 0 ? (
        <p className="nc-empty-actions">Nessuna azione correttiva registrata.</p>
      ) : filteredActions.length === 0 ? (
        <p className="nc-empty-actions">Nessuna azione con la scadenza selezionata.</p>
      ) : (
        <ul className="nc-actions-list">
          {filteredActions.map(a => {
            const cfg = ACTION_STATUS_CFG[a.status] || { label: a.status, cls: "" };
            const dueStatus = getActionDueStatus(a);
            const nextSteps = {
              open:        ["in_progress"],
              in_progress: ["completed"],
              completed:   ["verified"],
              verified:    [],
            };
            return (
              <li
                key={a.action_id}
                className={`nc-action-item ${cfg.cls}${dueStatus === "overdue" ? " nc-action-overdue" : ""}${dueStatus === "due_soon" ? " nc-action-due-soon" : ""}`}
              >
                <div className="nc-action-top">
                  <span className={`act-type-badge at-${a.action_type}`}>
                    {a.action_type === "immediate" ? "Immediata" : a.action_type === "corrective" ? "Correttiva" : "Preventiva"}
                  </span>
                  <span className={`act-status ${cfg.cls}`}>{cfg.label}</span>
                  {dueStatus === "overdue" && (
                    <span className="nc-action-due-badge overdue">Scaduta</span>
                  )}
                  {dueStatus === "due_soon" && (
                    <span className="nc-action-due-badge due-soon">In scadenza</span>
                  )}
                  <span className="nc-action-date">{formatDate(a.created_at)}</span>
                </div>
                <p className="nc-action-desc">{a.description}</p>
                <div className="nc-action-meta">
                  {a.responsible && <span>Attuazione: {a.responsible}</span>}
                  {a.due_date && <span>Scadenza azione: {formatDate(a.due_date)}</span>}
                  {a.completed_at && <span>Completata: {formatDate(a.completed_at)}</span>}
                </div>
                {a.verification_note && (
                  <p className="nc-action-verify-note">
                    <strong>Nota verifica:</strong> {a.verification_note}
                  </p>
                )}
                {verifyDraft.actionId === a.action_id && (
                  <div className="nc-action-verify-form">
                    <label htmlFor={`act-verif-${a.action_id}`}>Nota verifica azione *</label>
                    <RichTextField
                      id={`act-verif-${a.action_id}`}
                      rows={2}
                      value={verifyDraft.note}
                      onChange={(e) => setVerifyDraft((d) => ({ ...d, note: e.target.value }))}
                      placeholder="Descrivi l'esito della verifica su questa azione..."
                      draftScopeId={`${actionDraftScope}:verify:${a.action_id}`}
                      draftFieldId="verification_note"
                      persistLocalDraft
                      organizationId={organizationId}
                    />
                    {verifyError && <p className="nc-error">{verifyError}</p>}
                    <div className="nc-form-actions">
                      <button type="button" className="btn-primary" onClick={() => handleConfirmVerify(a)}>
                        Conferma verifica
                      </button>
                      <button type="button" className="btn-secondary" onClick={handleCancelVerify}>
                        Annulla
                      </button>
                    </div>
                  </div>
                )}
                {!isClosed && (
                  <div className="nc-action-btns nc-workflow-btns">
                    {(nextSteps[a.status] || []).map(ns => {
                      const step = ACTION_STEP_CFG[ns] || { label: ns, statusBtn: "partial" };
                      return (
                        <button
                          key={ns}
                          type="button"
                          className={`status-btn ${step.statusBtn}`}
                          onClick={() => handleStatus(a, ns)}
                        >
                          {step.label}
                        </button>
                      );
                    })}
                    {a.status === "open" && (
                      <button type="button" className="btn-secondary btn-action-del" onClick={() => handleDelete(a)}>
                        Elimina
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
