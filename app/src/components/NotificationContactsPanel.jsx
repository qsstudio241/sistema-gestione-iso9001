/**
 * NotificationContactsPanel — rubrica referenti NC (SgqDataGrid)
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import SgqDataGrid from "./SgqDataGrid";
import { ROLE_LABELS } from "./NcResponsibleSelect";

const ROLE_OPTIONS = [
  { value: "attuazione", label: "Attuazione" },
  { value: "verifica", label: "Verifica" },
  { value: "generico", label: "Generico" },
];

const EMPTY_FORM = { name: "", email: "", role_type: "generico", active: true };

function ContactFormModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(item ? {
    name: item.name || "",
    email: item.email || "",
    role_type: item.role_type || "generico",
    active: item.active !== false && item.active !== 0,
  } : { ...EMPTY_FORM });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Nome obbligatorio.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(form.email.trim())) {
      setError("Email non valida.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message || "Errore salvataggio.");
      setSaving(false);
    }
  }

  return (
    <div className="notif-modal-backdrop" role="dialog" aria-modal="true">
      <div className="notif-modal">
        <h3>{item ? "Modifica referente" : "Nuovo referente"}</h3>
        <form onSubmit={handleSubmit}>
          <div className="notif-field">
            <label>Nome *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="notif-field">
            <label>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="notif-field">
            <label>Ruolo</label>
            <select
              value={form.role_type}
              onChange={(e) => setForm((f) => ({ ...f, role_type: e.target.value }))}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <span className="toggle-track" />
            <span className="toggle-title">Attivo</span>
          </label>
          {error && <p className="notif-error">{error}</p>}
          <div className="notif-actions">
            <button type="button" className="btn-test" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-save-notif" disabled={saving}>
              {saving ? "Salvataggio..." : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NotificationContactsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getNotificationContacts();
      setRows(res?.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form) {
    if (modal?.item) {
      await apiService.updateNotificationContact(modal.item.id, form);
    } else {
      await apiService.createNotificationContact(form);
    }
    setModal(null);
    await load();
  }

  async function handleDelete(row) {
    if (!window.confirm(`Eliminare ${row.name}?`)) return;
    try {
      await apiService.deleteNotificationContact(row.id);
      await load();
    } catch (err) {
      alert(err.message || "Impossibile eliminare il referente.");
    }
  }

  const columns = [
    { id: "name", label: "Nome", sortable: true },
    { id: "email", label: "Email", sortable: true },
    { id: "role_type", label: "Ruolo", sortable: true },
    { id: "active", label: "Stato", sortable: true },
    { id: "actions", label: "", sortable: false },
  ];

  return (
    <div className="notif-card notif-contacts-panel">
      <div className="notif-header-inline">
        <h3 className="notif-card-title">Rubrica referenti NC</h3>
        <button
          type="button"
          className="btn-save-notif"
          onClick={() => setModal({ item: null })}
        >
          + Aggiungi referente
        </button>
      </div>
      <p className="notif-hint">
        I referenti ricevono email di promemoria sulle scadenze NC/azioni (escalation).
      </p>

      <SgqDataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        emptyMessage="Nessun referente in rubrica."
        getRowKey={(r) => r.id}
        renderCell={(row, col) => {
          if (col.id === "role_type") return ROLE_LABELS[row.role_type] || row.role_type;
          if (col.id === "active") {
            return row.active === false || row.active === 0 ? "Inattivo" : "Attivo";
          }
          if (col.id === "actions") {
            return (
              <>
                <button type="button" className="btn-icon" title="Modifica" onClick={() => setModal({ item: row })}>??</button>
                <button type="button" className="btn-icon" title="Elimina" onClick={() => handleDelete(row)}>???</button>
              </>
            );
          }
          return row[col.id] ?? "—";
        }}
      />

      {modal && (
        <ContactFormModal
          item={modal.item}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
