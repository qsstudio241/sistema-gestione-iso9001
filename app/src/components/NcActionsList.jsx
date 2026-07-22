/**
 * NcActionsList - blocco Azioni correttive/preventive (ISO 10.2.1 c)
 *
 * La Correzione immediata (ISO 10.2.1 a) vive ora nella sezione "Trattamento"
 * del drawer (vedi NcCorrectionSection): entrambe condividono lo stesso stato
 * tramite l'hook useNcActions per evitare doppie fetch e disallineamenti.
 */

import React, { useState } from "react";
import NcActionItem from "./NcActionItem";
import NcResponsibleSelect from "./NcResponsibleSelect";
import RichTextField, {
  resolveNcFieldInitial,
  clearNcFieldDraftsForScope,
} from "./RichTextField";
import "./ChecklistModule.css";

/**
 * @param {{ ncId: number, ncActions: ReturnType<typeof import('../hooks/useNcActions').useNcActions>, organizationId?: number|null }} props
 */
export default function NcActionsList({ ncId, ncActions, organizationId = null }) {
  const draftScope = `nc:${ncId}:actions`;
  const {
    actions,
    loading,
    contacts,
    dueFilter,
    setDueFilter,
    editDraft,
    setEditDraft,
    isClosed,
    otherActions,
    overdueActionsCount,
    dueSoonActionsCount,
    handleStatus,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleDelete,
    createAction,
  } = ncActions;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => ({
    action_type: "corrective",
    description: resolveNcFieldInitial("", organizationId, draftScope, "new_action_description"),
    responsible: "",
    responsible_contact_id: null,
    useExternalResponsible: false,
    due_date: "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createAction({
        action_type: form.action_type,
        description: form.description.trim(),
        responsible: form.useExternalResponsible
          ? form.responsible.trim() || null
          : form.responsible.trim() || null,
        responsible_contact_id: form.useExternalResponsible ? null : form.responsible_contact_id,
        due_date: form.due_date || null,
      });
      if (organizationId) {
        clearNcFieldDraftsForScope(organizationId, draftScope, ["new_action_description"]);
      }
      setForm({
        action_type: "corrective",
        description: "",
        responsible: "",
        responsible_contact_id: null,
        useExternalResponsible: false,
        due_date: "",
      });
      setShowForm(false);
    } catch (err) {
      setError(err?.message || "Errore durante il salvataggio dell'azione.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="nc-loading">Caricamento azioni...</p>;

  return (
    <div className="nc-actions-panel nc-actions-panel--embedded">
      <div className="nc-actions-header">
        <span className="nc-actions-count">{otherActions.length} azioni</span>
        {!isClosed && (
          <button type="button" className="btn-secondary btn-add-action" onClick={() => setShowForm((v) => !v)}>
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
            <select value={form.action_type} onChange={(e) => setForm((f) => ({ ...f, action_type: e.target.value }))}>
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
              draftScopeId={draftScope}
              draftFieldId="new_action_description"
              persistLocalDraft
              organizationId={organizationId}
            />
          </div>
          <div className="nc-form-row nc-form-row-2col">
            <NcResponsibleSelect
              contacts={contacts}
              roleFilter={["attuazione", "generico"]}
              contactId={form.responsible_contact_id}
              textValue={form.responsible}
              useExternal={form.useExternalResponsible}
              allowExternal
              onContactIdChange={(id) => setForm((f) => ({ ...f, responsible_contact_id: id }))}
              onTextChange={(v) => setForm((f) => ({ ...f, responsible: v }))}
              onUseExternalChange={(v) => setForm((f) => ({
                ...f,
                useExternalResponsible: v,
                responsible_contact_id: v ? null : f.responsible_contact_id,
              }))}
              label="Responsabile attuazione"
              placeholder="Chi esegue l'azione"
            />
            <div>
              <label>Scadenza</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
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

      {otherActions.length === 0 ? (
        <p className="nc-empty-actions">Nessuna azione correttiva/preventiva registrata.</p>
      ) : (
        <ul className="nc-actions-list">
          {otherActions.map((a) => (
            <NcActionItem
              key={a.action_id}
              action={a}
              isClosed={isClosed}
              contacts={contacts}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onStartEdit={handleStartEdit}
              onStatus={handleStatus}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
