/**
 * NCPage - Registro Non Conformità & Azioni Correttive
 * NC Fase 1: griglia SgqDataGrid, creazione manuale, filtri scadenze
 * ISO 9001:2015 §8.7 + §10.2
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiService from "../services/apiService";
import { Link, useRouter } from "../contexts/RouterContext";
import NcDetailPanel from "../components/NcDetailPanel";
import NcCreateModal from "../components/NcCreateModal";
import SgqDataGrid from "../components/SgqDataGrid";
import { formatDate } from "../utils/dateHelpers";
import { NC_SOURCE_TYPE_LABELS } from "../utils/ncCreateHelpers";
import {
  canTransitionNcStatus,
  canVerifyAction,
  filterActionsByDue,
  getActionDueStatus,
} from "../utils/ncWorkflow";
import "../components/ChecklistModule.css";
import "./NCPage.css";

const NC_STATUS_CFG = {
  open:        { label: "Aperta",     cls: "nc-open",        icon: "\uD83D\uDD34" },
  in_progress: { label: "In corso",   cls: "nc-in-progress", icon: "\uD83D\uDFE1" },
  resolved:    { label: "Risolta",    cls: "nc-resolved",    icon: "\uD83D\uDFE2" },
  verified:    { label: "Verificata", cls: "nc-verified",    icon: "\u2705" },
  closed:      { label: "Chiusa",     cls: "nc-closed",      icon: "\u26AB" },
};

const ACTION_STATUS_CFG = {
  open:        { label: "Aperta",     cls: "act-open" },
  in_progress: { label: "In corso",   cls: "act-in-progress" },
  completed:   { label: "Completata", cls: "act-completed" },
  verified:    { label: "Verificata", cls: "act-verified" },
};

const SEVERITY_CFG = {
  major:       { label: "Grave",        cls: "sev-major" },
  minor:       { label: "Lieve",        cls: "sev-minor" },
  observation: { label: "Osservazione", cls: "sev-obs" },
};

const NC_WORKFLOW_CFG = {
  in_progress: { label: "Avvia lavorazione", statusBtn: "partial" },
  resolved:    { label: "Segna come risolta", statusBtn: "compliant" },
  verified:    { label: "Verifica", statusBtn: "compliant" },
  closed:      { label: "Chiudi NC", statusBtn: "not-applicable" },
};

const ACTION_STEP_CFG = {
  in_progress: { label: "Avvia", statusBtn: "partial" },
  completed:   { label: "Completa", statusBtn: "compliant" },
  verified:    { label: "Verifica", statusBtn: "compliant" },
};

const NC_GRID_COLUMNS = [
  { id: "nc_number", label: "N\u00B0 NC", sortable: true },
  { id: "status", label: "Stato", sortable: true },
  { id: "severity", label: "Severit\u00E0", sortable: true },
  { id: "client_name", label: "Cliente", sortable: true },
  { id: "audit_number", label: "Audit", sortable: true },
  { id: "due_date", label: "Scadenza", sortable: true },
  { id: "source_type", label: "Origine", sortable: true },
];

function NcStatusTag({ status }) {
  const c = NC_STATUS_CFG[status] || { label: status, cls: "", icon: "" };
  return <span className={`nc-tag ${c.cls}`}>{c.icon} {c.label}</span>;
}

function SeverityTag({ severity }) {
  const c = SEVERITY_CFG[severity] || { label: severity, cls: "" };
  return <span className={`sev-tag ${c.cls}`}>{c.label}</span>;
}

function ActionsList({ ncId, ncStatus }) {
  const [actions, setActions]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ action_type: "corrective", description: "", responsible: "", due_date: "" });
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
      setForm({ action_type: "corrective", description: "", responsible: "", due_date: "" });
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
      setVerifyDraft({ actionId: action.action_id, note: action.verification_note || "" });
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
      setVerifyDraft({ actionId: null, note: "" });
      setVerifyError(null);
      await load();
    } catch {
      alert("Impossibile verificare l'azione.");
    }
  }

  function handleCancelVerify() {
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
    <div className="nc-actions-panel">
      <div className="nc-actions-header">
        <h4>Azioni correttive ({actions.length})</h4>
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
            <textarea
              className="notes-textarea"
              required
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descrivi l'azione da intraprendere..."
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
                    <textarea
                      id={`act-verif-${a.action_id}`}
                      className="notes-textarea"
                      rows={2}
                      value={verifyDraft.note}
                      onChange={e => setVerifyDraft(d => ({ ...d, note: e.target.value }))}
                      placeholder="Descrivi l'esito della verifica su questa azione..."
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

export default function NCPage() {
  const { replace } = useRouter();
  const [ncList, setNcList]         = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [selectedNcId, setSelectedNcId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filters, setFilters] = useState({ status: "", severity: "", overdue: "", due_within_days: "", company_id: "" });
  const [page, setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchNc, setSearchNc] = useState("");
  const [companies, setCompanies] = useState([]);

  const LIMIT = 20;

  useEffect(() => {
    apiService.getCompanies()
      .then(res => setCompanies(res?.data || []))
      .catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selectId = params.get("select");
    if (selectId) {
      const id = parseInt(selectId, 10);
      if (!Number.isNaN(id)) setSelectedNcId(id);
    }
  }, []);

  const loadNc = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filters.status)           params.status           = filters.status;
      if (filters.severity)         params.severity         = filters.severity;
      if (filters.overdue)          params.overdue          = filters.overdue;
      if (filters.due_within_days)  params.due_within_days  = filters.due_within_days;
      if (filters.company_id)       params.company_id       = filters.company_id;

      const [listRes, statsRes] = await Promise.all([
        apiService.getAllNonConformities(params),
        apiService.getNcStats(filters.company_id ? { company_id: filters.company_id } : {}),
      ]);

      setNcList(listRes?.data || []);
      setTotalPages(listRes?.pagination?.totalPages || 1);
      setStats(statsRes?.data || null);
    } catch (err) {
      console.error("NCPage load error:", err);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { loadNc(); }, [loadNc]);

  const filteredList = useMemo(() => {
    if (!searchNc.trim()) return ncList;
    const q = searchNc.trim().toLowerCase();
    return ncList.filter(nc =>
      (nc.nc_number || "").toLowerCase().includes(q) ||
      (nc.description || "").toLowerCase().includes(q)
    );
  }, [ncList, searchNc]);

  const selectedNc = useMemo(
    () => filteredList.find(nc => nc.nc_id === selectedNcId) || ncList.find(nc => nc.nc_id === selectedNcId) || null,
    [filteredList, ncList, selectedNcId]
  );

  function handleFilter(key, val) {
    if (key === "overdue" && val) {
      setFilters(f => ({ ...f, overdue: val, due_within_days: "" }));
    } else if (key === "due_within_days" && val) {
      setFilters(f => ({ ...f, due_within_days: val, overdue: "" }));
    } else {
      setFilters(f => ({ ...f, [key]: val }));
    }
    setPage(1);
    setSelectedNcId(null);
  }

  function resetFilters() {
    setFilters({ status: "", severity: "", overdue: "", due_within_days: "", company_id: "" });
    setSearchNc("");
    setPage(1);
    setSelectedNcId(null);
    replace("/nc");
  }

  function handleRowSelect(row) {
    const id = row?.nc_id ?? null;
    setSelectedNcId(id);
    replace(id ? `/nc?select=${id}` : "/nc");
  }

  async function handleStatusChange(nc, newStatus) {
    const gate = canTransitionNcStatus(nc, newStatus);
    if (!gate.ok) {
      alert(gate.message);
      return;
    }
    try {
      await apiService.updateNcStatus(nc.nc_id, { status: newStatus });
      await loadNc();
    } catch {
      alert("Impossibile aggiornare lo stato della NC.");
    }
  }

  function handleCreated() {
    setShowCreateModal(false);
    loadNc();
  }

  const openCount    = stats?.open     ?? 0;
  const inProgCount  = stats?.in_progress ?? 0;
  const overdueCount = stats?.overdue  ?? 0;
  const dueSoonCount = stats?.due_soon ?? 0;

  function getActiveCard() {
    if (filters.overdue === "true") return "overdue";
    if (filters.due_within_days === "7") return "due_soon";
    if (filters.status === "open")        return "open";
    if (filters.status === "in_progress") return "in_progress";
    if (!filters.status && !filters.overdue && !filters.due_within_days) return "total";
    return null;
  }

  function handleCardFilter(card) {
    const active = getActiveCard();
    if (active === card) {
      setFilters(f => ({ ...f, status: "", overdue: "", due_within_days: "" }));
      setPage(1);
      return;
    }
    if (card === "open")        setFilters(f => ({ ...f, status: "open",        overdue: "", due_within_days: "" }));
    if (card === "in_progress") setFilters(f => ({ ...f, status: "in_progress", overdue: "", due_within_days: "" }));
    if (card === "overdue")     setFilters(f => ({ ...f, status: "",             overdue: "true", due_within_days: "" }));
    if (card === "due_soon")    setFilters(f => ({ ...f, status: "",             overdue: "", due_within_days: "7" }));
    if (card === "total")       setFilters(f => ({ ...f, status: "",             overdue: "", due_within_days: "" }));
    setPage(1);
    setSelectedNcId(null);
  }

  const activeCard = getActiveCard();
  const hasActiveFilter = !!(
    filters.status || filters.severity || filters.overdue
    || filters.due_within_days || filters.company_id || searchNc
  );

  const validNext = {
    open:        ["in_progress"],
    in_progress: ["resolved"],
    resolved:    ["verified"],
    verified:    ["closed"],
    closed:      [],
  };

  function renderGridCell(row, col) {
    switch (col.id) {
      case "nc_number":
        return (
          <span className="nc-grid-number">
            {row.nc_number}
            {(row.is_overdue === 1 || row.is_overdue === true) && (
              <span className="nc-overdue-badge" title="Scaduta">{"\u26A0\uFE0F"}</span>
            )}
          </span>
        );
      case "status":
        return <NcStatusTag status={row.status} />;
      case "severity":
        return <SeverityTag severity={row.severity} />;
      case "audit_number":
        return (
          <span className="nc-grid-audit" title={row.client_name || ""}>
            {"\uD83D\uDCCB"} {row.audit_number || "\u2014"}
          </span>
        );
      case "due_date":
        return row.due_date ? formatDate(row.due_date) : "\u2014";
      case "source_type":
        return NC_SOURCE_TYPE_LABELS[row.source_type] || row.source_type || "\u2014";
      default:
        return row[col.id] ?? "\u2014";
    }
  }

  function gridRowClassName(row) {
    const classes = [];
    if (row.nc_id === selectedNcId) classes.push("sgq-datagrid-row-selected");
    if (row.is_overdue === 1 || row.is_overdue === true) classes.push("nc-grid-row-overdue");
    return classes.join(" ");
  }

  return (
    <div className="nc-page">
      <div className="nc-page-header">
        <div>
          <h1>{"\uD83D\uDEA8 Non Conformit\u00E0 & Azioni Correttive"}</h1>
          <p className="nc-page-sub">ISO 9001:2015 §8.7 + §10.2 - Registro cross-audit</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowCreateModal(true)}>
          + Nuova NC
        </button>
      </div>

      {stats && (
        <div className="nc-stats-bar">
          <button
            type="button"
            className={`nc-stat nc-stat-open${activeCard === "open" ? " nc-stat-active" : ""}`}
            onClick={() => handleCardFilter("open")}
            title="Filtra: solo NC aperte"
          >
            <span className="nc-stat-num">{openCount}</span>
            <span className="nc-stat-label">Aperte</span>
          </button>
          <button
            type="button"
            className={`nc-stat nc-stat-prog${activeCard === "in_progress" ? " nc-stat-active" : ""}`}
            onClick={() => handleCardFilter("in_progress")}
            title="Filtra: solo NC in corso"
          >
            <span className="nc-stat-num">{inProgCount}</span>
            <span className="nc-stat-label">In corso</span>
          </button>
          <button
            type="button"
            className={`nc-stat nc-stat-over${activeCard === "overdue" ? " nc-stat-active" : ""}`}
            onClick={() => handleCardFilter("overdue")}
            title="Filtra: solo NC scadute"
          >
            <span className="nc-stat-num">{overdueCount}</span>
            <span className="nc-stat-label">Scadute</span>
          </button>
          {dueSoonCount > 0 && (
            <button
              type="button"
              className={`nc-stat nc-stat-soon${activeCard === "due_soon" ? " nc-stat-active" : ""}`}
              onClick={() => handleCardFilter("due_soon")}
              title="Filtra: NC in scadenza entro 7 giorni"
            >
              <span className="nc-stat-num">{dueSoonCount}</span>
              <span className="nc-stat-label">In scadenza</span>
            </button>
          )}
          <button
            type="button"
            className={`nc-stat nc-stat-tot${activeCard === "total" ? " nc-stat-active" : ""}`}
            onClick={() => handleCardFilter("total")}
            title="Mostra tutte le NC"
          >
            <span className="nc-stat-num">{stats.total || 0}</span>
            <span className="nc-stat-label">Totale</span>
          </button>
        </div>
      )}

      <div className="nc-filters">
        {companies.length > 0 && (
          <select
            className="nc-filter-company"
            value={filters.company_id}
            onChange={e => handleFilter("company_id", e.target.value)}
          >
            <option value="">Tutti i clienti</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        <input
          type="search"
          className="nc-search"
          placeholder="Cerca per numero NC o descrizione..."
          value={searchNc}
          onChange={e => setSearchNc(e.target.value)}
        />

        <select value={filters.status} onChange={e => handleFilter("status", e.target.value)}>
          <option value="">Tutti gli stati</option>
          <option value="open">Aperte</option>
          <option value="in_progress">In corso</option>
          <option value="resolved">Risolte</option>
          <option value="verified">Verificate</option>
          <option value="closed">Chiuse</option>
        </select>

        <select value={filters.severity} onChange={e => handleFilter("severity", e.target.value)}>
          <option value="">Tutte le severit\u00E0</option>
          <option value="major">Grave</option>
          <option value="minor">Lieve</option>
          <option value="observation">Osservazione</option>
        </select>

        <select
          value={filters.overdue ? "overdue" : filters.due_within_days ? "due_soon" : ""}
          onChange={e => {
            const v = e.target.value;
            if (v === "overdue") handleFilter("overdue", "true");
            else if (v === "due_soon") handleFilter("due_within_days", "7");
            else {
              setFilters(f => ({ ...f, overdue: "", due_within_days: "" }));
              setPage(1);
            }
          }}
        >
          <option value="">Tutte le scadenze</option>
          <option value="overdue">Solo scadute</option>
          <option value="due_soon">In scadenza (7 gg)</option>
        </select>

        {hasActiveFilter && (
          <button type="button" className="btn-secondary btn-reset-filters" onClick={resetFilters}>
            Azzera filtri
          </button>
        )}
      </div>

      <section className="nc-grid-section" aria-label="Registro non conformit\u00E0">
        <SgqDataGrid
          rows={filteredList}
          columns={NC_GRID_COLUMNS}
          loading={loading}
          emptyMessage="Nessuna non conformit\u00E0 trovata con i filtri selezionati."
          theme="plain"
          renderCell={renderGridCell}
          getRowKey={row => row.nc_id}
          getSortValue={(row, colId) => {
            if (colId === "due_date") return row.due_date || "";
            if (colId === "status") return NC_STATUS_CFG[row.status]?.label || row.status;
            if (colId === "severity") return SEVERITY_CFG[row.severity]?.label || row.severity;
            if (colId === "source_type") return NC_SOURCE_TYPE_LABELS[row.source_type] || row.source_type;
            return row[colId] ?? "";
          }}
          rowClassName={gridRowClassName}
          selectable
          selectedRowKey={selectedNcId}
          onRowSelect={handleRowSelect}
        />
      </section>

      {selectedNc && (
        <section className="nc-detail-section" aria-label={`Dettaglio ${selectedNc.nc_number}`}>
          <h3 className="nc-detail-heading">
            {selectedNc.nc_number} — <NcStatusTag status={selectedNc.status} />
          </h3>
          <NcDetailPanel nc={selectedNc} onSaved={loadNc} />

          {(validNext[selectedNc.status] || []).length > 0 && (
            <div className="nc-workflow-btns">
              {(validNext[selectedNc.status] || []).map(ns => {
                const cfg = NC_WORKFLOW_CFG[ns] || { label: ns, statusBtn: "partial" };
                return (
                  <button
                    key={ns}
                    type="button"
                    className={`status-btn ${cfg.statusBtn}`}
                    onClick={() => handleStatusChange(selectedNc, ns)}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          )}

          <ActionsList ncId={selectedNc.nc_id} ncStatus={selectedNc.status} />
        </section>
      )}

      {totalPages > 1 && (
        <div className="nc-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{"\u2190 Prec"}</button>
          <span>Pagina {page} di {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{"Succ \u2192"}</button>
        </div>
      )}

      <NcCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
