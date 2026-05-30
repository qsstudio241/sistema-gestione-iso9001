/**
 * NcDetailPanel — pannello dettaglio NC editabile (NC Fase 1 · Slice 4)
 *
 * Campi: description, root_cause, verification_notes, severity,
 *        responsible_person, due_date
 * API: PUT /non-conformities/:id via apiService.updateNcStatus
 */

import React, { useState, useEffect } from "react";
import apiService from "../services/apiService";
import "../components/ChecklistModule.css";

const SEVERITY_OPTIONS = [
  { value: "major", label: "Grave" },
  { value: "minor", label: "Lieve" },
  { value: "observation", label: "Osservazione" },
];

function normalizeDate(val) {
  if (!val) return "";
  return String(val).substring(0, 10);
}

function initForm(nc) {
  return {
    description: nc?.description || "",
    root_cause: nc?.root_cause || "",
    verification_notes: nc?.verification_notes || "",
    severity: nc?.severity || "minor",
    responsible_person: nc?.responsible_person || "",
    due_date: normalizeDate(nc?.due_date),
  };
}

/**
 * @param {object} props
 * @param {object} props.nc — riga NC da getAllNonConformities
 * @param {() => void} props.onSaved — callback dopo salvataggio OK
 * @param {boolean} [props.readOnly] — true se NC closed/verified
 */
export default function NcDetailPanel({ nc, onSaved, readOnly: readOnlyProp }) {
  const isClosed = ["closed", "verified"].includes(nc?.status);
  const readOnly = readOnlyProp ?? isClosed;

  const [form, setForm] = useState(() => initForm(nc));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [descError, setDescError] = useState(null);

  useEffect(() => {
    setForm(initForm(nc));
    setError(null);
    setDescError(null);
  }, [nc?.nc_id]);

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function validateDescription() {
    if (!form.description.trim()) {
      setDescError("La descrizione è obbligatoria.");
      return false;
    }
    setDescError(null);
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (readOnly) return;
    if (!validateDescription()) return;

    setSaving(true);
    setError(null);
    try {
      await apiService.updateNcStatus(nc.nc_id, {
        description: form.description.trim(),
        root_cause: form.root_cause.trim() || null,
        verification_notes: form.verification_notes.trim() || null,
        severity: form.severity,
        responsible_person: form.responsible_person.trim() || null,
        due_date: form.due_date || null,
      });
      onSaved?.();
    } catch {
      setError("Errore durante il salvataggio. Riprovare più tardi.");
    } finally {
      setSaving(false);
    }
  }

  if (!nc) return null;

  return (
    <form
      className="nc-detail-form nc-action-form"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="nc-form-row">
        <label htmlFor={`nc-desc-${nc.nc_id}`}>Descrizione *</label>
        <textarea
          id={`nc-desc-${nc.nc_id}`}
          className="notes-textarea"
          rows={3}
          value={form.description}
          readOnly={readOnly}
          onChange={e => setField("description", e.target.value)}
          onBlur={() => { if (!readOnly) validateDescription(); }}
          placeholder="Descrivi la non conformità riscontrata..."
        />
        {descError && <p className="nc-error">{descError}</p>}
      </div>

      <div className="nc-form-row">
        <label htmlFor={`nc-root-${nc.nc_id}`}>
          Analisi causa radice <small>(ISO §10.2.1b)</small>
        </label>
        <textarea
          id={`nc-root-${nc.nc_id}`}
          className="notes-textarea"
          rows={3}
          value={form.root_cause}
          readOnly={readOnly}
          onChange={e => setField("root_cause", e.target.value)}
          placeholder="5W, Ishikawa, 8D... Qual è la causa fondamentale del problema?"
        />
      </div>

      <div className="nc-form-row">
        <label htmlFor={`nc-verif-${nc.nc_id}`}>Note verifica</label>
        <textarea
          id={`nc-verif-${nc.nc_id}`}
          className="notes-textarea"
          rows={3}
          value={form.verification_notes}
          readOnly={readOnly}
          onChange={e => setField("verification_notes", e.target.value)}
          placeholder="Esito della verifica dell'efficacia delle azioni correttive..."
        />
      </div>

      <div className="nc-form-row nc-form-row-2col">
        <div>
          <label htmlFor={`nc-sev-${nc.nc_id}`}>Severità</label>
          <select
            id={`nc-sev-${nc.nc_id}`}
            value={form.severity}
            disabled={readOnly}
            onChange={e => setField("severity", e.target.value)}
          >
            {SEVERITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`nc-due-${nc.nc_id}`}>Scadenza</label>
          <input
            id={`nc-due-${nc.nc_id}`}
            type="date"
            value={form.due_date}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={e => setField("due_date", e.target.value)}
          />
        </div>
      </div>

      <div className="nc-form-row">
        <label htmlFor={`nc-resp-${nc.nc_id}`}>Responsabile</label>
        <input
          id={`nc-resp-${nc.nc_id}`}
          type="text"
          value={form.responsible_person}
          readOnly={readOnly}
          onChange={e => setField("responsible_person", e.target.value)}
          placeholder="Nome responsabile"
        />
      </div>

      {nc.corrective_action && (
        <div className="nc-form-row nc-corrective-legacy">
          <label>Nota azione (legacy)</label>
          <p className="nc-legacy-readonly">{nc.corrective_action}</p>
        </div>
      )}

      {error && <p className="nc-error custom-checklist-form-error">{error}</p>}

      {!readOnly && (
        <div className="nc-form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Salvataggio…" : "Salva modifiche"}
          </button>
        </div>
      )}
    </form>
  );
}
