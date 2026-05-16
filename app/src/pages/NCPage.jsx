/**
 * NCPage - Registro Non Conformità & Azioni Correttive
 * Sprint 5: vista cross-audit, workflow stati, azioni correttive strutturate
 * ISO 9001:2015 §8.7 + §10.2
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiService from "../services/apiService";
import { formatDate } from "../utils/dateHelpers";
import "./NCPage.css";

const NC_STATUS_CFG = {
  open:        { label: "Aperta",     cls: "nc-open",        icon: "🔴" },
  in_progress: { label: "In corso",   cls: "nc-in-progress", icon: "🟡" },
  resolved:    { label: "Risolta",    cls: "nc-resolved",    icon: "🟢" },
  verified:    { label: "Verificata", cls: "nc-verified",    icon: "✅" },
  closed:      { label: "Chiusa",     cls: "nc-closed",      icon: "⚫" },
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

function NcStatusTag({ status }) {
  const c = NC_STATUS_CFG[status] || { label: status, cls: "", icon: "" };
  return <span className={`nc-tag ${c.cls}`}>{c.icon} {c.label}</span>;
}

function SeverityTag({ severity }) {
  const c = SEVERITY_CFG[severity] || { label: severity, cls: "" };
  return <span className={`sev-tag ${c.cls}`}>{c.label}</span>;
}

// ── Componente azioni correttive ─────────────────────────────────────────────

function ActionsList({ ncId, ncStatus }) {
  const [actions, setActions]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ action_type: "corrective", description: "", responsible: "", due_date: "" });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

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
    } catch (err) {
      setError("Errore durante il salvataggio dell'azione.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(action, newStatus) {
    try {
      await apiService.updateNcAction(ncId, action.action_id, { status: newStatus });
      await load();
    } catch {
      alert("Impossibile aggiornare lo stato dell'azione.");
    }
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

  if (loading) return <p className="nc-loading">Caricamento azioni...</p>;

  return (
    <div className="nc-actions-panel">
      <div className="nc-actions-header">
        <h4>Azioni correttive ({actions.length})</h4>
        {!isClosed && (
          <button className="btn-add-action" onClick={() => setShowForm(v => !v)}>
            {showForm ? "✕ Annulla" : "+ Aggiungi azione"}
          </button>
        )}
      </div>

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
              required
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descrivi l'azione da intraprendere..."
            />
          </div>
          <div className="nc-form-row nc-form-row-2col">
            <div>
              <label>Responsabile</label>
              <input
                type="text"
                value={form.responsible}
                onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))}
                placeholder="Nome responsabile"
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
      ) : (
        <ul className="nc-actions-list">
          {actions.map(a => {
            const cfg = ACTION_STATUS_CFG[a.status] || { label: a.status, cls: "" };
            const nextSteps = {
              open:        ["in_progress"],
              in_progress: ["completed"],
              completed:   ["verified"],
              verified:    [],
            };
            return (
              <li key={a.action_id} className={`nc-action-item ${cfg.cls}`}>
                <div className="nc-action-top">
                  <span className={`act-type-badge at-${a.action_type}`}>
                    {a.action_type === "immediate" ? "Immediata" : a.action_type === "corrective" ? "Correttiva" : "Preventiva"}
                  </span>
                  <span className={`act-status ${cfg.cls}`}>{cfg.label}</span>
                  <span className="nc-action-date">{formatDate(a.created_at)}</span>
                </div>
                <p className="nc-action-desc">{a.description}</p>
                {(a.responsible || a.due_date) && (
                  <div className="nc-action-meta">
                    {a.responsible && <span>👤 {a.responsible}</span>}
                    {a.due_date && <span>📅 Scadenza: {formatDate(a.due_date)}</span>}
                    {a.completed_at && <span>✅ Completata: {formatDate(a.completed_at)}</span>}
                  </div>
                )}
                {!isClosed && (
                  <div className="nc-action-btns">
                    {(nextSteps[a.status] || []).map(ns => {
                      const labels = { in_progress: "Avvia", completed: "Completa", verified: "Verifica" };
                      return (
                        <button key={ns} className="btn-action-status" onClick={() => handleStatus(a, ns)}>
                          {labels[ns] || ns}
                        </button>
                      );
                    })}
                    {a.status === "open" && (
                      <button className="btn-action-del" onClick={() => handleDelete(a)}>Elimina</button>
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

// ── Pagina principale ────────────────────────────────────────────────────────

export default function NCPage() {
  const [ncList, setNcList]         = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  // Filtri server-side
  const [filters, setFilters] = useState({ status: "", severity: "", overdue: "", company_id: "" });
  const [page, setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Filtro locale per numero NC (ricerca testuale istantanea)
  const [searchNc, setSearchNc] = useState("");
  // Lista clienti per il dropdown
  const [companies, setCompanies] = useState([]);

  const LIMIT = 20;

  // Carica aziende una volta sola al mount
  useEffect(() => {
    apiService.getCompanies()
      .then(res => setCompanies(res?.data || []))
      .catch(() => setCompanies([]));
  }, []);

  const loadNc = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filters.status)     params.status     = filters.status;
      if (filters.severity)   params.severity   = filters.severity;
      if (filters.overdue)    params.overdue    = filters.overdue;
      if (filters.company_id) params.company_id = filters.company_id;

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

  // Filtro locale per numero NC: istantaneo, senza round-trip al server
  const filteredList = useMemo(() => {
    if (!searchNc.trim()) return ncList;
    const q = searchNc.trim().toLowerCase();
    return ncList.filter(nc =>
      (nc.nc_number || "").toLowerCase().includes(q) ||
      (nc.description || "").toLowerCase().includes(q)
    );
  }, [ncList, searchNc]);

  function handleFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val }));
    setPage(1);
    setExpandedId(null);
  }

  function resetFilters() {
    setFilters({ status: "", severity: "", overdue: "", company_id: "" });
    setSearchNc("");
    setPage(1);
    setExpandedId(null);
  }

  async function handleStatusChange(nc, newStatus) {
    try {
      await apiService.updateNcStatus(nc.nc_id, { status: newStatus });
      await loadNc();
    } catch {
      alert("Impossibile aggiornare lo stato della NC.");
    }
  }

  const openCount    = stats?.open     ?? 0;
  const inProgCount  = stats?.in_progress ?? 0;
  const overdueCount = stats?.overdue  ?? 0;

  // Determina quale card è attiva per evidenziarla
  function getActiveCard() {
    if (filters.overdue === "true") return "overdue";
    if (filters.status === "open")        return "open";
    if (filters.status === "in_progress") return "in_progress";
    if (!filters.status && !filters.overdue) return "total";
    return null;
  }

  function handleCardFilter(card) {
    const active = getActiveCard();
    if (active === card) {
      setFilters(f => ({ ...f, status: "", overdue: "" }));
      setPage(1);
      return;
    }
    if (card === "open")        setFilters(f => ({ ...f, status: "open",        overdue: "" }));
    if (card === "in_progress") setFilters(f => ({ ...f, status: "in_progress", overdue: "" }));
    if (card === "overdue")     setFilters(f => ({ ...f, status: "",             overdue: "true" }));
    if (card === "total")       setFilters(f => ({ ...f, status: "",             overdue: "" }));
    setPage(1);
    setExpandedId(null);
  }

  const activeCard = getActiveCard();
  const hasActiveFilter = !!(filters.status || filters.severity || filters.overdue || filters.company_id || searchNc);

  return (
    <div className="nc-page">
      <div className="nc-page-header">
        <h1>🚨 Non Conformità &amp; Azioni Correttive</h1>
        <p className="nc-page-sub">ISO 9001:2015 §8.7 + §10.2 - Registro cross-audit</p>
      </div>

      {/* Stats bar - ogni card è un pulsante filtro */}
      {stats && (
        <div className="nc-stats-bar">
          <button
            className={`nc-stat nc-stat-open${activeCard === "open" ? " nc-stat-active" : ""}`}
            onClick={() => handleCardFilter("open")}
            title="Filtra: solo NC aperte"
          >
            <span className="nc-stat-num">{openCount}</span>
            <span className="nc-stat-label">Aperte</span>
          </button>
          <button
            className={`nc-stat nc-stat-prog${activeCard === "in_progress" ? " nc-stat-active" : ""}`}
            onClick={() => handleCardFilter("in_progress")}
            title="Filtra: solo NC in corso"
          >
            <span className="nc-stat-num">{inProgCount}</span>
            <span className="nc-stat-label">In corso</span>
          </button>
          <button
            className={`nc-stat nc-stat-over${activeCard === "overdue" ? " nc-stat-active" : ""}`}
            onClick={() => handleCardFilter("overdue")}
            title="Filtra: solo NC scadute"
          >
            <span className="nc-stat-num">{overdueCount}</span>
            <span className="nc-stat-label">Scadute</span>
          </button>
          <button
            className={`nc-stat nc-stat-tot${activeCard === "total" ? " nc-stat-active" : ""}`}
            onClick={() => handleCardFilter("total")}
            title="Mostra tutte le NC"
          >
            <span className="nc-stat-num">{stats.total || 0}</span>
            <span className="nc-stat-label">Totale</span>
          </button>
        </div>
      )}

      {/* Filtri */}
      <div className="nc-filters">
        {/* Filtro cliente - primo nella barra per dare priorità visiva */}
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

        {/* Ricerca per numero NC */}
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
          <option value="">Tutte le severità</option>
          <option value="major">Grave</option>
          <option value="minor">Lieve</option>
          <option value="observation">Osservazione</option>
        </select>

        <select value={filters.overdue} onChange={e => handleFilter("overdue", e.target.value)}>
          <option value="">Tutte</option>
          <option value="true">Solo scadute</option>
        </select>

        {hasActiveFilter && (
          <button className="btn-reset-filters" onClick={resetFilters}>
            Azzera filtri
          </button>
        )}
      </div>

      {/* Lista NC */}
      {loading ? (
        <div className="nc-loading-main">Caricamento...</div>
      ) : filteredList.length === 0 ? (
        <div className="nc-empty">
          <p>Nessuna non conformità trovata con i filtri selezionati.</p>
        </div>
      ) : (
        <div className="nc-list">
          {filteredList.map(nc => {
            const isExpanded = expandedId === nc.nc_id;
            const isOverdue  = nc.is_overdue === 1 || nc.is_overdue === true;
            const validNext  = {
              open:        ["in_progress"],
              in_progress: ["resolved"],
              resolved:    ["verified"],
              verified:    ["closed"],
              closed:      [],
            };

            return (
              <div key={nc.nc_id} className={`nc-card${isOverdue ? " nc-overdue" : ""}${isExpanded ? " nc-expanded" : ""}`}>
                <div className="nc-card-header" onClick={() => setExpandedId(prev => prev === nc.nc_id ? null : nc.nc_id)}>
                  <div className="nc-card-title">
                    <span className="nc-number">{nc.nc_number}</span>
                    <NcStatusTag status={nc.status} />
                    <SeverityTag severity={nc.severity} />
                    {isOverdue && <span className="nc-overdue-badge">⚠️ Scaduta</span>}
                  </div>
                  <div className="nc-card-meta">
                    <span className="nc-audit-ref">📋 {nc.audit_number} - {nc.client_name}</span>
                    <span className="nc-section">{nc.section_title}</span>
                    {nc.due_date && <span className="nc-due">📅 {formatDate(nc.due_date)}</span>}
                  </div>
                  <span className="nc-expand-arrow">{isExpanded ? "▲" : "▼"}</span>
                </div>

                {isExpanded && (
                  <div className="nc-card-body">
                    <div className="nc-description">
                      <strong>Descrizione:</strong>
                      <p>{nc.description}</p>
                    </div>
                    {nc.corrective_action && (
                      <div className="nc-corrective-note">
                        <strong>Nota azione (legacy):</strong>
                        <p>{nc.corrective_action}</p>
                      </div>
                    )}
                    {nc.responsible_person && (
                      <p className="nc-responsible">
                        👤 Responsabile: <strong>{nc.responsible_person}</strong>
                      </p>
                    )}

                    {/* Workflow buttons */}
                    {(validNext[nc.status] || []).length > 0 && (
                      <div className="nc-workflow-btns">
                        {(validNext[nc.status] || []).map(ns => {
                          const labels = {
                            in_progress: "Avvia lavorazione",
                            resolved:    "Segna come risolta",
                            verified:    "Verifica",
                            closed:      "Chiudi NC",
                          };
                          return (
                            <button key={ns} className="btn-nc-workflow" onClick={() => handleStatusChange(nc, ns)}>
                              {labels[ns] || ns}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Azioni correttive strutturate */}
                    <ActionsList ncId={nc.nc_id} ncStatus={nc.status} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Paginazione */}
      {totalPages > 1 && (
        <div className="nc-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prec</button>
          <span>Pagina {page} di {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Succ →</button>
        </div>
      )}
    </div>
  );
}
