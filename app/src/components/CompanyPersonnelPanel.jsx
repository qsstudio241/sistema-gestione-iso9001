/**
 * CompanyPersonnelPanel — griglia CRUD personale per singola azienda (slice S5)
 * Collegamento qualifiche: import, link, pannello certificati (slice D)
 * Alert #3: badge ruoli funzionali (personnel_roles) e azioni inline.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import apiService from "../services/apiService";
import SgqDataGrid from "./SgqDataGrid";
import { Badge } from "./SharedComponents";
import { formatDate } from "../utils/dateHelpers";
import "../pages/NotificationsSettingsPage.css";

const GRID_COLUMNS = [
  { id: "name", label: "Nome", sortable: true, width: "18%" },
  { id: "job_title", label: "Mansione", sortable: true, width: "15%" },
  { id: "email", label: "Email", sortable: true, width: "18%", cellClassName: "notif-col-email" },
  { id: "active", label: "Stato", sortable: true, width: "8%" },
  { id: "flags", label: "Att./Ver.", sortable: false, width: "9%" },
  { id: "roles", label: "Ruoli", sortable: false, width: "15%" },
  {
    id: "actions",
    label: "Azioni",
    sortable: false,
    width: "130px",
    headerClassName: "notif-col-actions",
    cellClassName: "notif-col-actions",
  },
];

// Etichette UI per i role_code supportati
const ROLE_LABELS = {
  QUAL_ALERT_RECIPIENT: { label: "Alert qualifiche", tooltip: "Questa persona riceve le email di alert scadenza qualifiche per questa azienda" },
};

const EMPTY_FORM = {
  name: "",
  job_title: "",
  email: "",
  active: true,
  can_actuation: false,
  can_verify: false,
  is_primary_welding_coordinator: false,
};

function formatQualStatus(status) {
  if (!status) return "\u2014";
  const map = {
    valida: "Valida",
    in_scadenza: "In scadenza",
    scaduta: "Scaduta",
    sospesa: "Sospesa",
  };
  return map[status] || status;
}

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
          is_primary_welding_coordinator: !!item.is_primary_welding_coordinator,
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
        is_primary_welding_coordinator: form.is_primary_welding_coordinator,
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
            <span className="toggle-title">{"Pu\u00f2 attuazione NC"}</span>
          </label>
          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={form.can_verify}
              onChange={(e) => setForm((f) => ({ ...f, can_verify: e.target.checked }))}
            />
            <span className="toggle-track" />
            <span className="toggle-title">{"Pu\u00f2 verifica NC"}</span>
          </label>
          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={form.is_primary_welding_coordinator}
              onChange={(e) => setForm((f) => ({ ...f, is_primary_welding_coordinator: e.target.checked }))}
            />
            <span className="toggle-track" />
            <span className="toggle-title">Coordinatore saldatura responsabile (primario)</span>
          </label>
          {form.is_primary_welding_coordinator && !form.email.trim() && (
            <p className="notif-error" style={{ fontSize: 12 }}>
              Inserisci l&apos;email del coordinatore: deve coincidere con l&apos;utente che registra le conferme.
            </p>
          )}
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

function PersonnelQualificationsModal({ person, companyId, auditorOrgId, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = auditorOrgId ? { auditor_org_id: auditorOrgId } : {};
        const res = await apiService.getPersonnelQualifications(companyId, person.id, params);
        if (!cancelled) setRows(res?.data || []);
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          setError(err.message || "Impossibile caricare le qualifiche.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, person.id, auditorOrgId]);

  return (
    <div className="notif-modal-backdrop" role="dialog" aria-modal="true">
      <div className="notif-modal" style={{ maxWidth: 720 }}>
        <h3>{"Qualifiche collegate \u2014 "}{person.name}</h3>
        {loading && <p className="notif-hint">Caricamento...</p>}
        {error && <p className="notif-error">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="notif-hint">Nessuna qualifica collegata. Usa &laquo;Collega qualifiche&raquo; per il backfill.</p>
        )}
        {!loading && rows.length > 0 && (
          <div className="sgq-datagrid-table-wrap" style={{ marginTop: 8 }}>
            <table className="sgq-datagrid-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Certificato</th>
                  <th>Scadenza</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <tr key={q.id}>
                    <td>{q.qualification_type || "\u2014"}</td>
                    <td>{q.certificate_number || "\u2014"}</td>
                    <td>{q.expiry_date ? formatDate(q.expiry_date) : "\u2014"}</td>
                    <td>{formatQualStatus(q.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="notif-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn-primary" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

function isPersonActive(row) {
  return row.active !== false && row.active !== 0;
}

/**
 * Badge ruoli con azione rimozione inline (X) e dropdown per aggiungere ruolo.
 */
