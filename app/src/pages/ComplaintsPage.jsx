/**
 * ComplaintsPage — Reclami, Fornitori e Reparti
 * ISO 9001:2015 §8.4 (fornitori), §8.8 (reclami clienti), §10.2 (NC)
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { formatDate } from "../utils/dateHelpers";
import "./ComplaintsPage.css";

// ─── Costanti ────────────────────────────────────────────────────────────────

const COMPLAINT_TYPE_CFG = {
  customer:  { label: "Cliente",        icon: "👤", cls: "ct-customer" },
  supplier:  { label: "Fornitore",      icon: "🏭", cls: "ct-supplier" },
  internal:  { label: "Interno",        icon: "🏢", cls: "ct-internal" },
};

const SEVERITY_CFG = {
  low:      { label: "Basso",    cls: "sev-low" },
  medium:   { label: "Medio",    cls: "sev-medium" },
  high:     { label: "Alto",     cls: "sev-high" },
  critical: { label: "Critico",  cls: "sev-critical" },
};

const STATUS_CFG = {
  open:          { label: "Aperto",          cls: "st-open" },
  in_progress:   { label: "In gestione",     cls: "st-progress" },
  in_analysis:   { label: "In analisi",      cls: "st-analysis" },
  action_taken:  { label: "Azione avviata",  cls: "st-action" },
  verified:      { label: "Verificato",      cls: "st-verified" },
  closed:        { label: "Chiuso",          cls: "st-closed" },
  rejected:      { label: "Rifiutato",       cls: "st-rejected" },
};

const NEXT_STATUS = {
  open:         ["in_progress", "rejected"],
  in_progress:  ["in_analysis"],
  in_analysis:  ["action_taken"],
  action_taken: ["verified"],
  verified:     ["closed"],
  closed:       [],
  rejected:     [],
};

function TypeTag({ type }) {
  const c = COMPLAINT_TYPE_CFG[type] || { label: type, icon: "", cls: "" };
  return <span className={`ctype-tag ${c.cls}`}>{c.icon} {c.label}</span>;
}

function SevTag({ severity }) {
  const c = SEVERITY_CFG[severity] || { label: severity, cls: "" };
  return <span className={`sev-tag ${c.cls}`}>{c.label}</span>;
}

function StatusTag({ status }) {
  const c = STATUS_CFG[status] || { label: status, cls: "" };
  return <span className={`cst-tag ${c.cls}`}>{c.label}</span>;
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function ComplaintsPage() {
  const [activeTab, setActiveTab] = useState("complaints");

  const tabs = [
    { key: "complaints",  label: "Registro Reclami", icon: "📋" },
    { key: "suppliers",   label: "Fornitori",         icon: "🏭" },
    { key: "departments", label: "Reparti",           icon: "🏢" },
  ];

  return (
    <div className="complaints-page">
      <div className="page-header">
        <h1>Reclami & Anagrafiche</h1>
        <p className="page-sub">ISO 9001:2015 §8.4 Fornitori · §8.8 Reclami · §10.2 NC &amp; Azioni Correttive</p>
      </div>

      <div className="tab-nav">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`tab-btn${activeTab === t.key ? " active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="tab-body">
        {activeTab === "complaints"  && <ComplaintsTab />}
        {activeTab === "suppliers"   && <SuppliersTab />}
        {activeTab === "departments" && <DepartmentsTab />}
      </div>
    </div>
  );
}

// ─── Tab Reclami ──────────────────────────────────────────────────────────────

function ComplaintsTab() {
  const [items, setItems]         = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType)   params.complaint_type = filterType;
      if (filterStatus) params.status = filterStatus;
      const [listRes, statsRes] = await Promise.all([
        apiService.getComplaints(params),
        apiService.getComplaintsStats(),
      ]);
      setItems(listRes.data?.data || listRes.data || []);
      setStats(statsRes.data?.data || null);
    } catch (e) {
      console.error("Complaints load error:", e);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(item, newStatus) {
    try {
      await apiService.updateComplaint(item.id, { status: newStatus });
      await load();
    } catch {
      alert("Errore aggiornamento stato.");
    }
  }

  async function handlePromoteToNc(item) {
    const auditIdStr = window.prompt("Inserisci l'ID dell'audit a cui collegare la NC:");
    if (!auditIdStr) return;
    const audit_id = parseInt(auditIdStr);
    if (isNaN(audit_id)) { alert("ID audit non valido"); return; }
    try {
      const res = await apiService.promoteComplaintToNc(item.id, { audit_id });
      const d = res.data?.data;
      if (res.data?.already_exists) {
        alert(`NC già esistente: ${d?.nc_number}`);
      } else {
        alert(`NC creata: ${d?.nc_number}`);
      }
      await load();
    } catch (e) {
      alert("Errore promozione a NC: " + (e?.response?.data?.error || e.message));
    }
  }

  return (
    <div className="tab-panel">
      {/* Statistiche */}
      {stats && (
        <div className="stats-bar">
          <div className="stat-chip">
            <span className="num">{stats.total || 0}</span><span className="lbl">Totale</span>
          </div>
          <div className="stat-chip open">
            <span className="num">{stats.open_count || 0}</span><span className="lbl">Aperti</span>
          </div>
          <div className="stat-chip overdue">
            <span className="num">{stats.overdue || 0}</span><span className="lbl">Scaduti</span>
          </div>
          <div className="stat-chip high">
            <span className="num">{stats.high_severity || 0}</span><span className="lbl">Alta/Critica severità</span>
          </div>
          <div className="stat-chip supplier">
            <span className="num">{stats.supplier_count || 0}</span><span className="lbl">vs Fornitori</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="panel-toolbar">
        <div className="filters">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Tutti i tipi</option>
            <option value="customer">Cliente</option>
            <option value="supplier">Fornitore</option>
            <option value="internal">Interno</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Tutti gli stati</option>
            {Object.entries(STATUS_CFG).map(([k,v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}>
          + Nuovo Reclamo
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="loading-msg">Caricamento...</div>
      ) : items.length === 0 ? (
        <div className="empty-msg">Nessun reclamo trovato.</div>
      ) : (
        <div className="complaints-list">
          {items.map(item => {
            const isExpanded = expandedId === item.id;
            const isOverdue = item.is_overdue === 1 || item.is_overdue === true;
            return (
              <div key={item.id} className={`complaint-card${isOverdue ? " overdue" : ""}${isExpanded ? " expanded" : ""}`}>
                <div className="complaint-header" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                  <div className="complaint-title-row">
                    <span className="complaint-number">{item.complaint_number || `#${item.id}`}</span>
                    <TypeTag type={item.complaint_type || "customer"} />
                    <SevTag severity={item.severity || "medium"} />
                    <StatusTag status={item.status} />
                    {isOverdue && <span className="overdue-badge">⚠️ Scaduto</span>}
                  </div>
                  <div className="complaint-meta">
                    <strong>{item.title}</strong>
                    <span className="meta-sep">·</span>
                    <span>{item.customer_name}</span>
                    {item.supplier_name && <span> / Forn: {item.supplier_name}</span>}
                    {item.department_name && <span> / Rep: {item.department_name}</span>}
                    <span className="meta-sep">·</span>
                    <span>{formatDate(item.receive_date)}</span>
                    {item.due_date && <span> · Scad: {formatDate(item.due_date)}</span>}
                  </div>
                  <span className="expand-arrow">{isExpanded ? "▲" : "▼"}</span>
                </div>

                {isExpanded && (
                  <div className="complaint-body">
                    <div className="detail-row">
                      <strong>Descrizione:</strong>
                      <p>{item.description}</p>
                    </div>
                    {item.product_service && (
                      <div className="detail-row">
                        <strong>Prodotto/Servizio:</strong> {item.product_service}
                      </div>
                    )}
                    {item.root_cause && (
                      <div className="detail-row">
                        <strong>Causa radice (§10.2.1b):</strong>
                        <p>{item.root_cause}</p>
                      </div>
                    )}
                    {item.resolution_summary && (
                      <div className="detail-row">
                        <strong>Risoluzione:</strong>
                        <p>{item.resolution_summary}</p>
                      </div>
                    )}
                    {item.nc_number && (
                      <div className="nc-link">
                        <strong>NC collegata:</strong>
                        <span className="nc-badge">{item.nc_number}</span>
                        <span className={`cst-tag ${STATUS_CFG[item.nc_status]?.cls || ""}`}>
                          {STATUS_CFG[item.nc_status]?.label || item.nc_status}
                        </span>
                      </div>
                    )}

                    {/* Workflow */}
                    <div className="complaint-actions">
                      {(NEXT_STATUS[item.status] || []).map(ns => (
                        <button
                          key={ns}
                          className="btn-workflow"
                          onClick={() => handleStatusChange(item, ns)}
                        >
                          {STATUS_CFG[ns]?.label || ns}
                        </button>
                      ))}
                      <button
                        className="btn-edit"
                        onClick={() => { setEditItem(item); setShowForm(true); }}
                      >
                        ✏️ Modifica
                      </button>
                      {!item.nc_id && !["closed","rejected"].includes(item.status) && (
                        <button
                          className="btn-promote"
                          onClick={() => handlePromoteToNc(item)}
                          title="Crea una NC nel registro organizzativo collegata a questo reclamo"
                        >
                          🚨 Promuovi a NC
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ComplaintForm
          item={editItem}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Form Reclamo ─────────────────────────────────────────────────────────────

function ComplaintForm({ item, onClose, onSaved }) {
  const [suppliers, setSuppliers]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

  const [form, setForm] = useState({
    title:              item?.title              || "",
    description:        item?.description        || "",
    customer_name:      item?.customer_name      || "",
    receive_date:       item?.receive_date ? item.receive_date.substring(0, 10) : new Date().toISOString().substring(0, 10),
    complaint_type:     item?.complaint_type     || "customer",
    severity:           item?.severity           || "medium",
    supplier_id:        item?.supplier_id        || "",
    department_id:      item?.department_id      || "",
    product_service:    item?.product_service    || "",
    responsible_person: item?.responsible_person || "",
    due_date:           item?.due_date ? item.due_date.substring(0, 10) : "",
    root_cause:         item?.root_cause         || "",
    resolution_summary: item?.resolution_summary || "",
    status:             item?.status             || "open",
    notes:              item?.notes              || "",
  });

  useEffect(() => {
    Promise.all([
      apiService.getSuppliers().catch(() => ({ data: { data: [] } })),
      apiService.getDepartments().catch(() => ({ data: { data: [] } })),
    ]).then(([sRes, dRes]) => {
      setSuppliers(sRes.data?.data || sRes.data || []);
      setDepartments(dRes.data?.data || dRes.data || []);
    });
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        supplier_id:   form.supplier_id   ? parseInt(form.supplier_id)   : null,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        due_date:      form.due_date || null,
      };
      if (item) {
        await apiService.updateComplaint(item.id, payload);
      } else {
        await apiService.createComplaint(payload);
      }
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.error || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{item ? "Modifica Reclamo" : "Nuovo Reclamo"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row-3">
            <div className="form-group">
              <label>Tipo *</label>
              <select value={form.complaint_type} onChange={e => set("complaint_type", e.target.value)}>
                <option value="customer">👤 Cliente</option>
                <option value="supplier">🏭 Fornitore</option>
                <option value="internal">🏢 Interno (reparto)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Severità *</label>
              <select value={form.severity} onChange={e => set("severity", e.target.value)}>
                <option value="low">Basso</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
                <option value="critical">Critico</option>
              </select>
            </div>
            {item && (
              <div className="form-group">
                <label>Stato</label>
                <select value={form.status} onChange={e => set("status", e.target.value)}>
                  {Object.entries(STATUS_CFG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Oggetto del reclamo *</label>
            <input required value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="Es: Materiale difettoso, ritardo consegna, comportamento..." />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>{form.complaint_type === "customer" ? "Cliente che ha reclamato *" : "Nome cliente / segnalante *"}</label>
              <input required value={form.customer_name} onChange={e => set("customer_name", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Data ricezione *</label>
              <input required type="date" value={form.receive_date} onChange={e => set("receive_date", e.target.value)} />
            </div>
          </div>

          {/* Fornitore soggetto (quando tipo=supplier) */}
          {form.complaint_type === "supplier" && (
            <div className="form-group">
              <label>Fornitore oggetto del reclamo</label>
              <select value={form.supplier_id} onChange={e => set("supplier_id", e.target.value)}>
                <option value="">— seleziona fornitore —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} {s.category ? `[${s.category}]` : ""}</option>)}
              </select>
            </div>
          )}

          {/* Reparto soggetto (quando tipo=internal) */}
          {form.complaint_type === "internal" && (
            <div className="form-group">
              <label>Reparto oggetto del reclamo</label>
              <select value={form.department_id} onChange={e => set("department_id", e.target.value)}>
                <option value="">— seleziona reparto —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name} {d.code ? `[${d.code}]` : ""}</option>)}
              </select>
            </div>
          )}

          <div className="form-row-2">
            <div className="form-group">
              <label>Prodotto / Servizio oggetto</label>
              <input value={form.product_service} onChange={e => set("product_service", e.target.value)}
                placeholder="Es: Codice articolo, nome servizio..." />
            </div>
            <div className="form-group">
              <label>Responsabile gestione</label>
              <input value={form.responsible_person} onChange={e => set("responsible_person", e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Descrizione *</label>
            <textarea required rows={4} value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Descrivi il problema in dettaglio..." />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Scadenza risposta</label>
              <input type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Note aggiuntive</label>
              <input value={form.notes} onChange={e => set("notes", e.target.value)} />
            </div>
          </div>

          {item && (
            <>
              <div className="form-group">
                <label>Analisi causa radice (§10.2.1b)</label>
                <textarea rows={3} value={form.root_cause} onChange={e => set("root_cause", e.target.value)}
                  placeholder="5W, Ishikawa, 8D... descrivere la causa fondamentale del problema" />
              </div>
              <div className="form-group">
                <label>Sintesi risoluzione</label>
                <textarea rows={3} value={form.resolution_summary} onChange={e => set("resolution_summary", e.target.value)}
                  placeholder="Come è stato risolto il problema?" />
              </div>
            </>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvataggio..." : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab Fornitori ────────────────────────────────────────────────────────────

function SuppliersTab() {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [filterType, setFilterType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType) params.supplier_type = filterType;
      const res = await apiService.getSuppliers(params);
      setItems(res.data?.data || res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data) {
    try {
      if (editItem) {
        await apiService.updateSupplier(editItem.id, data);
      } else {
        await apiService.createSupplier(data);
      }
      setShowForm(false);
      await load();
    } catch (e) {
      alert("Errore salvataggio fornitore.");
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Eliminare il fornitore "${item.name}"?`)) return;
    try {
      await apiService.deleteSupplier(item.id);
      if (selected?.id === item.id) setSelected(null);
      await load();
    } catch (e) {
      alert("Impossibile eliminare: " + (e?.response?.data?.error || e.message));
    }
  }

  return (
    <div className="tab-panel split-layout">
      <div className="split-main">
        <div className="panel-toolbar">
          <div className="filters">
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">Tutti</option>
              <option value="external">🏭 Esterni</option>
              <option value="internal">🏢 Interni</option>
            </select>
          </div>
          <button className="btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}>
            + Nuovo Fornitore
          </button>
        </div>

        {loading ? <div className="loading-msg">Caricamento...</div> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th><th>Ragione Sociale</th><th>Codice</th><th>Categoria</th>
                <th>Qualificato</th><th>Ultimo voto</th><th>NC</th><th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="8">Nessun fornitore registrato.</td></tr>
              ) : items.map(s => (
                <tr key={s.id} className={selected?.id === s.id ? "selected-row" : ""}
                  onClick={() => setSelected(s)}>
                  <td>{s.supplier_type === "internal" ? "🏢 Int" : "🏭 Ext"}</td>
                  <td><strong>{s.name}</strong>{s.vat_number && <small className="vat"> {s.vat_number}</small>}</td>
                  <td>{s.code || "-"}</td>
                  <td>{s.category || "-"}</td>
                  <td>{s.is_qualified ? "✅" : "—"}</td>
                  <td>{s.last_score ? "⭐".repeat(s.last_score) : "—"}</td>
                  <td>{s.complaints_count > 0 ? <span className="nc-cnt">{s.complaints_count}</span> : "—"}</td>
                  <td>
                    <button className="btn-icon" onClick={e => { e.stopPropagation(); setEditItem(s); setShowForm(true); }}>✏️</button>
                    <button className="btn-icon danger" onClick={e => { e.stopPropagation(); handleDelete(s); }}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="split-side">
        {selected ? (
          <SupplierDetail supplier={selected} onRefresh={load} />
        ) : (
          <div className="empty-side">Seleziona un fornitore per visualizzare i dettagli e le valutazioni.</div>
        )}
      </div>

      {showForm && (
        <SupplierForm item={editItem} onClose={() => setShowForm(false)} onSaved={handleSave} />
      )}
    </div>
  );
}

function SupplierDetail({ supplier, onRefresh }) {
  const [evals, setEvals]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({ evaluation_date: new Date().toISOString().substring(0,10), score: 3, notes: "" });
  const [saving, setSaving]   = useState(false);

  const loadEvals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getSupplierEvaluations(supplier.id);
      setEvals(res.data?.data || res.data || []);
    } catch { setEvals([]); } finally { setLoading(false); }
  }, [supplier.id]);

  useEffect(() => { loadEvals(); }, [loadEvals]);

  async function addEval(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiService.createSupplierEvaluation(supplier.id, form);
      setForm(f => ({ ...f, score: 3, notes: "" }));
      await loadEvals();
      onRefresh();
    } catch { alert("Errore salvataggio valutazione."); } finally { setSaving(false); }
  }

  return (
    <div className="supplier-detail">
      <h3>{supplier.name}</h3>
      {supplier.email && <p>✉️ {supplier.email}</p>}
      {supplier.phone && <p>📞 {supplier.phone}</p>}
      {supplier.contact_person && <p>👤 Ref: {supplier.contact_person}</p>}
      {supplier.address && <p>📍 {supplier.address}</p>}

      <h4>Aggiungi valutazione</h4>
      <form onSubmit={addEval} className="eval-form">
        <div className="form-row-2">
          <div className="form-group">
            <label>Data</label>
            <input type="date" value={form.evaluation_date} onChange={e => setForm(f => ({ ...f, evaluation_date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Voto 1-5</label>
            <select value={form.score} onChange={e => setForm(f => ({ ...f, score: parseInt(e.target.value) }))}>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{"⭐".repeat(n)} {n}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Note</label>
          <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <button type="submit" className="btn-primary btn-sm" disabled={saving}>
          {saving ? "..." : "Salva valutazione"}
        </button>
      </form>

      <h4>Storico valutazioni</h4>
      {loading ? <p>Caricamento...</p> : evals.length === 0 ? <p>Nessuna valutazione.</p> : (
        <ul className="evals-list">
          {evals.map(ev => (
            <li key={ev.id} className="eval-item">
              <span className="eval-date">{formatDate(ev.evaluation_date)}</span>
              <span className="eval-score">{"⭐".repeat(ev.score)}</span>
              {ev.notes && <p className="eval-notes">{ev.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SupplierForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:           item?.name           || "",
    supplier_type:  item?.supplier_type  || "external",
    code:           item?.code           || "",
    vat_number:     item?.vat_number     || "",
    category:       item?.category       || "",
    contact_person: item?.contact_person || "",
    email:          item?.email          || "",
    phone:          item?.phone          || "",
    address:        item?.address        || "",
    is_qualified:   item?.is_qualified   || false,
    notes:          item?.notes          || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaved(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{item ? "Modifica Fornitore" : "Nuovo Fornitore"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row-2">
            <div className="form-group">
              <label>Tipo *</label>
              <select value={form.supplier_type} onChange={e => set("supplier_type", e.target.value)}>
                <option value="external">🏭 Esterno</option>
                <option value="internal">🏢 Interno</option>
              </select>
            </div>
            <div className="form-group">
              <label>Codice interno</label>
              <input value={form.code} onChange={e => set("code", e.target.value)} placeholder="SUP-001" />
            </div>
          </div>
          <div className="form-group">
            <label>Ragione Sociale *</label>
            <input required value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>P.IVA / C.F.</label>
              <input value={form.vat_number} onChange={e => set("vat_number", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Categoria merceologica</label>
              <input value={form.category} onChange={e => set("category", e.target.value)} placeholder="Es: Materie prime, Trasporti..." />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Referente</label>
              <input value={form.contact_person} onChange={e => set("contact_person", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)} />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Telefono</label>
              <input value={form.phone} onChange={e => set("phone", e.target.value)} />
            </div>
            <div className="form-group checkbox-group">
              <label>
                <input type="checkbox" checked={form.is_qualified}
                  onChange={e => set("is_qualified", e.target.checked)} />
                Fornitore qualificato
              </label>
            </div>
          </div>
          <div className="form-group">
            <label>Indirizzo</label>
            <input value={form.address} onChange={e => set("address", e.target.value)} />
          </div>
          <div className="form-group">
            <label>Note</label>
            <textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-primary">Salva</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab Reparti ──────────────────────────────────────────────────────────────

function DepartmentsTab() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getDepartments();
      setItems(res.data?.data || res.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data) {
    try {
      if (editItem) {
        await apiService.updateDepartment(editItem.id, data);
      } else {
        await apiService.createDepartment(data);
      }
      setShowForm(false);
      await load();
    } catch (e) {
      alert("Errore salvataggio reparto.");
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Eliminare il reparto "${item.name}"?`)) return;
    try {
      await apiService.deleteDepartment(item.id);
      await load();
    } catch (e) {
      alert("Impossibile eliminare: " + (e?.response?.data?.error || e.message));
    }
  }

  return (
    <div className="tab-panel">
      <div className="panel-toolbar">
        <h3>Reparti Produttivi (fornitori interni)</h3>
        <button className="btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}>
          + Nuovo Reparto
        </button>
      </div>

      {loading ? <div className="loading-msg">Caricamento...</div> : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Codice</th><th>Nome Reparto</th><th>Reparto Padre</th>
              <th>Responsabile</th><th>Reclami</th><th>Attivo</th><th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="7">Nessun reparto registrato.</td></tr>
            ) : items.map(d => (
              <tr key={d.id}>
                <td><code>{d.code || "—"}</code></td>
                <td><strong>{d.name}</strong></td>
                <td>{d.parent_name || "—"}</td>
                <td>{d.manager_name || "—"}</td>
                <td>{d.complaints_count > 0 ? <span className="nc-cnt">{d.complaints_count}</span> : "—"}</td>
                <td>{d.is_active ? "✅" : "⛔"}</td>
                <td>
                  <button className="btn-icon" onClick={() => { setEditItem(d); setShowForm(true); }}>✏️</button>
                  <button className="btn-icon danger" onClick={() => handleDelete(d)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <DepartmentForm
          item={editItem}
          parentOptions={items}
          onClose={() => setShowForm(false)}
          onSaved={handleSave}
        />
      )}
    </div>
  );
}

function DepartmentForm({ item, parentOptions, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:         item?.name         || "",
    code:         item?.code         || "",
    description:  item?.description  || "",
    manager_name: item?.manager_name || "",
    parent_id:    item?.parent_id    || "",
    notes:        item?.notes        || "",
    is_active:    item?.is_active    ?? true,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaved({
      ...form,
      parent_id: form.parent_id ? parseInt(form.parent_id) : null,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{item ? "Modifica Reparto" : "Nuovo Reparto"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row-2">
            <div className="form-group">
              <label>Nome Reparto *</label>
              <input required value={form.name} onChange={e => set("name", e.target.value)} placeholder="Es: Reparto Produzione" />
            </div>
            <div className="form-group">
              <label>Codice</label>
              <input value={form.code} onChange={e => set("code", e.target.value)} placeholder="PROD, QUAL, LOG..." />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Responsabile</label>
              <input value={form.manager_name} onChange={e => set("manager_name", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Reparto padre (gerarchico)</label>
              <select value={form.parent_id} onChange={e => set("parent_id", e.target.value)}>
                <option value="">— nessuno —</option>
                {parentOptions.filter(p => p.id !== item?.id).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Descrizione</label>
            <textarea rows={2} value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} />
              Reparto attivo
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-primary">Salva</button>
          </div>
        </form>
      </div>
    </div>
  );
}
