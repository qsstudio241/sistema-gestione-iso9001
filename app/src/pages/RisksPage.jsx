/**
 * RisksPage - Registro Rischi & Obiettivi ISO 9001 §6.1 + §6.2
 * Sprint 6: matrice rischio (prob×impatto), CRUD rischi, CRUD obiettivi con progress bar
 * Filtro per ambito (azienda): ogni tab mostra e filtra per company_id
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import { formatDate } from "../utils/dateHelpers";
import NcCreateModal from "../components/NcCreateModal";
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

const EMPTY_RISK = { title: "", description: "", context: "internal", category: "", probability: 2, impact: 2, treatment: "mitigate", treatment_desc: "", responsible: "", review_date: "", status: "open", nature: "risk", company_id: "" };
const EMPTY_OBJ  = { title: "", description: "", iso_clause: "", kpi_description: "", target_value: "", current_value: "", progress_pct: 0, responsible: "", due_date: "", status: "active", company_id: "" };

function RiskForm({ initial, onSave, onClose, companies = [] }) {
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
          <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi">{"\u2715"}</button>
        </div>
        <form className="risk-form" onSubmit={submit}>
          {companies.length > 0 && (
            <div className="form-row">
              <label>Azienda (ambito)</label>
              <select value={form.company_id || ""} onChange={e => upd("company_id", e.target.value || null)}>
                <option value="">-- Nessuna azienda --</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-row">
            <label>Titolo *</label>
            <input required value={form.title} onChange={e => upd("title", e.target.value)} placeholder="Titolo del rischio" />
          </div>
          <div className="form-row">
            <label>Descrizione</label>
            <textarea rows={2} value={form.description} onChange={e => upd("description", e.target.value)} />
          </div>
          <div className="form-row-2col">
            <div>
              <label>Tipo</label>
              <select value={form.nature || "risk"} onChange={e => upd("nature", e.target.value)}>
                <option value="risk">Rischio</option>
                <option value="opportunity">{"Opportunit\u00e0"}</option>
              </select>
            </div>
            <div>
              <label>Contesto</label>
              <select value={form.context} onChange={e => upd("context", e.target.value)}>
                <option value="internal">Interno</option>
                <option value="external">Esterno</option>
                <option value="interested_party">Parte interessata</option>
              </select>
            </div>
          </div>
          <div className="form-row-3col">
            <div>
              <label>Categoria</label>
              <input value={form.category} onChange={e => upd("category", e.target.value)} placeholder="es. operativo" />
            </div>
            <div>
              <label>Responsabile</label>
              <input value={form.responsible} onChange={e => upd("responsible", e.target.value)} />
            </div>
            <div />
          </div>
          <div className="form-row-3col">
            <div>
              <label>Probabilità</label>
              <select value={form.probability} onChange={e => upd("probability", parseInt(e.target.value))}>
                {[1,2,3].map(v => <option key={v} value={v}>{v} - {PROB_LABELS[v]}</option>)}
              </select>
            </div>
            <div>
              <label>Impatto</label>
              <select value={form.impact} onChange={e => upd("impact", parseInt(e.target.value))}>
                {[1,2,3].map(v => <option key={v} value={v}>{v} - {IMP_LABELS[v]}</option>)}
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

function ObjectiveForm({ initial, onSave, onClose, companies = [] }) {
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
          <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi">{"\u2715"}</button>
        </div>
        <form className="risk-form" onSubmit={submit}>
          {companies.length > 0 && (
            <div className="form-row">
              <label>Azienda (ambito)</label>
              <select value={form.company_id || ""} onChange={e => upd("company_id", e.target.value || null)}>
                <option value="">-- Nessuna azienda --</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
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

function RisksTab({ companies = [], filterCompany = "" }) {
  const [list, setList]           = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null); // null | { mode:'new'|'edit', data }
  const [filterStatus, setFS]     = useState("");
  const [actionRisk, setActionRisk] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus)  params.status     = filterStatus;
      if (filterCompany) params.company_id = filterCompany;
      const [listRes, statsRes] = await Promise.all([
        apiService.getRisks(params),
        apiService.getRisksStats(filterCompany ? { company_id: filterCompany } : {}),
      ]);
      setList(listRes?.data || []);
      setStats(statsRes?.data || null);
    } finally { setLoading(false); }
  }, [filterStatus, filterCompany]);

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
          <div className="stat-item stat-high"><span className="stat-num">{stats.high_priority}</span><span className="stat-lbl">Alta priorità</span></div>
        </div>
      )}

      {/* Toolbar */}
      <div className="tab-toolbar">
        <select value={filterStatus} onChange={e => setFS(e.target.value)}>
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
                    <span className={`nature-badge nature-${r.nature || "risk"}`}>
                      {r.nature === "opportunity" ? "\uD83D\uDFE2 Opportunit\u00e0" : "\uD83D\uDD34 Rischio"}
                    </span>
                    <strong>{r.title}</strong>
                    {r.category && <span className="risk-cat">{r.category}</span>}
                    {r.company_name && <span className="risk-company-badge">{r.company_name}</span>}
                  </div>
                  <div className="risk-card-actions">
                    <span className={`status-tag ${statusCfg.cls}`}>{statusCfg.label}</span>
                    <button type="button" className="btn-icon" onClick={() => setModal({ mode: "edit", data: r })} title="Modifica">{"\u270F\uFE0F"}</button>
                    <button type="button" className="btn-icon btn-del" onClick={() => handleDelete(r)} title="Elimina">{"\uD83D\uDDD1\uFE0F"}</button>
                  </div>
                </div>
                {r.description && <p className="risk-desc">{r.description}</p>}
                <div className="risk-meta">
                  <span>{"\uD83D\uDCA1 "}{TREATMENT_LABEL[r.treatment]}</span>
                  {r.responsible && <span>{"\uD83D\uDC64 "}{r.responsible}</span>}
                  {r.review_date && <span>{"\uD83D\uDCC5 "}Revisione: {formatDate(r.review_date)}</span>}
                  <span className="risk-prob-imp">P:{r.probability} × I:{r.impact}</span>
                </div>
                {r.treatment_desc && (
                  <p className="risk-treatment">{"\uD83D\uDEE1\uFE0F "}{r.treatment_desc}</p>
                )}
                {r.status === "in_treatment" && (
                  <button
                    type="button"
                    className="btn-action-risk"
                    onClick={() => setActionRisk(r)}
                  >
                    {"+ Crea azione nel Piano Azioni"}
                  </button>
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
          companies={companies}
        />
      )}

      {actionRisk && (
        <NcCreateModal
          open={true}
          onClose={() => setActionRisk(null)}
          onCreated={() => setActionRisk(null)}
          defaultCategory="risk_action"
          initialOriginText={`Rischio: ${actionRisk.title}`}
          initialSectionCode="clause6"
          sourceRiskId={actionRisk.risk_id}
        />
      )}
    </div>
  );
}

