/**
 * CompanyCounterpartiesPanel — master-detail controparti per singola azienda (PR1)
 */

import React, { useState, useEffect, useCallback } from "react";
import { Link } from "../contexts/RouterContext";
import apiService from "../services/apiService";
import PencilIcon from "./icons/PencilIcon";
import TrashIcon from "./icons/TrashIcon";
import "../pages/AnagrafichePage.css";

const ROLES = {
  customer: {
    value: "customer",
    shortLabel: "Cliente diretto",
    label: "Cliente diretto (contratto con l'azienda)",
    filterLabel: "Cliente diretto",
    badgeClass: "role-customer",
  },
  end_customer: {
    value: "end_customer",
    shortLabel: "Committente finale",
    label: "Committente finale (proprietario del lavoro / capitolato)",
    filterLabel: "Committente finale",
    badgeClass: "role-end-customer",
  },
  supplier: {
    value: "supplier",
    shortLabel: "Subfornitore comm.",
    label: "Subfornitore commerciale (riesame)",
    filterLabel: "Subfornitore commerciale",
    badgeClass: "role-supplier",
  },
};

const FILTER_ROLE_OPTIONS = [
  { value: "", label: "Tutti i ruoli" },
  ...Object.values(ROLES).map((r) => ({ value: r.value, label: r.filterLabel })),
];

function roleMeta(role) {
  return ROLES[role] || null;
}

function formRoleOptions(isEdit, currentRole) {
  const options = [ROLES.end_customer, ROLES.customer];
  if (isEdit && currentRole === "supplier") {
    return [ROLES.supplier, ...options];
  }
  return options;
}

function RoleBadge({ role }) {
  const meta = roleMeta(role);
  if (!meta) return role || "\u2014";
  return (
    <span
      className={`type-badge role-badge ${meta.badgeClass}`}
      title={meta.label}
    >
      {meta.shortLabel}
    </span>
  );
}

const EMPTY_FORM = {
  name: "",
  vat_number: "",
  external_ref: "",
  role: "end_customer",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  is_active: true,
};

function CounterpartyFormModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(
    item
      ? {
          name: item.name || "",
          vat_number: item.vat_number || "",
          external_ref: item.external_ref || "",
          role: item.role || "end_customer",
          contact_person: item.contact_person || "",
          email: item.email || "",
          phone: item.phone || "",
          address: item.address || "",
          notes: item.notes || "",
          is_active: item.is_active !== false && item.is_active !== 0,
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
        vat_number: form.vat_number.trim() || null,
        external_ref: form.external_ref.trim() || null,
        role: form.role,
        contact_person: form.contact_person.trim() || null,
        email: email || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      });
    } catch (err) {
      setError(err.message || "Errore salvataggio.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{item ? "Modifica controparte" : "Nuova controparte"}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi">
            {"\u2715"}
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="form-error">{error}</div>}
          <div className="form-group">
            <label>Nome *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Ruolo *</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                {formRoleOptions(Boolean(item), form.role).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="form-hint block-hint counterparties-role-hint">
                Il committente finale possiede capitolato e lavoro (es. PT.MAIDO); il cliente
                diretto ha il contratto con l&apos;azienda auditata (es. LM&amp;CO).
              </p>
              {form.role === "supplier" && (
                <p className="form-hint counterparties-supplier-link">
                  Per fornitori ISO {"\u00A7"}8.4 usa{" "}
                  <Link to="/anagrafiche">Anagrafiche</Link>.
                </p>
              )}
            </div>
            <div className="form-group">
              <label>Ref. esterno</label>
              <input
                value={form.external_ref}
                onChange={(e) => setForm((f) => ({ ...f, external_ref: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>P.IVA</label>
              <input
                value={form.vat_number}
                onChange={(e) => setForm((f) => ({ ...f, vat_number: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Referente</label>
              <input
                value={form.contact_person}
                onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Telefono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Indirizzo</label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Note</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          {item && (
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Attiva
            </label>
          )}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
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

function CounterpartyDetail({ item }) {
  return (
    <div className="supplier-detail">
      <div className="detail-header">
        <h3>{item.name}</h3>
        <RoleBadge role={item.role} />
      </div>
      {item.external_ref && (
        <p className="detail-line">
          <strong>Ref. esterno:</strong> {item.external_ref}
        </p>
      )}
      {item.vat_number && (
        <p className="detail-line">
          <strong>P.IVA:</strong> {item.vat_number}
        </p>
      )}
      {item.contact_person && (
        <p className="detail-line">
          <strong>Referente:</strong> {item.contact_person}
        </p>
      )}
      {item.email && (
        <p className="detail-line">
          <a href={`mailto:${item.email}`}>{item.email}</a>
        </p>
      )}
      {item.phone && <p className="detail-line">{item.phone}</p>}
      {item.address && <p className="detail-line">{item.address}</p>}
      {item.linked_supplier_name && (
        <p className="detail-line">
          <strong>Fornitore collegato:</strong> {item.linked_supplier_name}
        </p>
      )}
      {item.notes && <p className="detail-line detail-notes">{item.notes}</p>}
      <p className="detail-line">
        <strong>Stato:</strong>{" "}
        {item.is_active ? "Attiva" : "Disattivata"}
      </p>
    </div>
  );
}

export default function CompanyCounterpartiesPanel({
  companyId,
  auditorOrgId,
  canEdit,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterRole, setFilterRole] = useState("");
  const [error, setError] = useState(null);

  const listParams = useCallback(() => {
    const params = {};
    if (auditorOrgId) params.auditor_org_id = auditorOrgId;
    if (filterRole) params.role = filterRole;
    return params;
  }, [auditorOrgId, filterRole]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getCompanyCounterparties(companyId, listParams());
      setItems(res?.data || []);
    } catch (err) {
      setError(err.message || "Errore caricamento controparti.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, listParams]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(data) {
    const params = listParams();
    if (editItem) {
      await apiService.updateCompanyCounterparty(companyId, editItem.id, data, params);
    } else {
      await apiService.createCompanyCounterparty(companyId, data, params);
    }
    setShowForm(false);
    setEditItem(null);
    await load();
  }

  async function handleDeactivate(item) {
    if (!window.confirm(`Disattivare la controparte "${item.name}"?`)) return;
    try {
      await apiService.deactivateCompanyCounterparty(companyId, item.id, listParams());
      if (selected?.id === item.id) setSelected(null);
      await load();
    } catch (err) {
      alert(err.message || "Errore disattivazione.");
    }
  }

  return (
    <div className="company-counterparties-panel">
      {error && <div className="studio-warning-banner">{error}</div>}
      <p className="panel-hint counterparties-panel-hint">
        Controparti del riesame contrattuale: distingui chi firma con l&apos;azienda (cliente diretto)
        da chi commissiona il lavoro (committente finale).
      </p>
      <div className="split-layout">
        <div className="split-main">
          <div className="toolbar">
            <div className="filters">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                aria-label="Filtra per ruolo"
              >
                {FILTER_ROLE_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {canEdit && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setEditItem(null);
                  setShowForm(true);
                }}
              >
                + Nuova controparte
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading-msg">Caricamento...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ruolo</th>
                  <th>Nome</th>
                  <th>Ref.</th>
                  <th>P.IVA</th>
                  <th>Referente</th>
                  <th>Stato</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="empty-cell">
                      Nessuna controparte registrata.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={row.id}
                      className={selected?.id === row.id ? "row-selected" : ""}
                      onClick={() => setSelected(row)}
                    >
                      <td><RoleBadge role={row.role} /></td>
                      <td><strong>{row.name}</strong></td>
                      <td><code>{row.external_ref || "\u2014"}</code></td>
                      <td>{row.vat_number || "\u2014"}</td>
                      <td>{row.contact_person || "\u2014"}</td>
                      <td>{row.is_active ? "Attiva" : "Disattiva"}</td>
                      {canEdit && (
                        <td className="actions-cell">
                          <button
                            type="button"
                            className="grid-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditItem(row);
                              setShowForm(true);
                            }}
                            title="Modifica"
                            aria-label="Modifica controparte"
                          >
                            <PencilIcon size={15} />
                          </button>
                          {row.is_active && (
                            <button
                              type="button"
                              className="grid-icon-btn grid-icon-btn--danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeactivate(row);
                              }}
                              title="Disattiva"
                              aria-label="Disattiva controparte"
                            >
                              <TrashIcon size={15} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="split-side">
          {selected ? (
            <CounterpartyDetail item={selected} key={selected.id} />
          ) : (
            <div className="empty-side">
              Seleziona una controparte per visualizzare i dettagli.
            </div>
          )}
        </div>
      </div>

      {showForm && canEdit && (
        <CounterpartyFormModal
          item={editItem}
          onClose={() => {
            setShowForm(false);
            setEditItem(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
