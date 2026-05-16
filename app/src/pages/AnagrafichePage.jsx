/**
 * AnagrafichePage - Gestione Master Data: Fornitori e Reparti
 *
 * Route: /anagrafiche
 * ISO 9001:2015 §8.4 Controllo fornitura esterna (Fornitori)
 *                 §8.5 Produzione e fornitura di servizi (Reparti interni)
 *
 * Perché una pagina separata dai Reclami:
 * Le anagrafiche sono Master Data (dati di riferimento, longevi, modificati raramente).
 * I reclami sono transazioni operative (event-driven, urgenti, con scadenze).
 * Mescolarli forza l'utente ad attraversare dati irrilevanti per fare il suo lavoro.
 * Scalabilità: questa sezione accoglierà futuri registri (clienti, impianti, attrezzature).
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { formatDate } from "../utils/dateHelpers";
import "./AnagrafichePage.css";

const SCORE_STARS = (n) => n ? "\u2B50".repeat(Math.min(n, 5)) : "-";

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function AnagrafichePage() {
  const [activeTab, setActiveTab] = useState("fornitori");

  return (
    <div className="anagrafiche-page">
      <div className="page-header">
        <div>
          <h1>Anagrafiche</h1>
          <p className="page-sub">
            Registro fornitori esterni e reparti produttivi interni - ISO 9001:2015 §8.4 / §8.5
          </p>
        </div>
      </div>

      <div className="tab-nav">
        <button
          className={`tab-btn${activeTab === "fornitori" ? " active" : ""}`}
          onClick={() => setActiveTab("fornitori")}
        >
          🏭 Fornitori
        </button>
        <button
          className={`tab-btn${activeTab === "reparti" ? " active" : ""}`}
          onClick={() => setActiveTab("reparti")}
        >
          🏢 Reparti produttivi
        </button>
      </div>

      <div className="tab-body">
        {activeTab === "fornitori" && <SuppliersTab />}
        {activeTab === "reparti"   && <DepartmentsTab />}
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
      setItems(res?.data || []);
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
    } catch {
      alert("Errore durante il salvataggio del fornitore.");
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
    <div className="split-layout">
      <div className="split-main">
        <div className="toolbar">
          <div className="filters">
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">Tutti i fornitori</option>
              <option value="external">🏭 Solo esterni</option>
              <option value="internal">🏢 Solo interni</option>
            </select>
          </div>
          <button
            className="btn-primary"
            onClick={() => { setEditItem(null); setShowForm(true); }}
          >
            + Nuovo Fornitore
          </button>
        </div>

        {loading ? (
          <div className="loading-msg">Caricamento...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Ragione Sociale</th>
                <th>Codice</th>
                <th>Categoria</th>
                <th>Referente</th>
                <th>Qualificato</th>
                <th>Ultimo voto</th>
                <th>Reclami</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="9" className="empty-cell">Nessun fornitore registrato.</td></tr>
              ) : items.map(s => (
                <tr
                  key={s.id}
                  className={selected?.id === s.id ? "row-selected" : ""}
                  onClick={() => setSelected(s)}
                >
                  <td>
                    <span className={`type-badge ${s.supplier_type === "internal" ? "type-int" : "type-ext"}`}>
                      {s.supplier_type === "internal" ? "🏢 Int" : "🏭 Ext"}
                    </span>
                  </td>
                  <td>
                    <strong>{s.name}</strong>
                    {s.vat_number && <small className="vat-note"> · {s.vat_number}</small>}
                  </td>
                  <td><code>{s.code || "-"}</code></td>
                  <td>{s.category || "-"}</td>
                  <td>{s.contact_person || "-"}</td>
                  <td>{s.is_qualified ? "✅" : "-"}</td>
                  <td>{SCORE_STARS(s.last_score)}</td>
                  <td>
                    {s.complaints_count > 0
                      ? <span className="badge-warning">{s.complaints_count}</span>
                      : "-"}
                  </td>
                  <td className="actions-cell">
                    <button
                      className="btn-icon"
                      onClick={e => { e.stopPropagation(); setEditItem(s); setShowForm(true); }}
                      title="Modifica"
                    >✏️</button>
                    <button
                      className="btn-icon danger"
                      onClick={e => { e.stopPropagation(); handleDelete(s); }}
                      title="Elimina"
                    >🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="split-side">
        {selected ? (
          <SupplierDetail
            supplier={selected}
            onRefresh={load}
            key={selected.id}
          />
        ) : (
          <div className="empty-side">
            Seleziona un fornitore per visualizzare i contatti e lo storico valutazioni.
          </div>
        )}
      </div>

      {showForm && (
        <SupplierForm
          item={editItem}
          onClose={() => setShowForm(false)}
          onSaved={handleSave}
        />
      )}
    </div>
  );
}

// ─── Dettaglio fornitore con valutazioni ──────────────────────────────────────

function SupplierDetail({ supplier, onRefresh }) {
  const [evals, setEvals]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({
    evaluation_date: new Date().toISOString().substring(0, 10),
    score: 3,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const loadEvals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getSupplierEvaluations(supplier.id);
      setEvals(res?.data || []);
    } catch {
      setEvals([]);
    } finally {
      setLoading(false);
    }
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
    } catch {
      alert("Errore salvataggio valutazione.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="supplier-detail">
      <div className="detail-header">
        <h3>{supplier.name}</h3>
        <span className={`type-badge ${supplier.supplier_type === "internal" ? "type-int" : "type-ext"}`}>
          {supplier.supplier_type === "internal" ? "🏢 Interno" : "🏭 Esterno"}
        </span>
      </div>

      {supplier.category     && <p className="detail-line">🏷️ <strong>Categoria:</strong> {supplier.category}</p>}
      {supplier.vat_number   && <p className="detail-line">📋 <strong>P.IVA:</strong> {supplier.vat_number}</p>}
      {supplier.contact_person && <p className="detail-line">👤 <strong>Referente:</strong> {supplier.contact_person}</p>}
      {supplier.email        && <p className="detail-line">✉️ <a href={`mailto:${supplier.email}`}>{supplier.email}</a></p>}
      {supplier.phone        && <p className="detail-line">📞 {supplier.phone}</p>}
      {supplier.address      && <p className="detail-line">📍 {supplier.address}</p>}
      {supplier.notes        && <p className="detail-line detail-notes">📝 {supplier.notes}</p>}

      <div className="detail-section">
        <h4>Aggiungi valutazione</h4>
        <form onSubmit={addEval} className="eval-form">
          <div className="form-row-2">
            <div className="form-group">
              <label>Data</label>
              <input
                type="date"
                value={form.evaluation_date}
                onChange={e => setForm(f => ({ ...f, evaluation_date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Voto</label>
              <select
                value={form.score}
                onChange={e => setForm(f => ({ ...f, score: parseInt(e.target.value) }))}
              >
                {[1,2,3,4,5].map(n => (
                  <option key={n} value={n}>{"⭐".repeat(n)} - {["Pessimo","Scarso","Sufficiente","Buono","Ottimo"][n-1]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Note valutazione</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Puntualità, qualità, conformità specifica..."
            />
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={saving}>
            {saving ? "Salvataggio..." : "Salva valutazione"}
          </button>
        </form>
      </div>

      <div className="detail-section">
        <h4>Storico valutazioni ({evals.length})</h4>
        {loading ? (
          <p className="loading-msg-sm">Caricamento...</p>
        ) : evals.length === 0 ? (
          <p className="empty-sm">Nessuna valutazione registrata.</p>
        ) : (
          <ul className="evals-list">
            {evals.map(ev => (
              <li key={ev.id} className="eval-item">
                <span className="eval-date">{formatDate(ev.evaluation_date)}</span>
                <span className="eval-stars">{SCORE_STARS(ev.score)}</span>
                {ev.notes && <p className="eval-notes-txt">{ev.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Form Fornitore ───────────────────────────────────────────────────────────

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{item ? "Modifica Fornitore" : "Nuovo Fornitore"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSaved(form); }} className="modal-form">
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
              <input
                value={form.code}
                onChange={e => set("code", e.target.value)}
                placeholder="SUP-001"
              />
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
              <input
                value={form.category}
                onChange={e => set("category", e.target.value)}
                placeholder="Materie prime, Servizi, Trasporti..."
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Referente commerciale</label>
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
                <input
                  type="checkbox"
                  checked={form.is_qualified}
                  onChange={e => set("is_qualified", e.target.checked)}
                />
                Fornitore qualificato (approvato acquisti critici)
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
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getDepartments();
      setItems(res?.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
    } catch {
      alert("Errore durante il salvataggio del reparto.");
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

  // Costruisce una struttura visiva gerarchica: padri prima, figli con indentazione
  const sorted = [...items].sort((a, b) => {
    const parentA = a.parent_name || "";
    const parentB = b.parent_name || "";
    if (parentA !== parentB) return parentA.localeCompare(parentB);
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="departments-panel">
      <div className="toolbar">
        <div>
          <p className="panel-hint">
            I reparti produttivi sono i "fornitori interni" dell'organizzazione.
            Vengono usati nei reclami di tipo "Interno" per identificare il reparto responsabile.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setEditItem(null); setShowForm(true); }}
        >
          + Nuovo Reparto
        </button>
      </div>

      {loading ? (
        <div className="loading-msg">Caricamento...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Codice</th>
              <th>Nome Reparto</th>
              <th>Reparto Padre</th>
              <th>Responsabile</th>
              <th>Reclami collegati</th>
              <th>Stato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-cell">
                  Nessun reparto registrato. Aggiungi i reparti produttivi della tua azienda.
                </td>
              </tr>
            ) : sorted.map(d => (
              <tr key={d.id}>
                <td><code>{d.code || "-"}</code></td>
                <td>
                  {d.parent_id && <span className="indent-arrow">↳ </span>}
                  <strong>{d.name}</strong>
                  {d.description && <small className="detail-hint"> · {d.description}</small>}
                </td>
                <td>{d.parent_name || "-"}</td>
                <td>{d.manager_name || "-"}</td>
                <td>
                  {d.complaints_count > 0
                    ? <span className="badge-warning">{d.complaints_count}</span>
                    : "-"}
                </td>
                <td>
                  <span className={`active-badge ${d.is_active ? "active" : "inactive"}`}>
                    {d.is_active ? "Attivo" : "Inattivo"}
                  </span>
                </td>
                <td className="actions-cell">
                  <button
                    className="btn-icon"
                    onClick={() => { setEditItem(d); setShowForm(true); }}
                    title="Modifica"
                  >✏️</button>
                  <button
                    className="btn-icon danger"
                    onClick={() => handleDelete(d)}
                    title="Elimina"
                  >🗑️</button>
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

// ─── Form Reparto ─────────────────────────────────────────────────────────────

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{item ? "Modifica Reparto" : "Nuovo Reparto"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            onSaved({ ...form, parent_id: form.parent_id ? parseInt(form.parent_id) : null });
          }}
          className="modal-form"
        >
          <div className="form-row-2">
            <div className="form-group">
              <label>Nome Reparto *</label>
              <input
                required
                value={form.name}
                onChange={e => set("name", e.target.value)}
                placeholder="Es: Reparto Produzione, Controllo Qualità..."
              />
            </div>
            <div className="form-group">
              <label>Codice identificativo</label>
              <input
                value={form.code}
                onChange={e => set("code", e.target.value)}
                placeholder="PROD, CQ, LOG, AMM..."
                maxLength={50}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Responsabile</label>
              <input
                value={form.manager_name}
                onChange={e => set("manager_name", e.target.value)}
                placeholder="Nome e cognome del responsabile"
              />
            </div>
            <div className="form-group">
              <label>Reparto padre (struttura gerarchica)</label>
              <select value={form.parent_id} onChange={e => set("parent_id", e.target.value)}>
                <option value="">- nessuno (reparto di primo livello) -</option>
                {parentOptions
                  .filter(p => p.id !== item?.id)
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Descrizione</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Funzione del reparto, processi gestiti..."
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => set("is_active", e.target.checked)}
              />
              Reparto attivo (visibile nella selezione reclami)
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
