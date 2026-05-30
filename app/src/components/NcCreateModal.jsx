/**
 * NcCreateModal ù creazione NC manuale (POST source_type manual)
 */

import React, { useState, useEffect } from "react";
import apiService from "../services/apiService";
import {
  NC_MANUAL_SECTIONS,
  buildManualNcPayload,
} from "../utils/ncCreateHelpers";
import "../components/ChecklistModule.css";

const SEVERITY_OPTIONS = [
  { value: "major", label: "Grave" },
  { value: "minor", label: "Lieve" },
  { value: "observation", label: "Osservazione" },
];

const EMPTY_FORM = {
  audit_id: "",
  section_code: "clause10",
  description: "",
  severity: "minor",
  responsible_person: "",
  due_date: "",
};

export default function NcCreateModal({ open, onClose, onCreated }) {
  const [audits, setAudits] = useState([]);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setError(null);
    setLoadingAudits(true);
    apiService.getAudits({ limit: 100 })
      .then(res => {
        const rows = res?.data || [];
        const openish = rows.filter(a => a.status !== 'completed' && a.status !== 'approved');
        setAudits(openish.length ? openish : rows);
      })
      .catch(() => setAudits([]))
      .finally(() => setLoadingAudits(false));
  }, [open]);

  if (!open) return null;

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  const selectedAudit = audits.find(
    a => String(a.audit_id) === String(form.audit_id)
  );

  async function handleSubmit(e) {
    e.preventDefault();
    const built = buildManualNcPayload(form, selectedAudit?.audit_number);
    if (!built.ok) {
      setError(built.message);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiService.createNonConformity(built.payload);
      const created = res?.data || res;
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      const msg = err?.response?.data?.error || "Errore durante la creazione della NC.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nc-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="nc-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="nc-create-title"
      >
        <h3 id="nc-create-title">{"\u2795 Nuova NC manuale"}</h3>
        <p className="nc-modal-desc">
          Crea una non conformitù collegata a un audit (origine manuale, ISO ù10.2).
        </p>
        <form className="nc-action-form" onSubmit={handleSubmit}>
          <div className="nc-form-row">
            <label htmlFor="nc-create-audit">Audit di riferimento *</label>
            <select
              id="nc-create-audit"
              required
              value={form.audit_id}
              disabled={loadingAudits || saving}
              onChange={e => setField("audit_id", e.target.value)}
            >
              <option value="">
                {loadingAudits ? "Caricamento audit..." : "Seleziona audit"}
              </option>
              {audits.map(a => (
                <option key={a.audit_id} value={a.audit_id}>
                  {a.audit_number} ù {a.client_name}
                </option>
              ))}
            </select>
          </div>
          <div className="nc-form-row nc-form-row-2col">
            <div>
              <label htmlFor="nc-create-section">Sezione ISO *</label>
              <select
                id="nc-create-section"
                required
                value={form.section_code}
                disabled={saving}
                onChange={e => setField("section_code", e.target.value)}
              >
                {NC_MANUAL_SECTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nc-create-severity">Severitù *</label>
              <select
                id="nc-create-severity"
                required
                value={form.severity}
                disabled={saving}
                onChange={e => setField("severity", e.target.value)}
              >
                {SEVERITY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="nc-form-row">
            <label htmlFor="nc-create-desc">Descrizione *</label>
            <textarea
              id="nc-create-desc"
              className="notes-textarea"
              rows={3}
              required
              value={form.description}
              disabled={saving}
              onChange={e => setField("description", e.target.value)}
              placeholder="Descrivi la non conformitù..."
            />
          </div>
          <div className="nc-form-row nc-form-row-2col">
            <div>
              <label htmlFor="nc-create-resp">Responsabile NC</label>
              <input
                id="nc-create-resp"
                type="text"
                value={form.responsible_person}
                disabled={saving}
                onChange={e => setField("responsible_person", e.target.value)}
                placeholder="Referente generale"
              />
            </div>
            <div>
              <label htmlFor="nc-create-due">Scadenza NC</label>
              <input
                id="nc-create-due"
                type="date"
                value={form.due_date}
                disabled={saving}
                onChange={e => setField("due_date", e.target.value)}
              />
            </div>
          </div>
          {error && <p className="nc-error custom-checklist-form-error">{error}</p>}
          <div className="nc-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Annulla
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creazione..." : "Crea NC"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