// ── Tab Obiettivi ─────────────────────────────────────────────────────────────

function ObjectivesTab({ companies = [], filterCompany = "" }) {
  const [list, setList]       = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);
  const [filterStatus, setFS] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus)  params.status     = filterStatus;
      if (filterCompany) params.company_id = filterCompany;
      const [listRes, statsRes] = await Promise.all([
        apiService.getObjectives(params),
        apiService.getObjectivesStats(),
      ]);
      setList(listRes?.data || []);
      setStats(statsRes?.data || null);
    } finally { setLoading(false); }
  }, [filterStatus, filterCompany]);

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
                    {o.iso_clause && <span className="obj-clause">{"\u00A7"}{o.iso_clause}</span>}
                    <strong>{o.title}</strong>
                    {o.company_name && <span className="risk-company-badge">{o.company_name}</span>}
                  </div>
                  <div className="risk-card-actions">
                    <span className={`status-tag ${statusCfg.cls}`}>{statusCfg.label}</span>
                    <button type="button" className="btn-icon" onClick={() => setModal({ mode: "edit", data: o })} title="Modifica">{"\u270F\uFE0F"}</button>
                    <button type="button" className="btn-icon btn-del" onClick={() => handleDelete(o)} title="Elimina">{"\uD83D\uDDD1\uFE0F"}</button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="obj-progress-wrap">
                  <div className="obj-progress-bar" style={{ width: `${pct}%` }} />
                  <span className="obj-progress-pct">{pct}%</span>
                </div>

                <div className="risk-meta">
                  {o.target_value  && <span>{"\uD83C\uDFAF "}Target: {o.target_value}</span>}
                  {o.current_value && <span>{"\uD83D\uDCC8 "}Attuale: {o.current_value}</span>}
                  {o.responsible   && <span>{"\uD83D\uDC64 "}{o.responsible}</span>}
                  {o.due_date      && (
                    <span className={isOverdue ? "overdue-text" : ""}>
                      {"\uD83D\uDCC5 "}{formatDate(o.due_date)}{isOverdue ? " \u26A0\uFE0F" : ""}
                    </span>
                  )}
                </div>
                {o.kpi_description && <p className="risk-treatment">{"\uD83D\uDCCA "}{o.kpi_description}</p>}
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
          companies={companies}
        />
      )}
    </div>
  );
}

