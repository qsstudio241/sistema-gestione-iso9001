/**
 * ComplaintsPage — Registro Reclami
 *
 * Route: /reclami
 * ISO 9001:2015 §8.8 Monitoraggio soddisfazione del cliente
 *                 §10.2 Non conformità e azioni correttive
 *
 * Perché separato dalle Anagrafiche:
 * I reclami sono transazioni operative (event-driven, urgenti, con scadenze).
 * Le anagrafiche (fornitori, reparti) sono master data: route /anagrafiche.
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { formatDate } from "../utils/dateHelpers";
import "./ComplaintsPage.css";

// ─── Costanti ────────────────────────────────────────────────────────────────

const COMPLAINT_TYPE_CFG = {
  customer: { label: "Cliente",   icon: "👤", cls: "ct-customer" },
  supplier: { label: "Fornitore", icon: "🏭", cls: "ct-supplier" },
  internal: { label: "Interno",   icon: "🏢", cls: "ct-internal" },
};

const SEVERITY_CFG = {
  low:      { label: "Basso",   cls: "sev-low" },
  medium:   { label: "Medio",   cls: "sev-medium" },
  high:     { label: "Alto",    cls: "sev-high" },
  critical: { label: "Critico", cls: "sev-critical" },
};

const STATUS_CFG = {
  open:         { label: "Aperto",         cls: "st-open" },
  in_progress:  { label: "In gestione",    cls: "st-progress" },
  in_analysis:  { label: "In analisi",     cls: "st-analysis" },
  action_taken: { label: "Azione avviata", cls: "st-action" },
  verified:     { label: "Verificato",     cls: "st-verified" },
  closed:       { label: "Chiuso",         cls: "st-closed" },
  rejected:     { label: "Rifiutato",      cls: "st-rejected" },
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
  const [items, setItems]           = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType)   params.complaint_type = filterType;
      if (filterStatus) params.status         = filterStatus;
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
    const auditIdStr = window.prompt(
      `Inserisci l'ID dell'audit a cui collegare la NC per il reclamo "${item.complaint_number || "#" + item.id}":`
    );
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
    <div className="complaints-page">
      <div className="page-header">
        <div>
          <h1>Registro Reclami</h1>
          <p className="page-sub">
            ISO 9001:2015 §8.8 Soddisfazione del cliente · §10.2 NC e azioni correttive
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setEditItem(null); setShowForm(true); }}
        >
          + Nuovo Reclamo
        </button>
      </div>

      {/* Statistiche */}
      {stats && (
        <div className="stats-bar">
          {[
            { key: "total",          label: "Totale",          cls: "" },
            { key: "open_count",     label: "Aperti",          cls: "stat-open" },
            { key: "overdue",        label: "Scaduti",         cls: "stat-overdue" },
            { key: "high_severity",  label: "Alta severità",   cls: "stat-high" },
            { key: "customer_count", label: "Da clienti",      cls: "" },
            { key: "supplier_count", label: "Su fornitori",    cls: "" },
            { key: "internal_count", label: "Interni",         cls: "" },
          ].map(({ key, label, cls }) => (
            <div key={key} className={`stat-chip ${cls}`}>
              <span className="stat-num">{stats[key] ?? 0}</span>
              <span className="stat-lbl">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filtri */}
      <div className="filter-bar">
        <select value={filterType} onChange={e => { setFilterType(e.target.value); }}>
          <option value="">Tutti i tipi</option>
          {Object.entries(COMPLAINT_TYPE_CFG).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); }}>
          <option value="">Tutti gli stati</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {(filterType || filterStatus) && (
          <button className="btn-reset" onClick={() => { setFilterType(""); setFilterStatus(""); }}>
            × Azzera filtri
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="loading-msg">Caricamento reclami...</div>
      ) : items.length === 0 ? (
        <div className="empty-msg">
          {filterType || filterStatus
            ? "Nessun reclamo corrisponde ai filtri selezionati."
            : "Nessun reclamo registrato. Usa il pulsante + per aggiungerne uno."}
        </div>
      ) : (
        <div className="complaints-list">
          {items.map(item => {
            const isExpanded = expandedId === item.id;
            const isOverdue  = item.is_overdue === 1 || item.is_overdue === true;
            return (
              <div
                key={item.id}
                className={`complaint-card${isOverdue ? " overdue" : ""}${isExpanded ? " expanded" : ""}`}
              >
                {/* Header sempre visibile */}
                <div
                  className="complaint-header"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <div className="complaint-badges">
                    <span className="complaint-number">{item.complaint_number || `#${item.id}`}</span>
                    <TypeTag type={item.complaint_type || "customer"} />
                    <SevTag severity={item.severity || "medium"} />
                    <StatusTag status={item.status} />
                    {isOverdue && <span className="overdue-flag">⚠️ Scaduto</span>}
                  </div>
                  <div className="complaint-summary">
                    <strong className="complaint-title">{item.title}</strong>
                    <span className="complaint-meta">
                      {item.customer_name}
                      {item.supplier_name && ` · 🏭 ${item.supplier_name}`}
                      {item.department_name && ` · 🏢 ${item.department_name}`}
                      {" · "}{formatDate(item.receive_date)}
                      {item.due_date && ` · scad. ${formatDate(item.due_date)}`}
                    </span>
                  </div>
                  <span className="expand-icon">{isExpanded ? "▲" : "▼"}</span>
                </div>

                {/* Dettaglio espanso */}
                {isExpanded && (
                  <div className="complaint-body">
                    <div className="body-section">
                      <label>Descrizione</label>
                      <p>{item.description}</p>
                    </div>

                    {item.product_service && (
                      <div className="body-section">
                        <label>Prodotto / Servizio</label>
                        <p>{item.product_service}</p>
                      </div>
                    )}

                    {item.root_cause && (
                      <div className="body-section">
                        <label>Causa radice (§10.2.1b)</label>
                        <p>{item.root_cause}</p>
                      </div>
                    )}

                    {item.resolution_summary && (
                      <div className="body-section">
                        <label>Sintesi risoluzione</label>
                        <p>{item.resolution_summary}</p>
                      </div>
                    )}

                    {item.nc_number && (
                      <div className="nc-link-row">
                        <span className="nc-link-label">NC collegata:</span>
                        <span className="nc-number-badge">{item.nc_number}</span>
                        <StatusTag status={item.nc_status} />
                      </div>
                    )}

                    {/* Azioni */}
                    <div className="body-actions">
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
                      {!item.nc_id && !["closed", "rejected"].includes(item.status) && (
                        <button
                          className="btn-promote"
                          onClick={() => handlePromoteToNc(item)}
                          title="Crea una NC nel registro organizzativo collegata a questo reclamo (§10.2)"
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
    receive_date:       item?.receive_date
      ? item.receive_date.substring(0, 10)
      : new Date().toISOString().substring(0, 10),
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
      apiService.getSuppliers({ is_active: "true" }).catch(() => ({ data: [] })),
      apiService.getDepartments({ is_active: "true" }).catch(() => ({ data: [] })),
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
      <div className="modal-box modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{item ? "Modifica Reclamo" : "Nuovo Reclamo"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Tipo + Severità + Stato (solo in modifica) */}
          <div className={item ? "form-row-3" : "form-row-2"}>
            <div className="form-group">
              <label>Tipo di reclamo *</label>
              <select value={form.complaint_type} onChange={e => set("complaint_type", e.target.value)}>
                <option value="customer">👤 Cliente esterno</option>
                <option value="supplier">🏭 Verso fornitore</option>
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
            <input
              required
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="Descrivi brevemente il problema segnalato"
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>
                {form.complaint_type === "customer"
                  ? "Cliente che ha reclamato *"
                  : "Nominativo / Riferimento *"}
              </label>
              <input
                required
                value={form.customer_name}
                onChange={e => set("customer_name", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Data ricezione *</label>
              <input
                required
                type="date"
                value={form.receive_date}
                onChange={e => set("receive_date", e.target.value)}
              />
            </div>
          </div>

          {/* Fornitore soggetto */}
          {form.complaint_type === "supplier" && (
            <div className="form-group">
              <label>Fornitore oggetto del reclamo</label>
              <select value={form.supplier_id} onChange={e => set("supplier_id", e.target.value)}>
                <option value="">— seleziona fornitore —</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.category ? ` [${s.category}]` : ""}
                  </option>
                ))}
              </select>
              {suppliers.length === 0 && (
                <small className="field-hint">
                  Nessun fornitore in anagrafica. Aggiungili in <strong>Anagrafiche → Fornitori</strong>.
                </small>
              )}
            </div>
          )}

          {/* Reparto soggetto */}
          {form.complaint_type === "internal" && (
            <div className="form-group">
              <label>Reparto oggetto del reclamo</label>
              <select value={form.department_id} onChange={e => set("department_id", e.target.value)}>
                <option value="">— seleziona reparto —</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.code ? ` [${d.code}]` : ""}
                  </option>
                ))}
              </select>
              {departments.length === 0 && (
                <small className="field-hint">
                  Nessun reparto in anagrafica. Aggiungili in <strong>Anagrafiche → Reparti</strong>.
                </small>
              )}
            </div>
          )}

          <div className="form-row-2">
            <div className="form-group">
              <label>Prodotto / Servizio oggetto</label>
              <input
                value={form.product_service}
                onChange={e => set("product_service", e.target.value)}
                placeholder="Codice articolo, nome servizio..."
              />
            </div>
            <div className="form-group">
              <label>Responsabile gestione</label>
              <input
                value={form.responsible_person}
                onChange={e => set("responsible_person", e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Descrizione dettagliata *</label>
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Cosa è successo, quando, dove, impatto sul cliente/processo..."
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Scadenza risposta al cliente</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => set("due_date", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Note aggiuntive</label>
              <input
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
              />
            </div>
          </div>

          {/* Campi disponibili solo in modifica (analisi causa + risoluzione) */}
          {item && (
            <>
              <div className="form-group">
                <label>Analisi causa radice <small>(ISO §10.2.1b)</small></label>
                <textarea
                  rows={3}
                  value={form.root_cause}
                  onChange={e => set("root_cause", e.target.value)}
                  placeholder="5W, Ishikawa, 8D... Qual è la causa fondamentale del problema?"
                />
              </div>
              <div className="form-group">
                <label>Sintesi risoluzione</label>
                <textarea
                  rows={3}
                  value={form.resolution_summary}
                  onChange={e => set("resolution_summary", e.target.value)}
                  placeholder="Come è stato risolto il problema? Azioni intraprese."
                />
              </div>
            </>
          )}

          {error && <div className="form-error">{error}</div>}

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
