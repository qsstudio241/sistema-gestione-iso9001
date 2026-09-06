/**
 * NCPage - Registro Non Conformità & Azioni Correttive
 * NC Fase 1: griglia SgqDataGrid, creazione manuale, filtri scadenze
 * ISO 9001:2015 §8.7 + §10.2
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiService from "../services/apiService";
import { useRouter } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import NcDetailPanel from "../components/NcDetailPanel";
import NcCreateModal from "../components/NcCreateModal";
import SgqDataGrid from "../components/SgqDataGrid";
import { formatDate } from "../utils/dateHelpers";
import { NC_SOURCE_TYPE_LABELS, NC_SOURCE_CATEGORIES, NC_SOURCE_CATEGORY_OPTIONS } from "../utils/ncCreateHelpers";
import { downloadNcCsv } from "../utils/ncExportHelpers";
import { exportNcToWord } from "../utils/ncWordExport";
import {
  canTransitionNcStatus,
  canReopenNc,
  getNcDisplayStatus,
} from "../utils/ncWorkflow";
import useNcDrawerWidth, {
  NC_DRAWER_WIDTH_MIN,
  getNcDrawerMaxWidth,
} from "../hooks/useNcDrawerWidth";
import "../components/ChecklistModule.css";
import "../components/DocumentDetailPanel.css";
import "./NCPage.css";

const NC_STATUS_CFG = {
  open:   { label: "Aperta", cls: "nc-open",   icon: "\uD83D\uDD34" },
  closed: { label: "Chiusa", cls: "nc-closed", icon: "\u26AB" },
};

const SEVERITY_CFG = {
  major:       { label: "Grave",        cls: "sev-major" },
  minor:       { label: "Lieve",        cls: "sev-minor" },
  observation: { label: "Osservazione", cls: "sev-obs" },
};

const NC_GRID_COLUMNS = [
  { id: "nc_number", label: "N\u00B0 NC", sortable: true },
  { id: "status", label: "Stato", sortable: true },
  { id: "severity", label: "Severit\u00E0", sortable: true },
  { id: "client_name", label: "Cliente", sortable: true },
  { id: "project_code", label: "Commessa", sortable: true },
  { id: "audit_number", label: "Audit", sortable: true },
  { id: "due_date", label: "Scadenza", sortable: true },
  { id: "source_type", label: "Origine", sortable: true },
];

function NcStatusTag({ status }) {
  const display = getNcDisplayStatus(status);
  const c = NC_STATUS_CFG[display] || { label: display, cls: "", icon: "" };
  return <span className={`nc-tag ${c.cls}`}>{c.icon} {c.label}</span>;
}

function SeverityTag({ severity }) {
  const c = SEVERITY_CFG[severity] || { label: severity, cls: "" };
  return <span className={`sev-tag ${c.cls}`}>{c.label}</span>;
}

export default function NCPage() {
  const { replace } = useRouter();
  const { user } = useAuth();
  const { companyId } = useCompanyScope();
  const [ncList, setNcList]         = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [selectedNcId, setSelectedNcId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDefaultCategory, setCreateDefaultCategory] = useState("audit");
  const [viewMode, setViewMode] = useState("nc");
  const [dueActions, setDueActions] = useState([]);
  const [dueActionsLoading, setDueActionsLoading] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportWordError, setExportWordError] = useState(null);
  const [filters, setFilters] = useState({
    status: "",
    severity: "",
    overdue: "",
    due_within_days: "",
    company_id: companyId || "",
    source_category: "",
  });
  const [page, setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchNc, setSearchNc] = useState("");

  const LIMIT = 20;
  const { width: drawerWidth, startResize: startDrawerResize } = useNcDrawerWidth();

  useEffect(() => {
    setFilters((f) => (f.company_id === (companyId || "") ? f : { ...f, company_id: companyId || "" }));
  }, [companyId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selectId = params.get("select");
    if (selectId) {
      const id = parseInt(selectId, 10);
      if (!Number.isNaN(id)) {
        setSelectedNcId(id);
        setViewMode("nc");
      }
    }
    // Deep-link filtro stato (es. Assistente AI → /nc?status=open)
    const status = params.get("status");
    if (status === "open" || status === "closed") {
      setFilters((f) => ({ ...f, status, overdue: "", due_within_days: "" }));
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
      if (filters.source_category)  params.source_category  = filters.source_category;

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

  const loadDueActions = useCallback(async () => {
    setDueActionsLoading(true);
    try {
      const res = await apiService.getAggregateDueNcActions({ due_within_days: 30, overdue: "true" });
      setDueActions(res?.data || []);
    } catch {
      setDueActions([]);
    } finally {
      setDueActionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === "actions_due") loadDueActions();
  }, [viewMode, loadDueActions]);

  const isRq = canReopenNc(user);

  function handleExportCsv() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadNcCsv(`registro-nc-${stamp}.csv`, filteredList);
  }

  async function handleExportWord(nc) {
    if (!nc?.nc_id) return;
    setExportingWord(true);
    setExportWordError(null);
    try {
      await exportNcToWord(nc.nc_id, apiService);
    } catch {
      setExportWordError("Impossibile generare il documento Word. Riprovare.");
    } finally {
      setExportingWord(false);
    }
  }

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
    setFilters({ status: "", severity: "", overdue: "", due_within_days: "", company_id: companyId || "", source_category: "" });
    setSearchNc("");
    setPage(1);
    setSelectedNcId(null);
    replace("/nc");
  }

  function handleRowSelect(rowKey, row) {
    const id = rowKey ?? row?.nc_id ?? null;
    setSelectedNcId(id);
    replace(id ? `/nc?select=${id}` : "/nc");
  }

  function handleCloseDetail() {
    setSelectedNcId(null);
    setExportWordError(null);
    replace("/nc");
  }

  async function handleStatusChange(nc, newStatus) {
    const gate = canTransitionNcStatus(nc, newStatus);
    if (!gate.ok) {
      alert(gate.message);
      return;
    }
    let reopenReason;
    if (nc.status === "closed" && newStatus === "open") {
      if (!window.confirm(`Riaprire ${nc.nc_number}? La NC torner\u00E0 Aperta e andr\u00E0 ricompilata/verificata prima di una nuova chiusura.`)) {
        return;
      }
      const prompted = window.prompt("Motivo riapertura (opzionale, tracciato in note verifica):", "");
      if (prompted === null) return;
      reopenReason = prompted.trim() || undefined;
    }
    if (newStatus === "closed") {
      if (!window.confirm(`Chiudere ${nc.nc_number}? La verifica con il responsabile indicato sar\u00E0 l'atto formale di chiusura.`)) {
        return;
      }
    }
    try {
      await apiService.updateNcStatus(nc.nc_id, {
        status: newStatus,
        ...(reopenReason !== undefined ? { reopen_reason: reopenReason } : {}),
      });
      await loadNc();
    } catch (err) {
      alert(err?.message || "Impossibile aggiornare lo stato della NC.");
    }
  }

  function openCreateWith(category) {
    setCreateDefaultCategory(category);
    setShowCreateModal(true);
  }

  function handleCreated() {
    setShowCreateModal(false);
    loadNc();
  }

  // "Aperte" = tutte le non chiuse (include stati legacy in_progress/resolved/verified)
  const openCount = Number(stats?.open_like ?? (
    (Number(stats?.open) || 0)
    + (Number(stats?.in_progress) || 0)
    + (Number(stats?.resolved) || 0)
    + (Number(stats?.verified) || 0)
  ));
  const overdueCount = stats?.overdue  ?? 0;
  const dueSoonCount = stats?.due_soon ?? 0;

  function getActiveCard() {
    if (filters.overdue === "true") return "overdue";
    if (filters.due_within_days === "7") return "due_soon";
    if (filters.status === "open") return "open";
    if (filters.status === "closed") return "closed";
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
    if (card === "open")     setFilters(f => ({ ...f, status: "open",   overdue: "", due_within_days: "" }));
    if (card === "closed")   setFilters(f => ({ ...f, status: "closed", overdue: "", due_within_days: "" }));
    if (card === "overdue")  setFilters(f => ({ ...f, status: "",       overdue: "true", due_within_days: "" }));
    if (card === "due_soon") setFilters(f => ({ ...f, status: "",       overdue: "", due_within_days: "7" }));
    if (card === "total")    setFilters(f => ({ ...f, status: "",       overdue: "", due_within_days: "" }));
    setPage(1);
    setSelectedNcId(null);
  }

  const activeCard = getActiveCard();
  const hasActiveFilter = !!(
    filters.status || filters.severity || filters.overdue
    || filters.due_within_days || filters.company_id || filters.source_category || searchNc
  );

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
      case "source_type": {
        const catCfg = NC_SOURCE_CATEGORIES[row.source_category];
        if (catCfg) {
          return (
            <span className={`nc-cat-badge nc-cat-${row.source_category}`}>
              {catCfg.icon} {catCfg.label}
            </span>
          );
        }
        return NC_SOURCE_TYPE_LABELS[row.source_type] || row.source_type || "\u2014";
      }
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
          <h1>{"\uD83D\uDEA8 Piano Azioni & Non Conformit\u00E0"}</h1>
          <p className="nc-page-sub">{"ISO 9001:2015 \u00A76.1 + \u00A79.3 + \u00A710.2 + \u00A710.3 \u2014 Registro cross-fonte"}</p>
        </div>
        <div className="nc-page-header-actions">
          <button
            type="button"
            className={`btn-secondary${viewMode === "actions_due" ? " nc-view-active" : ""}`}
            onClick={() => setViewMode(v => v === "actions_due" ? "nc" : "actions_due")}
          >
            {viewMode === "actions_due" ? "Registro NC" : "Azioni in scadenza"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportCsv}
            disabled={!filteredList.length}
            title="Esporta il registro NC filtrato in CSV (Excel)"
          >
            Export CSV
          </button>
          <button type="button" className="btn-primary" onClick={() => openCreateWith("audit")}>
            + Nuova azione / NC
          </button>
        </div>
      </div>

      {/* ── Shortcuts azione rapida (Slice 3) ─────────────────────── */}
      <div className="nc-shortcuts-bar" role="group" aria-label="Crea azione rapida">
        <span style={{ fontSize: "0.75rem", color: "#718096", alignSelf: "center", marginRight: 4 }}>
          Crea azione da:
        </span>
        {[
          { cat: "audit",            label: "Audit interno" },
          { cat: "management_review",label: "Riesame Direzione" },
          { cat: "risk_action",      label: "Analisi rischi" },
          { cat: "improvement",      label: "Miglioramento" },
          { cat: "complaint",        label: "Reclamo" },
          { cat: "operational",      label: "Rilievo operativo" },
          { cat: "external_audit",   label: "Audit esterno" },
        ].map(({ cat, label }) => {
          const cfg = NC_SOURCE_CATEGORIES[cat];
          return (
            <button
              key={cat}
              type="button"
              className="nc-shortcut-btn"
              onClick={() => openCreateWith(cat)}
              title={`Nuova azione — ${cfg.label} (${cfg.iso})`}
            >
              {cfg.icon} {label}
            </button>
          );
        })}
      </div>

      {stats && (
        <div className="nc-stats-bar">
          <button
            type="button"
            className={`nc-stat nc-stat-open${activeCard === "open" ? " nc-stat-active" : ""}`}
            onClick={() => handleCardFilter("open")}
            title="Filtra: solo NC aperte (non chiuse)"
          >
            <span className="nc-stat-num">{openCount}</span>
            <span className="nc-stat-label">Aperte</span>
          </button>
          <button
            type="button"
            className={`nc-stat nc-stat-closed${activeCard === "closed" ? " nc-stat-active" : ""}`}
            onClick={() => handleCardFilter("closed")}
            title="Filtra: solo NC chiuse"
          >
            <span className="nc-stat-num">{stats.closed || 0}</span>
            <span className="nc-stat-label">Chiuse</span>
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
          <button
            type="button"
            className={`nc-stat nc-stat-soon${activeCard === "due_soon" ? " nc-stat-active" : ""}`}
            onClick={() => handleCardFilter("due_soon")}
            title="Filtra: NC in scadenza entro 7 giorni"
          >
            <span className="nc-stat-num">{dueSoonCount}</span>
            <span className="nc-stat-label">In scadenza</span>
          </button>
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

      {stats && Array.isArray(stats.by_category) && stats.by_category.length > 0 && (
        <div className="nc-stats-breakdown">
          <button
            type="button"
            className="nc-stats-breakdown-toggle"
            onClick={() => setShowBreakdown(p => !p)}
          >
            {showBreakdown ? "\u25B2" : "\u25BC"} Per origine
          </button>
          {showBreakdown && (
            <div className="nc-stats-breakdown-list">
              {stats.by_category.map(({ source_category, open_count, total }) => {
                const cfg = NC_SOURCE_CATEGORIES[source_category];
                const label = cfg ? `${cfg.icon} ${cfg.label}` : source_category;
                return (
                  <div key={source_category} className="nc-stats-breakdown-item">
                    <span className="nc-stats-breakdown-label">{label}</span>
                    <span className="nc-stats-breakdown-counts">{open_count} aperte / {total} totali</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="nc-filters">
        <input
          type="search"
          className="nc-search"
          placeholder="Cerca per numero NC o descrizione..."
          value={searchNc}
          onChange={e => setSearchNc(e.target.value)}
        />

        <select value={filters.severity} onChange={e => handleFilter("severity", e.target.value)}>
          <option value="">Tutte le severit{"\u00E0"}</option>
          <option value="major">Grave</option>
          <option value="minor">Lieve</option>
          <option value="observation">Osservazione</option>
        </select>

        <select
          value={filters.source_category}
          onChange={e => handleFilter("source_category", e.target.value)}
          title="Filtra per categoria origine"
        >
          <option value="">Tutte le origini</option>
          {Object.entries(NC_SOURCE_CATEGORIES).map(([val, cfg]) => (
            <option key={val} value={val}>{cfg.icon} {cfg.label}</option>
          ))}
        </select>

        {hasActiveFilter && (
          <button type="button" className="btn-secondary btn-reset-filters" onClick={resetFilters}>
            Azzera filtri
          </button>
        )}
      </div>

      <section className="nc-grid-section" aria-label="Registro non conformità">
        {viewMode === "actions_due" ? (
          <div className="nc-due-actions-panel">
            <h3>Azioni correttive in scadenza (30 gg) o scadute</h3>
            {dueActionsLoading && <p>Caricamento...</p>}
            {!dueActionsLoading && dueActions.length === 0 && (
              <p className="nc-empty-hint">Nessuna azione in scadenza.</p>
            )}
            {!dueActionsLoading && dueActions.length > 0 && (
              <ul className="nc-due-actions-list">
                {dueActions.map(a => (
                  <li key={a.action_id} className={a.is_overdue ? "nc-due-overdue" : ""}>
                    <a
                      href="#"
                      className="nc-due-link"
                      onClick={e => { e.preventDefault(); setSelectedNcId(a.nc_id); setViewMode("nc"); }}
                    >
                      <strong>{a.nc_number}</strong> — {a.description?.slice(0, 120)}
                    </a>
                    <span className="nc-due-meta">
                      {a.responsible || "—"} · scadenza {a.due_date ? formatDate(a.due_date) : "—"}
                      {a.is_overdue ? " · SCADUTA" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
        <SgqDataGrid
          rows={filteredList}
          columns={NC_GRID_COLUMNS}
          loading={loading}
          emptyMessage="Nessuna non conformità trovata con i filtri selezionati."
          theme="plain"
          renderCell={renderGridCell}
          getRowKey={row => row.nc_id}
          getSortValue={(row, colId) => {
            if (colId === "due_date") return row.due_date || "";
            if (colId === "status") {
              const d = getNcDisplayStatus(row.status);
              return NC_STATUS_CFG[d]?.label || d;
            }
            if (colId === "severity") return SEVERITY_CFG[row.severity]?.label || row.severity;
            if (colId === "source_type") return NC_SOURCE_TYPE_LABELS[row.source_type] || row.source_type;
            return row[colId] ?? "";
          }}
          rowClassName={gridRowClassName}
          selectable
          selectedRowKey={selectedNcId}
          onRowSelect={handleRowSelect}
        />
        )}
      </section>

      {selectedNc && viewMode === "nc" && (
        <div className="doc-detail__overlay nc-detail-overlay" onClick={handleCloseDetail} role="presentation">
          <aside
            className="doc-detail nc-detail-drawer"
            style={{ width: drawerWidth, maxWidth: drawerWidth }}
            onClick={(e) => e.stopPropagation()}
            role="complementary"
            aria-label={`Dettaglio ${selectedNc.nc_number}`}
          >
            <div
              className="nc-detail-drawer-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Ridimensiona pannello NC"
              aria-valuenow={drawerWidth}
              aria-valuemin={NC_DRAWER_WIDTH_MIN}
              aria-valuemax={getNcDrawerMaxWidth()}
              onMouseDown={startDrawerResize}
            />
            <div className="doc-detail__header">
              <div className="doc-detail__header-top">
                <h2 className="doc-detail__title nc-detail-drawer-title">
                  {selectedNc.nc_number}
                  {" "}
                  <NcStatusTag status={selectedNc.status} />
                </h2>
                <div className="nc-detail-header-actions">
                  <button
                    type="button"
                    className="btn-secondary nc-export-word-btn"
                    onClick={() => handleExportWord(selectedNc)}
                    disabled={exportingWord}
                    title="Scarica scheda NC in formato Word per archiviazione"
                  >
                    {exportingWord ? "Generazione..." : "Scarica Word"}
                  </button>
                  <button
                    type="button"
                    className="doc-detail__close"
                    onClick={handleCloseDetail}
                    aria-label="Chiudi dettaglio NC"
                  >
                    {"\u2715"}
                  </button>
                </div>
              </div>
              {exportWordError && (
                <p className="nc-error nc-export-error nc-detail-header-export-error">{exportWordError}</p>
              )}
            </div>

            <div className="doc-detail__body nc-detail-drawer-body">
              <NcDetailPanel
                nc={selectedNc}
                onSaved={loadNc}
                readOnly={selectedNc.status === "closed"}
                onStatusChange={(newStatus) => handleStatusChange(selectedNc, newStatus)}
                isRq={isRq}
              />
            </div>
          </aside>
        </div>
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
        defaultCategory={createDefaultCategory}
      />
    </div>
  );
}