// ── Tab Contesto §4 ───────────────────────────────────────────────────────────

const EMPTY_CF = { description: "", type: "external", category: "", impact: "neutral", company_id: "" };
const EMPTY_IP = { name: "", relationship: "", requirements: "", company_id: "" };

const CF_TYPE_LABEL   = { internal: "Interno", external: "Esterno" };
const CF_IMPACT_LABEL = { positive: "Positivo", negative: "Negativo", neutral: "Neutro" };
const CF_IMPACT_CLS   = { positive: "cf-positive", negative: "cf-negative", neutral: "cf-neutral" };

function ContextFactorForm({ initial, onSave, onClose, companies = [] }) {
  const [form, setForm] = useState({ ...EMPTY_CF, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  function upd(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSaving(true); setError(null);
    try { await onSave(form); onClose(); }
    catch { setError("Errore durante il salvataggio."); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial?.id ? "Modifica fattore" : "Nuovo fattore di contesto"}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi">{"\u2715"}</button>
        </div>
        <form className="risk-form" onSubmit={submit}>
          {companies.length > 0 && (
            <div className="form-row">
              <label>Azienda (ambito)</label>
              <select value={form.company_id || ""} onChange={e => upd("company_id", e.target.value || null)}>
                <option value="">-- Nessuna azienda --</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-row-3col">
            <div>
              <label>Tipo</label>
              <select value={form.type} onChange={e => upd("type", e.target.value)}>
                <option value="external">Esterno</option>
                <option value="internal">Interno</option>
              </select>
            </div>
            <div>
              <label>Impatto</label>
              <select value={form.impact} onChange={e => upd("impact", e.target.value)}>
                <option value="neutral">Neutro</option>
                <option value="positive">Positivo</option>
                <option value="negative">Negativo</option>
              </select>
            </div>
            <div>
              <label>Categoria (PESTLE)</label>
              <input value={form.category} onChange={e => upd("category", e.target.value)} placeholder="es. Economic" />
            </div>
          </div>
          <div className="form-row">
            <label>Descrizione *</label>
            <textarea required rows={3} value={form.description} onChange={e => upd("description", e.target.value)} placeholder="Descrivi il fattore di contesto..." />
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

function InterestedPartyForm({ initial, onSave, onClose, companies = [] }) {
  const [form, setForm] = useState({ ...EMPTY_IP, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  function upd(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true); setError(null);
    try { await onSave(form); onClose(); }
    catch { setError("Errore durante il salvataggio."); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial?.id ? "Modifica parte interessata" : "Nuova parte interessata"}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi">{"\u2715"}</button>
        </div>
        <form className="risk-form" onSubmit={submit}>
          {companies.length > 0 && (
            <div className="form-row">
              <label>Azienda (ambito)</label>
              <select value={form.company_id || ""} onChange={e => upd("company_id", e.target.value || null)}>
                <option value="">-- Nessuna azienda --</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-row-2col">
            <div>
              <label>Nome *</label>
              <input required value={form.name} onChange={e => upd("name", e.target.value)} placeholder="es. Cliente, Fornitore" />
            </div>
            <div>
              <label>Tipo relazione</label>
              <input value={form.relationship} onChange={e => upd("relationship", e.target.value)} placeholder="es. Cliente, Regolatore" />
            </div>
          </div>
          <div className="form-row">
            <label>{"Requisiti/Aspettative rilevanti (\u00A74.2b)"}</label>
            <textarea rows={3} value={form.requirements} onChange={e => upd("requirements", e.target.value)} placeholder="Descrivi i requisiti o aspettative rilevanti..." />
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

function ContestoTab({ companies = [], filterCompany = "" }) {
  const [factors, setFactors] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cfModal, setCfModal] = useState(null);
  const [ipModal, setIpModal] = useState(null);
  const [section, setSection] = useState("factors");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterCompany ? { company_id: filterCompany } : {};
      const [cfRes, ipRes] = await Promise.all([
        apiService.getContextFactors(params),
        apiService.getInterestedParties(params),
      ]);
      setFactors(cfRes?.data || []);
      setParties(ipRes?.data || []);
    } finally { setLoading(false); }
  }, [filterCompany]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveCf(form) {
    if (cfModal.data?.id) await apiService.updateContextFactor(cfModal.data.id, form);
    else                  await apiService.createContextFactor(form);
    await load();
  }

  async function handleDeleteCf(item) {
    if (!window.confirm(`Eliminare il fattore "${item.description.substring(0, 40)}..."?`)) return;
    await apiService.deleteContextFactor(item.id);
    await load();
  }

  async function handleSaveIp(form) {
    if (ipModal.data?.id) await apiService.updateInterestedParty(ipModal.data.id, form);
    else                  await apiService.createInterestedParty(form);
    await load();
  }

  async function handleDeleteIp(item) {
    if (!window.confirm(`Eliminare la parte interessata "${item.name}"?`)) return;
    await apiService.deleteInterestedParty(item.id);
    await load();
  }

  return (
    <div className="risks-tab">
      <div className="contesto-subtabs">
        <button type="button" className={`contesto-sub-btn${section === "factors" ? " active" : ""}`} onClick={() => setSection("factors")}>
          {"\uD83C\uDF0D Fattori di contesto (\u00A74.1)"}
        </button>
        <button type="button" className={`contesto-sub-btn${section === "parties" ? " active" : ""}`} onClick={() => setSection("parties")}>
          {"\uD83E\uDD1D Parti interessate (\u00A74.2)"}
        </button>
      </div>

      {loading ? <p className="loading-msg">Caricamento...</p> : (
        <>
          {section === "factors" && (
            <>
              <div className="tab-toolbar">
                <button className="btn-primary" onClick={() => setCfModal({ data: null })}>+ Nuovo fattore</button>
              </div>
              {factors.length === 0 ? (
                <div className="empty-state"><p>{"Nessun fattore di contesto registrato. Analizzare il contesto interno/esterno (\u00A74.1)."}</p></div>
              ) : (
                <div className="risk-list">
                  {factors.map(f => (
                    <div key={f.id} className="risk-card">
                      <div className="risk-card-top">
                        <div className="risk-card-title">
                          <span className={`nature-badge cf-type-${f.type}`}>{CF_TYPE_LABEL[f.type] || f.type}</span>
                          {f.category && <span className="risk-cat">{f.category}</span>}
                          <span className={`nature-badge ${CF_IMPACT_CLS[f.impact] || ""}`}>{CF_IMPACT_LABEL[f.impact] || f.impact}</span>
                          {f.company_name && <span className="risk-company-badge">{f.company_name}</span>}
                        </div>
                        <div className="risk-card-actions">
                          <button type="button" className="btn-icon" onClick={() => setCfModal({ data: f })} title="Modifica">{"\u270F\uFE0F"}</button>
                          <button type="button" className="btn-icon btn-del" onClick={() => handleDeleteCf(f)} title="Elimina">{"\uD83D\uDDD1\uFE0F"}</button>
                        </div>
                      </div>
                      <p className="risk-desc">{f.description}</p>
                    </div>
                  ))}
                </div>
              )}
              {cfModal && <ContextFactorForm initial={cfModal.data} onSave={handleSaveCf} onClose={() => setCfModal(null)} companies={companies} />}
            </>
          )}

          {section === "parties" && (
            <>
              <div className="tab-toolbar">
                <button className="btn-primary" onClick={() => setIpModal({ data: null })}>+ Nuova parte interessata</button>
              </div>
              {parties.length === 0 ? (
                <div className="empty-state"><p>{"Nessuna parte interessata registrata. Identificare le parti rilevanti e i loro requisiti (\u00A74.2)."}</p></div>
              ) : (
                <div className="risk-list">
                  {parties.map(p => (
                    <div key={p.id} className="risk-card">
                      <div className="risk-card-top">
                        <div className="risk-card-title">
                          <strong>{p.name}</strong>
                          {p.relationship && <span className="risk-cat">{p.relationship}</span>}
                          {p.company_name && <span className="risk-company-badge">{p.company_name}</span>}
                        </div>
                        <div className="risk-card-actions">
                          <button type="button" className="btn-icon" onClick={() => setIpModal({ data: p })} title="Modifica">{"\u270F\uFE0F"}</button>
                          <button type="button" className="btn-icon btn-del" onClick={() => handleDeleteIp(p)} title="Elimina">{"\uD83D\uDDD1\uFE0F"}</button>
                        </div>
                      </div>
                      {p.requirements && <p className="risk-desc">{p.requirements}</p>}
                    </div>
                  ))}
                </div>
              )}
              {ipModal && <InterestedPartyForm initial={ipModal.data} onSave={handleSaveIp} onClose={() => setIpModal(null)} companies={companies} />}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Pagina principale ─────────────────────────────────────────────────────────

export default function RisksPage() {
  const { companyId: filterCompany, companies } = useCompanyScope();
  const [activeTab, setActiveTab]   = useState("risks");

  return (
    <div className="risks-page">
      <div className="risks-page-header">
        <h1>{"\u26A0\uFE0F Rischi, Opportunit\u00e0 e Obiettivi"}</h1>
        <p className="risks-page-sub">{"ISO 9001:2015 \u00A7 4.1/4.2 Contesto \u2014 \u00A7 6.1 Rischi e opportunit\u00e0 \u2014 \u00A7 6.2 Obiettivi per la qualit\u00e0"}</p>
      </div>

      <div className="risks-tabs">
        <button type="button" className={`risks-tab-btn${activeTab === "risks" ? " active" : ""}`} onClick={() => setActiveTab("risks")}>
          {"\uD83D\uDEA7 Registro Rischi"}
        </button>
        <button type="button" className={`risks-tab-btn${activeTab === "objectives" ? " active" : ""}`} onClick={() => setActiveTab("objectives")}>
          {"\uD83C\uDFAF Obiettivi Qualit\u00e0"}
        </button>
        <button type="button" className={`risks-tab-btn${activeTab === "contesto" ? " active" : ""}`} onClick={() => setActiveTab("contesto")}>
          {"\uD83C\uDF0D Contesto \u00A74"}
        </button>
      </div>

      <div className="risks-tab-content">
        {activeTab === "risks"      && <RisksTab companies={companies} filterCompany={filterCompany} />}
        {activeTab === "objectives" && <ObjectivesTab companies={companies} filterCompany={filterCompany} />}
        {activeTab === "contesto"   && <ContestoTab companies={companies} filterCompany={filterCompany} />}
      </div>
    </div>
  );
}
