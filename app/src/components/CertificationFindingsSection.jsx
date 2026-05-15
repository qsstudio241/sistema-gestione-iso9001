/**
 * CertificationFindingsSection — Sezione 1.4
 * Rilievi dell'ente certificatore (ACCREDIA, Bureau Veritas, TÜV, ecc.)
 * Legati all'azienda, persistono tra un audit e l'altro.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import apiService from "../services/apiService";
import AutoTextarea from "./AutoTextarea";
import "./CertificationFindingsSection.css";

const FINDING_TYPES = {
  NC:  { label: "Non Conformità", color: "#dc2626" },
  OBS: { label: "Osservazione",   color: "#d97706" },
  RIM: { label: "Rimando",        color: "#7c3aed" },
};

const STATUS_CONFIG = {
  open:        { label: "Aperto",    color: "#dc2626", bg: "#fee2e2" },
  in_progress: { label: "In Corso",  color: "#d97706", bg: "#fef3c7" },
  closed:      { label: "Chiuso",    color: "#16a34a", bg: "#dcfce7" },
};

const EMPTY_FORM = {
  finding_number: "", finding_type: "NC", clause_ref: "",
  description: "", certifying_body: "ACCREDIA",
  issue_date: "", due_date: "", status: "open",
  corrective_action: "", evidence: "",
};

export default function CertificationFindingsSection({ companyId, standardId = 1 }) {
  const [findings, setFindings]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  // Timestamp di apertura modale: previene ghost-click mobile (iOS/Android)
  // che chiuderebbero l'overlay ~300ms dopo il tap su "Aggiungi Rilievo"
  const openTimeRef = useRef(0);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ standard_id: standardId });
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await apiService.get(
        `/companies/${companyId}/certification-findings?${params}`
      );
      setFindings(res.data || []);
    } catch (e) {
      setError("Impossibile caricare i rilievi: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [companyId, standardId, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
    openTimeRef.current = Date.now();
  };

  const openEdit = (f) => {
    setEditingId(f.finding_id);
    openTimeRef.current = Date.now();
    setForm({
      finding_number:    f.finding_number    || "",
      finding_type:      f.finding_type      || "NC",
      clause_ref:        f.clause_ref        || "",
      description:       f.description       || "",
      certifying_body:   f.certifying_body   || "ACCREDIA",
      issue_date:        f.issue_date ? f.issue_date.split("T")[0] : "",
      due_date:          f.due_date   ? f.due_date.split("T")[0]   : "",
      status:            f.status            || "open",
      corrective_action: f.corrective_action || "",
      evidence:          f.evidence          || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, standard_id: standardId };
      if (editingId) {
        await apiService.put(`/companies/${companyId}/certification-findings/${editingId}`, payload);
      } else {
        await apiService.post(`/companies/${companyId}/certification-findings`, payload);
      }
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (e) {
      alert("Errore nel salvataggio: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminare questo rilievo?")) return;
    try {
      await apiService.delete(`/companies/${companyId}/certification-findings/${id}`);
      await load();
    } catch (e) {
      alert("Errore eliminazione: " + e.message);
    }
  };

  const openCount   = findings.filter(f => f.status === "open").length;
  const inProgCount = findings.filter(f => f.status === "in_progress").length;
  const closedCount = findings.filter(f => f.status === "closed").length;

  if (!companyId) {
    return (
      <div className="cert-findings-empty">
        <p>⚠️ Associa un'azienda all'audit per gestire i rilievi dell'ente certificatore.</p>
      </div>
    );
  }

  return (
    <div className="cert-findings">
      {/* Header con contatori e filtri */}
      <div className="cert-findings-header">
        <div className="cert-findings-counters">
          <span className="counter counter-open">🔴 {openCount} Aperti</span>
          <span className="counter counter-progress">🟡 {inProgCount} In Corso</span>
          <span className="counter counter-closed">🟢 {closedCount} Chiusi</span>
        </div>
        <div className="cert-findings-actions">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">Tutti i rilievi</option>
            <option value="open">Solo aperti</option>
            <option value="in_progress">In corso</option>
            <option value="closed">Chiusi</option>
          </select>
          <button className="btn-add-finding" onClick={openNew}>+ Aggiungi Rilievo</button>
        </div>
      </div>

      {error && <div className="cert-findings-error">{error}</div>}
      {loading && <div className="cert-findings-loading">Caricamento...</div>}

      {/* Tabella rilievi */}
      {!loading && findings.length === 0 ? (
        <div className="cert-findings-empty">
          <p>Nessun rilievo dell'ente certificatore registrato.</p>
          <button className="btn-add-finding" onClick={openNew}>+ Aggiungi il primo rilievo</button>
        </div>
      ) : (
        <div className="cert-findings-table-wrapper">
          <table className="cert-findings-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Tipo</th>
                <th>Punto</th>
                <th>Descrizione</th>
                <th>Ente</th>
                <th>Scadenza</th>
                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {findings.map(f => {
                const type   = FINDING_TYPES[f.finding_type]   || FINDING_TYPES.NC;
                const status = STATUS_CONFIG[f.status]         || STATUS_CONFIG.open;
                const isOverdue = f.status !== "closed" && f.due_date && new Date(f.due_date) < new Date();
                return (
                  <tr key={f.finding_id} className={isOverdue ? "row-overdue" : ""}>
                    <td className="col-number">{f.finding_number || "—"}</td>
                    <td>
                      <span className="badge-type" style={{ color: type.color, borderColor: type.color }}>
                        {f.finding_type}
                      </span>
                    </td>
                    <td className="col-clause">{f.clause_ref || "—"}</td>
                    <td className="col-description">
                      <div className="description-text">{f.description}</div>
                      {f.corrective_action && (
                        <div className="corrective-action">
                          <span className="label-ca">↳ AC:</span> {f.corrective_action}
                        </div>
                      )}
                    </td>
                    <td className="col-body">{f.certifying_body || "—"}</td>
                    <td className={`col-date ${isOverdue ? "date-overdue" : ""}`}>
                      {f.due_date ? new Date(f.due_date).toLocaleDateString("it-IT") : "—"}
                      {isOverdue && <span className="overdue-badge">SCADUTO</span>}
                    </td>
                    <td>
                      <span className="badge-status" style={{ color: status.color, background: status.bg }}>
                        {status.label}
                      </span>
                    </td>
                    <td className="col-actions">
                      <button className="btn-edit" onClick={() => openEdit(f)} title="Modifica">✏️</button>
                      <button className="btn-delete" onClick={() => handleDelete(f.finding_id)} title="Elimina">🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modale aggiunta/modifica */}
      {showForm && (
        <div
          className="cert-modal-overlay"
          onClick={e => {
            // Protegge dal ghost-click mobile: ignora click sull'overlay
            // entro 350ms dall'apertura (touch delay su iOS/Android).
            if (e.target !== e.currentTarget) return;
            if (Date.now() - openTimeRef.current < 350) return;
            setShowForm(false);
          }}
        >
          <div className="cert-modal">
            <div className="cert-modal-header">
              <h3>{editingId ? "Modifica Rilievo" : "Nuovo Rilievo Ente Certificatore"}</h3>
              <button className="btn-close-modal" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="cert-modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Numero Rilievo</label>
                  <input type="text" placeholder="es. NC-2025-001"
                    value={form.finding_number}
                    onChange={e => setForm(f => ({ ...f, finding_number: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Tipo *</label>
                  <select value={form.finding_type}
                    onChange={e => setForm(f => ({ ...f, finding_type: e.target.value }))}>
                    <option value="NC">Non Conformità (NC)</option>
                    <option value="OBS">Osservazione (OBS)</option>
                    <option value="RIM">Rimando (RIM)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Punto Norma</label>
                  <input type="text" placeholder="es. 8.4.1"
                    value={form.clause_ref}
                    onChange={e => setForm(f => ({ ...f, clause_ref: e.target.value }))} />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Descrizione del Rilievo *</label>
                <AutoTextarea placeholder="Descrivi il rilievo emesso dall'ente certificatore..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ente Certificatore</label>
                  <input type="text" placeholder="ACCREDIA, Bureau Veritas, TÜV..."
                    value={form.certifying_body}
                    onChange={e => setForm(f => ({ ...f, certifying_body: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Data Emissione</label>
                  <input type="date" value={form.issue_date}
                    onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Scadenza Trattamento</label>
                  <input type="date" value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Azione Correttiva Intrapresa</label>
                <AutoTextarea placeholder="Descrivi le azioni correttive adottate dall'azienda..."
                  value={form.corrective_action}
                  onChange={e => setForm(f => ({ ...f, corrective_action: e.target.value }))} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Stato</label>
                  <select value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="open">Aperto</option>
                    <option value="in_progress">In Corso</option>
                    <option value="closed">Chiuso</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Evidenza di Chiusura</label>
                  <input type="text" placeholder="es. PQ-2025-004 rev.2, email del 15/06/2025..."
                    value={form.evidence}
                    onChange={e => setForm(f => ({ ...f, evidence: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="cert-modal-footer">
              <button className="btn-cancel" onClick={() => setShowForm(false)}>Annulla</button>
              <button className="btn-save" onClick={handleSave} disabled={saving || !form.description.trim()}>
                {saving ? "Salvataggio..." : (editingId ? "Aggiorna Rilievo" : "Salva Rilievo")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
