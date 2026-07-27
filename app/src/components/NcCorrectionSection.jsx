/**
 * NcCorrectionSection - blocco Trattamento (Correzione immediata, ISO 10.2.1a)
 *
 * Reazione immediata alla non conformità, sempre obbligatoria per poter
 * segnare la NC come Risolta. Condivide lo stato azioni con la sezione
 * "Azioni correttive/preventive" tramite l'hook useNcActions (nessuna
 * doppia fetch, nessun disallineamento tra le due sezioni).
 */
import React, { useState } from "react";
import NcActionItem from "./NcActionItem";
import NcResponsibleSelect from "./NcResponsibleSelect";
import RichTextField, {
  resolveNcFieldInitial,
  clearNcFieldDraftsForScope,
} from "./RichTextField";

/**
 * @param {{ ncId: number, ncActions: ReturnType<typeof import('../hooks/useNcActions').useNcActions>, organizationId?: number|null }} props
 */
export default function NcCorrectionSection({ ncId, ncActions, organizationId = null }) {
  const draftScope = `nc:${ncId}:actions`;
  const {
    loading,
    immediateActions,
    hasCompletedCorrection,
    isClosed,
    contacts,
    editDraft,
    setEditDraft: setEditDraftRaw,
    handleStatus,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleDelete,
    createAction,
  } = ncActions;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => ({
    description: resolveNcFieldInitial("", organizationId, draftScope, "new_correction_description"),
    responsible: "",
    responsible_contact_id: null,
    useExternalResponsible: false,
    due_date: "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function setEditDraft(updater) {
    setEditDraftRaw(updater);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createAction({
        action_type: "immediate",
        description: form.description.trim(),
        responsible: form.useExternalResponsible
          ? form.responsible.trim() || null
          : form.responsible.trim() || null,
        responsible_contact_id: form.useExternalResponsible ? null : form.responsible_contact_id,
        due_date: form.due_date || null,
      });
      if (organizationId) {
        clearNcFieldDraftsForScope(organizationId, draftScope, ["new_correction_description"]);
      }
      setForm({
        description: "",
        responsible: "",
        responsible_contact_id: null,
        useExternalResponsible: false,
        due_date: "",
      });
      setShowForm(false);
    } catch (err) {
      setError(err?.message || "Errore durante il salvataggio della correzione.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="nc-loading">Caricamento trattamento...</p>;

  return (
    <div className="nc-actions-panel nc-actions-panel--embedded nc-correction-panel">
      <div className="nc-actions-header">
        <span className="nc-actions-count">
          {!hasCompletedCorrection && !isClosed && (
            <span className="nc-action-required-badge">Obbligatoria</span>
          )}
          {hasCompletedCorrection && <span className="nc-action-done-badge">{"\u2713"}</span>}
        </span>
        {!isClosed && (
          <button type="button" className="btn-secondary btn-add-action" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "\u2715 Annulla" : "+ Aggiungi correzione"}
          </button>
        )}
      </div>

      {showForm && (
        <form className="nc-action-form" onSubmit={handleSubmit}>
          <div className="nc-form-row">
            <label>Descrizione *</label>
            <RichTextField
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={"Cosa \u00E8 stato fatto subito per contenere/correggere il problema..."}
              draftScopeId={draftScope}
              draftFieldId="new_correction_description"
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
              placeholder="Chi esegue la correzione"
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
              {saving ? "Salvataggio..." : "Salva correzione"}
            </button>
          </div>
        </form>
      )}

      {immediateActions.length === 0 ? (
        <p className="nc-empty-actions nc-correction-empty">
          Nessuna correzione registrata. Aggiungere almeno un{"'"}azione immediata.
        </p>
      ) : (
        <ul className="nc-actions-list">
          {immediateActions.map((a) => (
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
