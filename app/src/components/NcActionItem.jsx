/**
 * NcActionItem - riga singola azione NC (correzione o correttiva/preventiva)
 * Estratto da NcActionsList per essere condiviso tra le sezioni Trattamento
 * e Azioni correttive/preventive del drawer NC.
 */
import React from "react";
import NcResponsibleSelect from "./NcResponsibleSelect";
import { formatDate } from "../utils/dateHelpers";
import { getActionDueStatus } from "../utils/ncWorkflow";

const ACTION_STATUS_CFG = {
  open:        { label: "Aperta",     cls: "act-open" },
  in_progress: { label: "In corso",   cls: "act-in-progress" },
  completed:   { label: "Completata", cls: "act-completed" },
  verified:    { label: "Verificata", cls: "act-verified" },
};

const ACTION_STEP_CFG = {
  in_progress: { label: "Avvia", statusBtn: "partial" },
  completed:   { label: "Completa", statusBtn: "compliant" },
};

const NEXT_STEPS = {
  open:        ["in_progress"],
  in_progress: ["completed"],
  completed:   [],
  verified:    [],
};

export default function NcActionItem({
  action,
  isClosed,
  contacts,
  editDraft,
  setEditDraft,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onStatus,
  onDelete,
}) {
  const a = action;
  const cfg = ACTION_STATUS_CFG[a.status] || { label: a.status, cls: "" };
  const dueStatus = getActionDueStatus(a);
  const isEditing = editDraft?.actionId === a.action_id;

  return (
    <li
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
      {isEditing && (
        <div className="nc-action-edit-form">
          <div className="nc-form-row nc-form-row-2col">
            <NcResponsibleSelect
              contacts={contacts}
              roleFilter={["attuazione", "generico"]}
              contactId={editDraft.responsible_contact_id}
              textValue={editDraft.responsible}
              useExternal={editDraft.useExternalResponsible}
              allowExternal
              onContactIdChange={(id) => setEditDraft((d) => ({ ...d, responsible_contact_id: id }))}
              onTextChange={(v) => setEditDraft((d) => ({ ...d, responsible: v }))}
              onUseExternalChange={(v) => setEditDraft((d) => ({
                ...d,
                useExternalResponsible: v,
                responsible_contact_id: v ? null : d.responsible_contact_id,
              }))}
              label="Responsabile attuazione"
              placeholder="Chi esegue l'azione"
            />
            <div>
              <label>Scadenza</label>
              <input
                type="date"
                value={editDraft.due_date}
                onChange={(e) => setEditDraft((d) => ({ ...d, due_date: e.target.value }))}
              />
            </div>
          </div>
          {editDraft.error && <p className="nc-error">{editDraft.error}</p>}
          <div className="nc-form-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={editDraft.saving}
              onClick={() => onSaveEdit(a)}
            >
              {editDraft.saving ? "Salvataggio..." : "Salva modifiche"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={editDraft.saving}
              onClick={onCancelEdit}
            >
              Annulla
            </button>
          </div>
        </div>
      )}
      {a.verification_note && (
        <p className="nc-action-verify-note">
          <strong>Nota verifica:</strong> {a.verification_note}
        </p>
      )}
      {!isClosed && (
        <div className="nc-action-btns nc-workflow-btns">
          {a.status !== "verified" && !isEditing && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onStartEdit(a)}
            >
              Modifica
            </button>
          )}
          {(NEXT_STEPS[a.status] || []).map((ns) => {
            const step = ACTION_STEP_CFG[ns] || { label: ns, statusBtn: "partial" };
            return (
              <button
                key={ns}
                type="button"
                className={`status-btn ${step.statusBtn}`}
                onClick={() => onStatus(a, ns)}
              >
                {step.label}
              </button>
            );
          })}
          {a.status === "open" && (
            <button type="button" className="btn-secondary btn-action-del" onClick={() => onDelete(a)}>
              Elimina
            </button>
          )}
        </div>
      )}
    </li>
  );
}
