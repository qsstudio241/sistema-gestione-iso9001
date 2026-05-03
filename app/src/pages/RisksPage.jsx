/**
 * RisksPage — Registro Rischi & Obiettivi ISO 9001 §6.1 + §6.2
 * Sprint 6: matrice rischio (prob×impatto), CRUD rischi, CRUD obiettivi con progress bar
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { formatDate } from "../utils/dateHelpers";
import "./RisksPage.css";

function scoreColor(score) {
  if (score >= 7) return "risk-high";
  if (score >= 4) return "risk-medium";
  return "risk-low";
}

const TREATMENT_LABEL = {
  accept:   "Accetta",
  mitigate: "Mitiga",
  transfer: "Trasferisci",
  avoid:    "Evita",
};

const RISK_STATUS_CFG = {
  open:         { label: "Aperto",         cls: "rs-open" },
  in_treatment: { label: "In trattamento", cls: "rs-treat" },
  mitigated:    { label: "Mitigato",       cls: "rs-miti" },
  closed:       { label: "Chiuso",         cls: "rs-closed" },
};

const OBJ_STATUS_CFG = {
  active:    { label: "Attivo",     cls: "os-active" },
  achieved:  { label: "Raggiunto",  cls: "os-achieved" },
  paused:    { label: "In pausa",   cls: "os-paused" },
  cancelled: { label: "Annullato",  cls: "os-cancelled" },
};

const PROB_LABELS = { 1: "Bassa", 2: "Media", 3: "Alta" };
const IMP_LABELS  = { 1: "Basso", 2: "Medio", 3: "Alto" };

// ── Modali form ──────────────────────────────────────────────────────────────

const EMPTY_RISK = { title: "", description: "", context: "internal", category: "", probability: 2, impact: 2, treatment: "mitigate", treatment_desc: "", responsible: "", review_date: "", status: "open" };
const EMPTY_OBJ  = { title: "", description: "", iso_clause: "", kpi_description: "", target_value: "", current_value: "", progress_pct: 0, responsible: "", due_date: "", status: "active" };

function RiskForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_RISK, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const score = form.probability * form.impact;

  function upd(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true); setError(null);
    try { await onSave(form); onClose(); }
    catch { setError("Errore durante il salvataggio."); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial?.risk_id ? "Modifica rischio" : "Nuovo rischio"}</h3>
          <button className="modal-close" onClick={onClose}>\u2715</button>
        </div>
        <form className="risk-form" onSubmit={submit}>
          <div className="form-row">
            <label>Titolo *</label>
            <input required value={form.title} onChange={e => upd("title", e.target.value)} placeholder="Titolo del rischio" />
          </div>
          <div className="form-row">
            <label>Descrizione</label>
            <textarea rows={2} value={form.description} onChange={e => upd("description", e.target.value)} />
          </div>
          <div className="form-row-3col">
            <div>
              <label>Contesto</label>
              <select value={form.context} onChange={e => upd("context", e.target.value)}>
                <option value="internal">Interno</option>
                <option value="external">Esterno</option>
                <option value="interested_party">Parte interessata</option>
              </select>
            </div>
            <div>
              <label>Categoria</label>
              <input value={form.category} onChange={e => upd("category", e.target.value)} placeholder="es. operativo" />
            </div>
            <div>
              <label>Responsabile</label>
              <input value={form.responsible} onChange={e => upd("responsible", e.target.value)} />
            </div>
          </div>
          <div className="form-row-3col">
            <div>
              <label>Probabilit\u00e0</label>
              <select value={form.probability} onChange={e => upd("probability", parseInt(e.target.value))}>
                {[1,2,3].map(v => <option key={v} value={v}>{v} — {PROB_LABELS[v]}</option>)}
              </select>
            </div>
            <div>
              <label>Impatto</label>
              <select value={form.impact} onChange={e => upd("impact", parseInt(e.target.value))}>
                {[1,2,3].map(v => <option key={v} value={v}>{v} — {IMP_LABELS[v]}</option>)}
              </select>
            </div>
            <div className="score-preview">
              <label>Score</label>
              <span className={`score-badge ${scoreColor(score)}`}>{score}</span>
            </div>
          </div>
          <div className="form-row-2col">
            <div>
              <label>Trattamento</label>
              <select value={form.treatment} onChange={e => upd("treatment", e.target.value)}>
                {Object.entries(TREATMENT_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label>Stato</label>
              <select value={form.status} onChange={e => upd("status", e.target.value)}>
                {Object.entries(RISK_STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <label>Azione di trattamento</label>
            <textarea rows={2} value={form.treatment_desc} onChange={e => upd("treatment_desc", e.target.value)} placeholder="Descrivi l'azione di trattamento..." />
          </div>
          <div className="form-row-2col">
            <div>
              <label>Data revisione</label>
              <input type="date" value={form.review_date} onChange={e => upd("review_date", e.target.value)} />
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Salvataggio..." : "Salva"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ObjectiveForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_OBJ, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  function upd(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true); setError(null);
    try { await onSave(form); onClose(); }
    catch { setError("Errore durante il salvataggio."); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial?.objective_id ? "Modifica obiettivo" : "Nuovo obiettivo"}</h3>
          <button className="modal-close" onClick={onClose}>\u2715</button>
        </div>
        <form className="risk-form" onSubmit={submit}>
          <div className="form-row">
            <label>Titolo *</label>
            <input required value={form.title} onChange={e => upd("title", e.target.value)} placeholder="Titolo obiettivo" />
          </div>
          <div className="form-row-3col">
            <div>
              <label>Clausola ISO</label>
              <input value={form.iso_clause} onChange={e => upd("iso_clause", e.target.value)} placeholder="es. 6.2" />
            </div>
            <div>
              <label>Responsabile</label>
              <input value={form.responsible} onChange={e => upd("responsible", e.target.value)} />
            </div>
            <div>
              <label>Scadenza</label>
              <input type="date" value={form.due_date} onChange={e => upd("due_date", e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label>Indicatore (KPI)</label>
            <textarea rows={2} value={form.kpi_description} onChange={e => upd("kpi_description", e.target.value)} placeholder="Come si misura il raggiungimento?" />
          </div>
          <div className="form-row-3col">
            <div>
              <label>Valore target</label>
              <input value={form.target_value} onChange={e => upd("target_value", e.target.value)} placeholder="es. 95%" />
            </div>
            <div>
              <label>Valore attuale</label>
              <input value={form.current_value} onChange={e => upd("current_value", e.target.value)} placeholder="es. 82%" />
            </div>
            <div>
              <label>Avanzamento ({form.progress_pct}%)</label>
              <input type="range" min={0} max={100} value={form.progress_pct} onChange={e => upd("progress_pct", parseInt(e.target.value))} />
            </div>
          </div>
          <div className="form-row-2col">
            <div>
              <label>Stato</label>
              <select value={form.status} onChange={e => upd("status", e.target.value)}>
                {Object.entries(OBJ_STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Salvataggio..." : "Salva"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab Rischi ────────────────────────────────────────────────────────────────

function RisksTab() {
  const [list, setList]         = useState([]);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // null | { mode:'new'|'edit', data }
  const [filterStatus, setFS]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const [listRes, statsRes] = await Promise.all([
        apiService.getRisks(params),
        apiService.getRisksStats(),
      ]);
      setList(listRes.data?.data || []);
      setStats(statsRes.data?.data || null);
    } finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form) {
    if (modal.data?.risk_id) {
      await apiService.updateRisk(modal.data.risk_id, form);
    } else {
      await apiService.createRisk(form);
    }
    await load();
  }

  async function handleDelete(r) {
    if (!window.confirm(`Eliminare il rischio "${r.title}"?`)) return;
    await apiService.deleteRisk(r.risk_id);
    await load();
  }

  return (
    <div className="risks-tab">
      {/* Stats */}
      {stats && (
        <div className="stats-bar">
          <div className="stat-item"><span className="stat-num">{stats.total}</span><span className="stat-lbl">Totale</span></div>
          <div className="stat-item stat-open"><span className="stat-num">{stats.open}</span><span className="stat-lbl">Aperti</span></div>
          <div className="stat-item stat-treat"><span className="stat-num">{stats.in_treatment}</span><span className="stat-lbl">In trattamento</span></div>
          <div className="stat-item stat-high"><span className="stat-num">{stats.high_priority}</span><span className="stat-lbl">Alta priorit\u00e0</span></div>
        </div>
      )}

      {/* Toolbar */}
      <div className="tab-toolbar">
        <select value={filterStatus} onChange={e => { setFS(e.target.value); }}>
          <option value="">Tutti gli stati</option>
          {Object.entries(RISK_STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setModal({ mode: "new", data: null })}>+ Nuovo rischio</button>
      </div>

      {/* Lista */}
      {loading ? <p className="loading-msg">Caricamento...</p> : list.length === 0 ? (
        <div className="empty-state"><p>Nessun rischio registrato. Clicca "+ Nuovo rischio" per iniziare.</p></div>
      ) : (
        <div className="risk-list">
          {list.map(r => {
            const sc = r.probability * r.impact;
            const statusCfg = RISK_STATUS_CFG[r.status] || { label: r.status, cls: "" };
            return (
              <div key={r.risk_id} className={`risk-card ${scoreColor(sc)}-border`}>
                <div className="risk-card-top">
                  <div className="risk-card-title">
                    <span className={`score-badge ${scoreColor(sc)}`}>{sc}</span>
                    <strong>{r.title}</strong>
                    {r.category && <span className="risk-cat">{r.category}</span>}
                  </div>
                  <div className="risk-card-actions">
                    <span className={`status-tag ${statusCfg.cls}`}>{statusCfg.label}</span>
                    <button className="btn-icon" onClick={() => setModal({ mode: "edit", data: r })} title="Modifica">\u270F\uFE0F</button>
                    <button className="btn-icon btn-del" onClick={() => handleDelete(r)} title="Elimina">\uD83D\uDDD1\uFE0F</button>
                  </div>
                </div>
                {r.description && <p className="risk-desc">{r.description}</p>}
                <div className="risk-meta">
                  <span>\uD83D\uDCA1 {TREATMENT_LABEL[r.treatment]}</span>
                  {r.responsible && <span>\uD83D\uDC64 {r.responsible}</span>}
                  {r.review_date && <span>\uD83D\uDCC5 Revisione: {formatDate(r.review_date)}</span>}
                  <span className="risk-prob-imp">P:{r.probability} \u00d7 I:{r.impact}</span>
                </div>
                {r.treatment_desc && (
                  <p className="risk-treatment">\uD83D\uDEE1\uFE0F {r.treatment_desc}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <RiskForm
          initial={modal.data}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── Tab Obiettivi ─────────────────────────────────────────────────────────────

function ObjectivesTab() {
  const [list, setList]       = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);
  const [filterStatus, setFS] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const [listRes, statsRes] = await Promise.all([
        apiService.getObjectives(params),
        apiService.getObjectivesStats(),
      ]);
      setList(listRes.data?.data || []);
      setStats(statsRes.data?.data || null);
    } finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form) {
    if (modal.data?.objective_id) {
      await apiService.updateObjective(modal.data.objective_id, form);
    } else {
      await apiService.createObjective(form);
    }
    await load();
  }

  async function handleDelete(o) {
    if (!window.confirm(`Eliminare l'obiettivo "${o.title}"?`)) return;
    await apiService.deleteObjective(o.objective_id);
    await load();
  }

  const avgProgress = stats?.avg_progress ? Math.round(stats.avg_progress) : 0;

  return (
    <div className="objectives-tab">
      {/* Stats */}
      {stats && (
        <div className="stats-bar">
          <div className="stat-item"><span className="stat-num">{stats.total}</span><span className="stat-lbl">Totale</span></div>
          <div className="stat-item stat-open"><span className="stat-num">{stats.active}</span><span className="stat-lbl">Attivi</span></div>
          <div className="stat-item stat-miti"><span className="stat-num">{stats.achieved}</span><span className="stat-lbl">Raggiunti</span></div>
          <div className="stat-item stat-high"><span className="stat-num">{stats.overdue}</span><span className="stat-lbl">Scaduti</span></div>
          <div className="stat-item stat-prog">
            <span className="stat-num">{avgProgress}%</span>
            <span className="stat-lbl">Avanzamento medio</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="tab-toolbar">
        <select value={filterStatus} onChange={e => setFS(e.target.value)}>
          <option value="">Tutti gli stati</option>
          {Object.entries(OBJ_STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setModal({ mode: "new", data: null })}>+ Nuovo obiettivo</button>
      </div>

      {/* Lista */}
      {loading ? <p className="loading-msg">Caricamento...</p> : list.length === 0 ? (
        <div className="empty-state"><p>Nessun obiettivo registrato.</p></div>
      ) : (
        <div className="obj-list">
          {list.map(o => {
            const statusCfg = OBJ_STATUS_CFG[o.status] || { label: o.status, cls: "" };
            const pct = o.progress_pct || 0;
            const isOverdue = o.due_date && new Date(o.due_date) < new Date() && o.status === "active";
            return (
              <div key={o.objective_id} className={`obj-card${isOverdue ? " obj-overdue" : ""}`}>
                <div className="obj-card-top">
                  <div className="obj-card-title">
                    {o.iso_clause && <span className="obj-clause">\u00a7{o.iso_clause}</span>}
                    <strong>{o.title}</strong>
                  </div>
                  <div className="risk-card-actions">
                    <span className={`status-tag ${statusCfg.cls}`}>{statusCfg.label}</span>
                    <button className="btn-icon" onClick={() => setModal({ mode: "edit", data: o })} title="Modifica">\u270F\uFE0F</button>
                    <button className="btn-icon btn-del" onClick={() => handleDelete(o)} title="Elimina">\uD83D\uDDD1\uFE0F</button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="obj-progress-wrap">
                  <div className="obj-progress-bar" style={{ width: `${pct}%` }} />
                  <span className="obj-progress-pct">{pct}%</span>
                </div>

                <div className="risk-meta">
                  {o.target_value  && <span>\uD83C\uDFAF Target: {o.target_value}</span>}
                  {o.current_value && <span>\uD83D\uDCC8 Attuale: {o.current_value}</span>}
                  {o.responsible   && <span>\uD83D\uDC64 {o.responsible}</span>}
                  {o.due_date      && <span className={isOverdue ? "overdue-text" : ""}>\uD83D\uDCC5 {formatDate(o.due_date)}{isOverdue ? " \u26A0\uFE0F" : ""}</span>}
                </div>
                {o.kpi_description && <p className="risk-treatment">\uD83D\uDCCA {o.kpi_description}</p>}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <ObjectiveForm
          initial={modal.data}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── Pagina principale ─────────────────────────────────────────────────────────

export default function RisksPage() {
  const [activeTab, setActiveTab] = useState("risks");

  return (
    <div className="risks-page">
      <div className="risks-page-header">
        <h1>\u26A0\uFE0F Rischi & Obiettivi</h1>
        <p className="risks-page-sub">ISO 9001:2015 \u00a76.1 Rischi e opportunit\u00e0 \u2014 \u00a76.2 Obiettivi per la qualit\u00e0</p>
      </div>

      <div className="risks-tabs">
        <button className={`risks-tab-btn${activeTab === "risks" ? " active" : ""}`} onClick={() => setActiveTab("risks")}>
          \uD83D\uDEA7 Registro Rischi
        </button>
        <button className={`risks-tab-btn${activeTab === "objectives" ? " active" : ""}`} onClick={() => setActiveTab("objectives")}>
          \uD83C\uDFAF Obiettivi Qualit\u00e0
        </button>
      </div>

      <div className="risks-tab-content">
        {activeTab === "risks" ? <RisksTab /> : <ObjectivesTab />}
      </div>
    </div>
  );
}
