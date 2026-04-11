import React, { useState, useEffect } from "react";
import apiService from "../services/apiService";
import "./ComplaintsPage.css";

export default function ComplaintsPage() {
  const [activeTab, setActiveTab] = useState("reclami");

  return (
    <div className="complaints-page">
      <header className="page-header">
        <h1>Gestione Reclami e Fornitori</h1>
        <p>Monitoraggio reclami clienti e qualifica fornitori (ISO 9001 §8.2.1, §8.4)</p>
      </header>

      <div className="tabs-container">
        <div className="tabs-nav">
          <button
            className={`tab-btn ${activeTab === "reclami" ? "active" : ""}`}
            onClick={() => setActiveTab("reclami")}
          >
            Reclami Clienti
          </button>
          <button
            className={`tab-btn ${activeTab === "fornitori" ? "active" : ""}`}
            onClick={() => setActiveTab("fornitori")}
          >
            Anagrafica Fornitori
          </button>
        </div>

        <div className="tab-content">
          {activeTab === "reclami" && <ComplaintsTab />}
          {activeTab === "fornitori" && <SuppliersTab />}
        </div>
      </div>
    </div>
  );
}

function ComplaintsTab() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const res = await apiService.getComplaints();
      setComplaints(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const handleSave = async (data) => {
    try {
      if (editingItem) {
        await apiService.updateComplaint(editingItem.id, data);
      } else {
        await apiService.createComplaint(data);
      }
      setShowModal(false);
      loadComplaints();
    } catch (e) {
      alert("Errore durante il salvataggio.");
    }
  };

  return (
    <div className="tab-panel">
      <div className="panel-toolbar">
        <h2>Registro Reclami</h2>
        <button className="btn-primary" onClick={handleNew}>+ Nuovo Reclamo</button>
      </div>

      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Oggetto</th>
              <th>Cliente</th>
              <th>Data Ricezione</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {complaints.length === 0 ? (
              <tr><td colSpan="5">Nessun reclamo trovato.</td></tr>
            ) : (
              complaints.map(c => (
                <tr key={c.id} className={c.is_overdue ? "row-overdue" : ""}>
                  <td>{c.title}</td>
                  <td>{c.customer_name}</td>
                  <td>{new Date(c.receive_date).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-badge status-${c.status}`}>{c.status}</span>
                    {c.is_overdue ? <span className="overdue-icon" title="Aperto da oltre 30gg">⏳</span> : null}
                  </td>
                  <td>
                    <button className="btn-icon" onClick={() => handleEdit(c)}>✏️</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {showModal && (
        <ComplaintModal
          item={editingItem}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function ComplaintModal({ item, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: item?.title || "",
    description: item?.description || "",
    customer_name: item?.customer_name || "",
    receive_date: item?.receive_date ? item.receive_date.substring(0,10) : new Date().toISOString().substring(0,10),
    status: item?.status || "open",
    notes: item?.notes || "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>{item ? "Modifica Reclamo" : "Nuovo Reclamo"}</h2>
        <form onSubmit={handleSubmit} className="standard-form">
          <div className="form-group">
            <label>Oggetto Reclamo *</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Cliente *</label>
            <input type="text" name="customer_name" value={formData.customer_name} onChange={handleChange} required />
          </div>
          <div className="form-row">
            <div className="form-group half">
              <label>Data Ricezione *</label>
              <input type="date" name="receive_date" value={formData.receive_date} onChange={handleChange} required />
            </div>
            {item && (
              <div className="form-group half">
                <label>Stato</label>
                <select name="status" value={formData.status} onChange={handleChange}>
                  <option value="open">Aperto</option>
                  <option value="in_progress">In Gestione</option>
                  <option value="verified">Verificato</option>
                  <option value="closed">Chiuso</option>
                </select>
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Descrizione *</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows="4" required></textarea>
          </div>
          <div className="form-group">
            <label>Note / Azioni intraprese</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3"></textarea>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-primary">Salva</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SuppliersTab() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const res = await apiService.getSuppliers();
      setSuppliers(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const handleSave = async (data) => {
    try {
      if (editingItem) {
        await apiService.updateSupplier(editingItem.id, data);
      } else {
        await apiService.createSupplier(data);
      }
      setShowModal(false);
      loadSuppliers();
    } catch (e) {
      alert("Errore durante il salvataggio.");
    }
  };

  return (
    <div className="tab-panel layout-split">
      <div className="panel-main">
        <div className="panel-toolbar">
          <h2>Anagrafica Fornitori</h2>
          <button className="btn-primary" onClick={handleNew}>+ Nuovo Fornitore</button>
        </div>

        {loading ? (
          <p>Caricamento...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ragione Sociale</th>
                <th>Categoria</th>
                <th>Qualificato</th>
                <th>Ultimo Voto</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr><td colSpan="5">Nessun fornitore trovato.</td></tr>
              ) : (
                suppliers.map(s => (
                  <tr key={s.id} onClick={() => setSelectedSupplier(s)} className={selectedSupplier?.id === s.id ? "selected-row" : ""}>
                    <td>{s.name}</td>
                    <td>{s.category || "-"}</td>
                    <td>{s.is_qualified ? "✅ Sì" : "❌ No"}</td>
                    <td>{s.last_score ? "⭐".repeat(s.last_score) : "-"}</td>
                    <td>
                      <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleEdit(s); }}>✏️</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="panel-side">
        {selectedSupplier ? (
          <SupplierEvaluations supplier={selectedSupplier} onUpdate={loadSuppliers} />
        ) : (
          <div className="empty-side">Seleziona un fornitore per vedere le valutazioni.</div>
        )}
      </div>

      {showModal && (
        <SupplierModal
          item={editingItem}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function SupplierModal({ item, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: item?.name || "",
    vat_number: item?.vat_number || "",
    category: item?.category || "",
    is_qualified: item?.is_qualified || false,
    notes: item?.notes || "",
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>{item ? "Modifica Fornitore" : "Nuovo Fornitore"}</h2>
        <form onSubmit={handleSubmit} className="standard-form">
          <div className="form-group">
            <label>Ragione Sociale *</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required />
          </div>
          <div className="form-row">
            <div className="form-group half">
              <label>P.IVA / CF</label>
              <input type="text" name="vat_number" value={formData.vat_number} onChange={handleChange} />
            </div>
            <div className="form-group half">
              <label>Categoria Merceologica</label>
              <input type="text" name="category" value={formData.category} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input type="checkbox" name="is_qualified" checked={formData.is_qualified} onChange={handleChange} />
              Fornitore Qualificato (approvato per acquisti critici)
            </label>
          </div>
          <div className="form-group">
            <label>Note Generali</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3"></textarea>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-primary">Salva</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SupplierEvaluations({ supplier, onUpdate }) {
  const [evals, setEvals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(3);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().substring(0,10));

  useEffect(() => {
    loadEvals();
  }, [supplier.id]);

  const loadEvals = async () => {
    setLoading(true);
    try {
      const res = await apiService.getSupplierEvaluations(supplier.id);
      setEvals(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      await apiService.createSupplierEvaluation(supplier.id, {
        evaluation_date: date,
        score,
        notes
      });
      setScore(3);
      setNotes("");
      loadEvals();
      onUpdate();
    } catch (e) {
      alert("Errore salvataggio valutazione");
    }
  };

  return (
    <div className="evaluations-container">
      <h3>Valutazioni: {supplier.name}</h3>
      
      <div className="add-eval-box">
        <h4>Aggiungi Valutazione</h4>
        <div className="form-group">
          <label>Data</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Voto (1-5)</label>
          <select value={score} onChange={e => setScore(Number(e.target.value))}>
            <option value="1">⭐ 1 - Molto scarso</option>
            <option value="2">⭐⭐ 2 - Scarso</option>
            <option value="3">⭐⭐⭐ 3 - Sufficiente</option>
            <option value="4">⭐⭐⭐⭐ 4 - Buono</option>
            <option value="5">⭐⭐⭐⭐⭐ 5 - Eccellente</option>
          </select>
        </div>
        <div className="form-group">
          <label>Note Valutazione</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows="2"></textarea>
        </div>
        <button className="btn-primary btn-block" onClick={handleAdd}>Salva Valutazione</button>
      </div>

      <div className="evals-list">
        {loading ? <p>Caricamento...</p> : evals.length === 0 ? <p>Nessuna valutazione presente.</p> : (
          evals.map(ev => (
            <div key={ev.id} className="eval-card">
              <div className="eval-header">
                <span className="eval-date">{new Date(ev.evaluation_date).toLocaleDateString()}</span>
                <span className="eval-score">{"⭐".repeat(ev.score)}</span>
              </div>
              {ev.notes && <p className="eval-notes">{ev.notes}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
