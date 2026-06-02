/**
 * CompanyPersonnelPanel — griglia CRUD personale per singola azienda (slice S5)
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import SgqDataGrid from "./SgqDataGrid";
import { Badge } from "./SharedComponents";
import "../pages/NotificationsSettingsPage.css";

const GRID_COLUMNS = [
  { id: "name", label: "Nome", sortable: true, width: "20%" },
  { id: "job_title", label: "Mansione", sortable: true, width: "18%" },
  { id: "email", label: "Email", sortable: true, width: "22%", cellClassName: "notif-col-email" },
  { id: "active", label: "Stato", sortable: true, width: "10%" },
  { id: "flags", label: "Att./Ver.", sortable: false, width: "12%" },
  {
    id: "actions",
    label: "Azioni",
    sortable: false,
    width: "100px",
    headerClassName: "notif-col-actions",
    cellClassName: "notif-col-actions",
  },
];

const EMPTY_FORM = {
  name: "",
  job_title: "",
  email: "",
  active: true,
  can_actuation: false,
  can_verify: false,
};

function PersonnelFormModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(
    item
      ? {
          name: item.name || "",
          job_title: item.job_title || "",
          email: item.email || "",
          active: item.active !== false && item.active !== 0,
          can_actuation: !!item.can_actuation,
          can_verify: !!item.can_verify,
        }
      : { ...EMPTY_FORM }
  );
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Nome obbligatorio.");
      return;
    }
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
      setError("Email non valida.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: form.name.trim(),
        job_title: form.job_title.trim() || null,
        email: email || null,
        active: form.active,
        can_actuation: form.can_actuation,
        can_verify: form.can_verify,
      });
    } catch (err) {
      setError(err.message || "Errore salvataggio.");
      setSaving(false);
    }
  }

  return (
    <div className="notif-modal-backdrop" role="dialog" aria-modal="true">
      <div className="notif-modal">
        <h3>{item ? "Modifica dipendente" : "Nuovo dipendente"}</h3>
        <form onSubmit={handleSubmit}>
          <div className="notif-field">
            <label>Nome *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="notif-field">
            <label>Mansione</label>
            <input
              value={form.job_title}
              onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
            />
          </div>
          <div className="notif-field">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
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
          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={form.can_actuation}
              onChange={(e) => setForm((f) => ({ ...f, can_actuation: e.target.checked }))}
            />
            <span className="toggle-track" />
            <span className="toggle-title">Può attuazione NC</span>
          </label>
          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={form.can_verify}
              onChange={(e) => setForm((f) => ({ ...f, can_verify: e.target.checked }))}
            />
            <span className="toggle-track" />
            <span className="toggle-title">Può verifica NC</span>
          </label>
          {error && <p className="notif-error">{error}</p>}
          <div className="notif-actions">
            <button type="button" className="btn-test" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvataggio..." : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function isPersonActive(row) {
  return row.active !== false && row.active !== 0;
}

export default function CompanyPersonnelPanel({ companyId, auditorOrgId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = auditorOrgId ? { auditor_org_id: auditorOrgId } : {};
      const res = await apiService.getCompanyPersonnel(companyId, params);
      setRows(res?.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, auditorOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(form) {
    const params = auditorOrgId ? { auditor_org_id: auditorOrgId } : {};
    if (modal?.item) {
      await apiService.updateCompanyPersonnel(companyId, modal.item.id, form, params);
    } else {
      await apiService.createCompanyPersonnel(companyId, form, params);
    }
    setModal(null);
    await load();
  }

  async function handleDelete(row) {
    if (!window.confirm(`Rimuovere ${row.name} dall'anagrafica?`)) return;
    try {
      const params = auditorOrgId ? { auditor_org_id: auditorOrgId } : {};
      await apiService.deleteCompanyPersonnel(companyId, row.id, params);
      await load();
    } catch (err) {
      alert(err.message || "Impossibile eliminare il record.");
    }
  }

  function renderGridCell(row, col) {
    switch (col.id) {
      case "active":
        return isPersonActive(row) ? (
          <Badge variant="success">Attivo</Badge>
        ) : (
          <Badge variant="default">Inattivo</Badge>
        );
      case "flags": {
        const parts = [];
        if (row.can_actuation) parts.push("Att.");
        if (row.can_verify) parts.push("Ver.");
        return parts.length ? parts.join(" / ") : "\u2014";
      }
      case "actions":
        return (
          <div className="sgq-datagrid-row-actions">
            <button
              type="button"
              className="btn-edit"
              title="Modifica"
              aria-label="Modifica"
              onClick={() => setModal({ item: row })}
            >
              {"\u270F\uFE0F"}
            </button>
            <button
              type="button"
              className="btn-delete"
              title="Elimina"
              aria-label="Elimina"
              onClick={() => handleDelete(row)}
            >
              {"\uD83D\uDDD1\uFE0F"}
            </button>
          </div>
        );
      default: {
        const val = row[col.id];
        if (val == null || val === "") return "\u2014";
        return val;
      }
    }
  }

  return (
    <div className="notif-card notif-contacts-panel">
      <div className="notif-header-inline">
        <h3 className="notif-card-title">Personale azienda</h3>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setModal({ item: null })}
        >
          + Aggiungi
        </button>
      </div>
      <p className="notif-hint">
        Anagrafica dipendenti per NC e audit. Email opzionale; flag attuazione/verifica per bridge rubrica (S7).
      </p>

      <SgqDataGrid
        rows={rows}
        columns={GRID_COLUMNS}
        loading={loading}
        emptyMessage="Nessun dipendente registrato."
        theme="plain"
        getRowKey={(r) => r.id}
        getSortValue={(row, colId) => {
          if (colId === "active") return isPersonActive(row) ? 1 : 0;
          if (colId === "actions" || colId === "flags") return "";
          return row[colId] ?? "";
        }}
        renderCell={renderGridCell}
      />

      {modal && (
        <PersonnelFormModal
          item={modal.item}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