function PersonnelRolesBadges({ row, companyId, auditorOrgId, canEdit, onRolesChanged }) {
  const [roles, setRoles] = useState(null); // null = non ancora caricati
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const dropdownRef = useRef(null);

  const apiParams = auditorOrgId ? { auditor_org_id: auditorOrgId } : {};

  // Carica ruoli on demand (alla prima visualizzazione della colonna)
  useEffect(() => {
    if (!companyId || !row.id) return;
    let cancelled = false;
    setLoading(true);
    apiService.getPersonnelRoles(companyId, row.id, apiParams)
      .then((res) => { if (!cancelled) setRoles(res?.data || []); })
      .catch(() => { if (!cancelled) setRoles([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId, row.id, auditorOrgId]);

  // Chiude il dropdown cliccando fuori
  useEffect(() => {
    if (!showDropdown) return;
    function handleOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showDropdown]);

  async function handleAdd(roleCode) {
    setShowDropdown(false);
    setAddBusy(true);
    try {
      await apiService.addPersonnelRole(companyId, row.id, { role_code: roleCode }, apiParams);
      const res = await apiService.getPersonnelRoles(companyId, row.id, apiParams);
      setRoles(res?.data || []);
      if (onRolesChanged) onRolesChanged();
    } catch (err) {
      alert(err.message || "Errore aggiunta ruolo.");
    } finally {
      setAddBusy(false);
    }
  }

  async function handleRemove(roleId, roleLabel) {
    if (!window.confirm(`Rimuovere il ruolo "${roleLabel}" da ${row.name}?`)) return;
    try {
      await apiService.removePersonnelRole(companyId, row.id, roleId, apiParams);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      if (onRolesChanged) onRolesChanged();
    } catch (err) {
      alert(err.message || "Errore rimozione ruolo.");
    }
  }

  if (loading) return <span className="notif-hint" style={{ fontSize: 11 }}>...</span>;
  if (!roles) return null;

  const activeRoleCodes = new Set((roles || []).map((r) => r.role_code));

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      {(roles || []).map((r) => {
        const meta = ROLE_LABELS[r.role_code];
        const label = meta?.label || r.role_code;
        const tip = meta?.tooltip || "";
        return (
          <span
            key={r.id}
            className="badge badge-primary"
            title={tip}
            style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, paddingRight: 2 }}
          >
            {label}
            {canEdit && (
              <button
                type="button"
                title={`Rimuovi ruolo ${label}`}
                aria-label={`Rimuovi ruolo ${label} da ${row.name}`}
                onClick={() => handleRemove(r.id, label)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                  padding: "0 2px",
                  fontSize: 12,
                  lineHeight: 1,
                }}
              >
                {"\u00d7"}
              </button>
            )}
          </span>
        );
      })}
      {canEdit && (
        <div style={{ position: "relative" }} ref={dropdownRef}>
          <button
            type="button"
            className="btn-test"
            title="Aggiungi ruolo"
            aria-label={`Aggiungi ruolo a ${row.name}`}
            disabled={addBusy}
            onClick={() => setShowDropdown((v) => !v)}
            style={{ fontSize: 11, padding: "2px 6px", lineHeight: 1.4 }}
          >
            {addBusy ? "..." : "+ Ruolo"}
          </button>
          {showDropdown && (
            <div
              role="listbox"
              aria-label="Seleziona ruolo"
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                zIndex: 200,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                boxShadow: "var(--shadow-md)",
                minWidth: 220,
                marginTop: 2,
              }}
            >
              <div style={{ padding: "6px 10px 4px", fontSize: 11, color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
                Seleziona ruolo da assegnare
              </div>
              <button
                type="button"
                role="option"
                aria-selected={activeRoleCodes.has("QUAL_ALERT_RECIPIENT")}
                disabled={activeRoleCodes.has("QUAL_ALERT_RECIPIENT")}
                title={activeRoleCodes.has("QUAL_ALERT_RECIPIENT") ? "Ruolo già assegnato" : "Questa persona riceverà le email di alert scadenza qualifiche per questa azienda"}
                onClick={() => handleAdd("QUAL_ALERT_RECIPIENT")}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 12px",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: activeRoleCodes.has("QUAL_ALERT_RECIPIENT") ? "default" : "pointer",
                  opacity: activeRoleCodes.has("QUAL_ALERT_RECIPIENT") ? 0.5 : 1,
                  fontSize: 13,
                  color: "var(--color-text)",
                }}
              >
                Alert qualifiche
                <span style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)" }}>
                  Riceve email alert scadenza qualifiche
                </span>
              </button>
              <div style={{ borderTop: "1px solid var(--color-border)", padding: "6px 12px 6px" }}>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontStyle: "italic" }}>
                  {"Altri ruoli disponibili in futuro"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CompanyPersonnelPanel({ companyId, auditorOrgId, canEdit = true }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [qualsModal, setQualsModal] = useState(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  // rolesRefreshTick forza il re-render dei badge ruoli dopo modifiche
  const [rolesRefreshTick, setRolesRefreshTick] = useState(0);

  const apiParams = auditorOrgId ? { auditor_org_id: auditorOrgId } : {};

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await apiService.getCompanyPersonnel(companyId, apiParams);
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
    if (modal?.item) {
      await apiService.updateCompanyPersonnel(companyId, modal.item.id, form, apiParams);
    } else {
      await apiService.createCompanyPersonnel(companyId, form, apiParams);
    }
    setModal(null);
    await load();
  }

  async function handleDelete(row) {
    if (!window.confirm(`Rimuovere ${row.name} dall'anagrafica?`)) return;
    try {
      await apiService.deleteCompanyPersonnel(companyId, row.id, apiParams);
      await load();
    } catch (err) {
      alert(err.message || "Impossibile eliminare il record.");
    }
  }

  async function handleImportFromQualifications() {
    if (!window.confirm("Importare i nomi dalle qualifiche esistenti? I duplicati verranno saltati.")) return;
    setLinkBusy(true);
    setStatusMsg(null);
    try {
      const res = await apiService.importPersonnelFromQualifications(companyId, apiParams);
      const created = res?.created ?? 0;
      const skipped = res?.skipped ?? 0;
      setStatusMsg(`Import completato: ${created} creati, ${skipped} gi\u00e0 presenti.`);
      await load();
    } catch (err) {
      setStatusMsg(err.message || "Errore import da qualifiche.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleLinkQualifications() {
    if (!window.confirm("Collegare le qualifiche senza personnel_id all'anagrafica (match nome/codice)?")) return;
    setLinkBusy(true);
    setStatusMsg(null);
    try {
      const res = await apiService.linkPersonnelQualifications(companyId, apiParams);
      const linked = res?.linked ?? 0;
      const unmatched = res?.unmatched ?? 0;
      setStatusMsg(`Collegamento: ${linked} qualifiche aggiornate, ${unmatched} senza match.`);
    } catch (err) {
      setStatusMsg(err.message || "Errore collegamento qualifiche.");
    } finally {
      setLinkBusy(false);
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
        if (row.is_primary_welding_coordinator) parts.push("Coord.");
        if (row.can_actuation) parts.push("Att.");
        if (row.can_verify) parts.push("Ver.");
        return parts.length ? parts.join(" / ") : "\u2014";
      }
      case "roles":
        return (
          <PersonnelRolesBadges
            key={`${row.id}-${rolesRefreshTick}`}
            row={row}
            companyId={companyId}
            auditorOrgId={auditorOrgId}
            canEdit={canEdit}
            onRolesChanged={() => setRolesRefreshTick((t) => t + 1)}
          />
        );
      case "actions":
        return (
          <div className="sgq-datagrid-row-actions">
            <button
              type="button"
              className="btn-edit"
              title="Qualifiche collegate"
              aria-label="Qualifiche collegate"
              onClick={() => setQualsModal(row)}
            >
              {"\uD83D\uDCC4"}
            </button>
            {canEdit && (
              <>
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
              </>
            )}
          </div>
        );
      default: {
        const val = row[col.id];
        if (val == null || val === "") return "\u2014";
        return val;
      }
    }
  }

  const gridColumns = GRID_COLUMNS;

  return (
    <div className="notif-card notif-contacts-panel">
      <div className="notif-header-inline">
        <h3 className="notif-card-title">Personale azienda</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canEdit && (
            <>
              <button
                type="button"
                className="btn-test"
                disabled={linkBusy}
                onClick={handleImportFromQualifications}
                title="Crea anagrafica dai nomi nelle qualifiche"
              >
                Import da qualifiche
              </button>
              <button
                type="button"
                className="btn-test"
                disabled={linkBusy}
                onClick={handleLinkQualifications}
                title="Imposta personnel_id sulle qualifiche orfane"
              >
                Collega qualifiche
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setModal({ item: null })}
              >
                + Aggiungi
              </button>
            </>
          )}
        </div>
      </div>
      <p className="notif-hint">
        Anagrafica dipendenti per NC e audit. Collegamento opzionale alle qualifiche/certificati (personnel_id).
      </p>
      {statusMsg && (
        <p className="notif-hint" style={{ color: "var(--color-text-secondary, #555)" }}>
          {statusMsg}
        </p>
      )}

      <SgqDataGrid
        rows={rows}
        columns={gridColumns}
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

      {qualsModal && (
        <PersonnelQualificationsModal
          person={qualsModal}
          companyId={companyId}
          auditorOrgId={auditorOrgId}
          onClose={() => setQualsModal(null)}
        />
      )}
    </div>
  );
}
