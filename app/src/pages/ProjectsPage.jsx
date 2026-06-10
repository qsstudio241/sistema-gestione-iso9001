/**
 * ProjectsPage � Gestione Commesse ISO 3834
 * Pattern CRUD identico a WeldingProceduresPage.
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { formatDate } from "../utils/dateHelpers";
import StatusBadge from "../components/StatusBadge";
import PencilIcon from "../components/icons/PencilIcon";
import TrashIcon from "../components/icons/TrashIcon";
import "./ProjectsPage.css";

const PROJECT_STATUSES = [
  { value: "offerta", label: "Offerta" },
  { value: "aperta",  label: "Aperta" },
  { value: "chiusa",  label: "Chiusa" },
  { value: "sospesa", label: "Sospesa" },
];

// ??? Form modale commessa ???????????????????????????????????????????????????

function ProjectFormModal({ project, wpsList, qualifications, onSave, onClose }) {
  // Prepopola welder_ids dai welders già assegnati al progetto
  const existingWelderIds = Array.isArray(project?.welders)
    ? project.welders.map(w => w.qualification_id)
    : [];

  const [form, setForm] = useState({
    project_code: "",
    client_name: "",
    description: "",
    start_date: "",
    end_date: "",
    status: "offerta",
    requirements_review_date: "",
    technical_review_date: "",
    notes: "",
    applicable_wps_ids: [],
    welder_ids: existingWelderIds,
    ...(project || {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (project?.applicable_wps_ids && typeof project.applicable_wps_ids === "string") {
      try {
        setForm((f) => ({ ...f, applicable_wps_ids: JSON.parse(project.applicable_wps_ids) }));
      } catch { /* keep as-is */ }
    }
  }, [project]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  function toggleWps(wpsId) {
    setForm((f) => {
      const ids = Array.isArray(f.applicable_wps_ids) ? [...f.applicable_wps_ids] : [];
      const idx = ids.indexOf(wpsId);
      if (idx >= 0) ids.splice(idx, 1);
      else ids.push(wpsId);
      return { ...f, applicable_wps_ids: ids };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        applicable_wps_ids: JSON.stringify(form.applicable_wps_ids || []),
      };
      let savedProjectId;
      if (project?.id) {
        await apiService.updateProject(project.id, payload);
        savedProjectId = project.id;
      } else {
        const res = await apiService.createProject(payload);
        savedProjectId = res?.data?.id || res?.id;
      }

      // Sincronizza welders: aggiungi i nuovi, rimuovi i vecchi
      if (savedProjectId) {
        const newIds = Array.isArray(form.welder_ids) ? form.welder_ids : [];
        const oldIds = existingWelderIds;
        const toAdd    = newIds.filter(id => !oldIds.includes(id));
        const toRemove = oldIds.filter(id => !newIds.includes(id));
        await Promise.all([
          ...toAdd.map(qid => apiService.addProjectWelder(savedProjectId, { qualification_id: qid }).catch(() => {})),
          ...toRemove.map(qid => apiService.removeProjectWelder(savedProjectId, qid).catch(() => {})),
        ]);
      }

      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const dateVal = (v) => (v ? String(v).substring(0, 10) : "");
  const wpsIds = Array.isArray(form.applicable_wps_ids) ? form.applicable_wps_ids : [];

  return (
    <div className="pj-modal-overlay" onClick={onClose}>
      <div className="pj-modal pj-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="pj-modal-header">
          <h3>{project?.id ? "Modifica commessa" : "Nuova commessa"}</h3>
          <button className="pj-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="pj-modal-body">
            {error && <div className="pj-error">{error}</div>}
            <div className="pj-form-grid">
              <div className="pj-form-group">
                <label className="pj-form-label">Codice commessa *</label>
                <input className="pj-form-input" value={form.project_code} onChange={(e) => set("project_code", e.target.value)} required />
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label">Cliente</label>
                <input className="pj-form-input" value={form.client_name || ""} onChange={(e) => set("client_name", e.target.value)} />
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label">Data inizio</label>
                <input className="pj-form-input" type="date" value={dateVal(form.start_date)} onChange={(e) => set("start_date", e.target.value)} />
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label">Data fine</label>
                <input className="pj-form-input" type="date" value={dateVal(form.end_date)} onChange={(e) => set("end_date", e.target.value)} />
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label">Stato</label>
                <select className="pj-form-select" value={form.status || "offerta"} onChange={(e) => set("status", e.target.value)}>
                  {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label">Riesame requisiti</label>
                <input className="pj-form-input" type="date" value={dateVal(form.requirements_review_date)} onChange={(e) => set("requirements_review_date", e.target.value)} />
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label">Riesame tecnico</label>
                <input className="pj-form-input" type="date" value={dateVal(form.technical_review_date)} onChange={(e) => set("technical_review_date", e.target.value)} />
              </div>
              <div className="pj-form-group full">
                <label className="pj-form-label">Descrizione</label>
                <textarea className="pj-form-textarea" value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
              </div>
              <div className="pj-form-group full">
                <label className="pj-form-label">Note</label>
                <textarea className="pj-form-textarea" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>

            {/* WPS applicabili */}
            {wpsList.length > 0 && (
              <div className="pj-wps-section">
                <h4 className="pj-section-label">WPS applicabili</h4>
                <div className="pj-checkbox-list">
                  {wpsList.map((w) => (
                    <label key={w.id} className="pj-checkbox-item">
                      <input
                        type="checkbox"
                        checked={wpsIds.includes(w.id)}
                        onChange={() => toggleWps(w.id)}
                      />
                      <span>{w.wps_code}{w.revision ? ` (Rev. ${w.revision})` : ""}</span>
                      <span className="pj-checkbox-sub">{w.welding_process || ""}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Saldatori assegnati */}
            {qualifications.length > 0 && (
              <div className="pj-wps-section">
                <h4 className="pj-section-label">Saldatori qualificati</h4>
                <div className="pj-checkbox-list">
                  {qualifications.map((q) => {
                    const isAssigned = Array.isArray(form.welder_ids) && form.welder_ids.includes(q.id);
                    return (
                      <label key={q.id} className="pj-checkbox-item">
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => {
                            setForm(f => {
                              const ids = Array.isArray(f.welder_ids) ? [...f.welder_ids] : [];
                              const idx = ids.indexOf(q.id);
                              if (idx >= 0) ids.splice(idx, 1);
                              else ids.push(q.id);
                              return { ...f, welder_ids: ids };
                            });
                          }}
                        />
                        <span>{q.person_name}</span>
                        <span className="pj-checkbox-sub">{q.qualification_type} &mdash; {q.certificate_number || "N/A"}</span>
                        {q.approval_status !== "approvata" && (
                          <span className="pj-badge-warn">non approvata</span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="pj-hint">L&apos;assegnazione viene salvata contestualmente alla commessa.</p>
              </div>
            )}
          </div>
          <div className="pj-modal-footer">
            <button type="button" className="pj-btn-cancel" onClick={onClose}>Annulla</button>
            <button type="submit" className="pj-btn-save" disabled={saving}>{saving ? "Salvataggio..." : "Salva"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Widget Copertura Commessa ──────────────────────────────────────────────────

function CoverageModal({ projectId, projectCode, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiService.getQualificationsCoverage(projectId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  const esito = { verde: "\u2705", rosso: "\u274C", giallo: "\u26A0\uFE0F" };

  return (
    <div className="pj-modal-overlay" onClick={onClose}>
      <div className="pj-modal pj-modal-large" onClick={e => e.stopPropagation()}>
        <div className="pj-modal-header">
          <h3>Copertura Commessa &mdash; {projectCode}</h3>
          <button className="pj-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="pj-modal-body">
          {loading && <div className="pj-loading"><div className="pj-spinner" /><span>Calcolo copertura...</span></div>}
          {error && <div className="pj-error">{error}</div>}
          {data && !data.has_wps && (
            <div className="pj-hint">Nessuna WPS associata alla commessa. Assegna le WPS per verificare la copertura.</div>
          )}
          {data && data.has_wps && (
            <>
              <div className="pj-coverage-summary">
                <span className="pj-cov-ok">{"\u2705"} Coperte: {data.summary.covered}</span>
                <span className="pj-cov-ko">{"\u274C"} Non coperte: {data.summary.uncovered}</span>
                <span className="pj-cov-tot">Totale WPS: {data.summary.total}</span>
              </div>
              <table className="pj-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>WPS</th>
                    <th>Processo</th>
                    <th>Saldatori qualificati</th>
                    <th>Esito</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coverage.map(row => (
                    <tr key={row.wps_id}>
                      <td><strong>{row.wps_code}</strong></td>
                      <td>{row.welding_process || "\u2014"}</td>
                      <td>
                        {row.qualifiers.length === 0
                          ? <span style={{ color: "#dc2626" }}>Nessuno disponibile</span>
                          : row.qualifiers.map(q => (
                            <div key={q.id} className="pj-qual-chip">
                              {q.person_name}
                              {q.semaforo !== "verde" && (
                                <span className={`pj-chip-warn pj-chip-${q.semaforo}`}>
                                  {q.semaforo === "rosso" ? " (scaduta)" : " (in scadenza)"}
                                </span>
                              )}
                            </div>
                          ))}
                      </td>
                      <td>{esito[row.esito] || row.esito}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div className="pj-modal-footer">
          <button className="pj-btn-cancel" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </div>
  );
}

// ─── Pagina principale ─────────────────────────────────────────────────────────

function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const LIMIT = 30;

  const [filters, setFiltersState] = useState({ search: "", status: "" });
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [coverageProject, setCoverageProject] = useState(null); // { id, project_code }

  const [wpsList, setWpsList] = useState([]);
  const [qualifications, setQualifications] = useState([]);

  const setFilter = useCallback((key, val) => {
    setFiltersState((f) => ({ ...f, [key]: val }));
    setPage(1);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: LIMIT };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;

      const res = await apiService.getProjects(params);
      setProjects(res.data || []);
      setTotal(res.pagination?.total || res.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  const loadFormData = useCallback(async () => {
    try {
      const [wpsRes, qualRes] = await Promise.allSettled([
        apiService.getWPSList({ status: "attiva", limit: 500 }),
        apiService.getQualifications({ qualification_type: "iso9606_1", limit: 200 }),
      ]);
      if (wpsRes.status === "fulfilled") setWpsList(wpsRes.value?.data || []);
      if (qualRes.status === "fulfilled") setQualifications(qualRes.value?.qualifications || []);
    } catch { /* non bloccante */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadFormData(); }, [loadFormData]);

  function handleNew()       { setEditingProject(null); setFormOpen(true); }
  async function handleEdit(p) {
    try {
      const full = await apiService.getProject(p.id);
      setEditingProject(full?.data || full || p);
    } catch {
      setEditingProject(p);
    }
    setFormOpen(true);
  }
  function handleSaved()     { setFormOpen(false); setEditingProject(null); loadData(); }

  async function handleConfirmDelete(id) {
    try {
      await apiService.deleteProject(id);
      setDeleteId(null);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function getWpsCount(project) {
    try {
      const ids = typeof project.applicable_wps_ids === "string"
        ? JSON.parse(project.applicable_wps_ids)
        : project.applicable_wps_ids;
      return Array.isArray(ids) ? ids.length : 0;
    } catch { return 0; }
  }

  return (
    <div className="pj-page">
      {/* Header */}
      <div className="pj-header">
        <div>
          <h2 className="pj-title">Gestione Commesse</h2>
          <p className="pj-subtitle">Commesse di saldatura � ISO 3834</p>
        </div>
        <button className="pj-btn-new" onClick={handleNew}>+ Nuova commessa</button>
      </div>

      {/* Filtri */}
      <div className="pj-toolbar">
        <input
          className="pj-search"
          type="text"
          placeholder="Cerca codice, cliente..."
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
        />
        <select
          className="pj-select"
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="">Tutti gli stati</option>
          {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button className="pj-btn-reload" onClick={loadData} title="Aggiorna">&#x21bb;</button>
      </div>

      {error && (
        <div className="pj-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {/* Tabella */}
      <div className="pj-table-wrap">
        {loading ? (
          <div className="pj-loading"><div className="pj-spinner" /><span>Caricamento...</span></div>
        ) : projects.length === 0 ? (
          <div className="pj-empty">
            <span className="pj-empty-icon">{"\uD83D\uDCCB"}</span>
            <p>Nessuna commessa trovata.</p>
            <button className="pj-btn-new" onClick={handleNew} style={{ marginTop: 12 }}>Crea la prima commessa</button>
          </div>
        ) : (
          <table className="pj-table">
            <thead>
              <tr>
                <th>Codice</th>
                <th>Cliente</th>
                <th>Stato</th>
                <th>Inizio</th>
                <th>Fine</th>
                <th>N.WPS</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.project_code}</strong></td>
                  <td>{p.client_name || "-"}</td>
                  <td><StatusBadge type="project" status={p.status || "offerta"} /></td>
                  <td>{formatDate(p.start_date)}</td>
                  <td>{formatDate(p.end_date)}</td>
                  <td>{getWpsCount(p)}</td>
                  <td>
                    {deleteId === p.id ? (
                      <div className="pj-confirm">
                        <span>Eliminare?</span>
                        <button className="pj-confirm-yes" type="button" onClick={() => handleConfirmDelete(p.id)}>S�</button>
                        <button className="pj-confirm-no" onClick={() => setDeleteId(null)}>No</button>
                      </div>
                    ) : (
                      <div className="pj-actions">
                        <button
                          className="grid-icon-btn"
                          title="Modifica commessa"
                          aria-label="Modifica commessa"
                          onClick={() => handleEdit(p)}
                        >
                          <PencilIcon size={15} />
                        </button>
                        <button
                          className="pj-btn-coverage"
                          title="Verifica copertura saldatori"
                          onClick={() => setCoverageProject({ id: p.id, project_code: p.project_code })}
                        >
                          {"\uD83D\uDD0D"}
                        </button>
                        <button
                          className="grid-icon-btn grid-icon-btn--danger"
                          title="Elimina commessa"
                          aria-label="Elimina commessa"
                          onClick={() => setDeleteId(p.id)}
                        >
                          <TrashIcon size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginazione */}
      {totalPages > 1 && (
        <div className="pj-pagination">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>&laquo; Prec</button>
          <span>Pag. {page} / {totalPages} &mdash; {total} commesse</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Succ &raquo;</button>
        </div>
      )}

      {/* Form modale */}
      {formOpen && (
        <ProjectFormModal
          project={editingProject}
          wpsList={wpsList}
          qualifications={qualifications}
          onSave={handleSaved}
          onClose={() => { setFormOpen(false); setEditingProject(null); }}
        />
      )}

      {/* Modal copertura */}
      {coverageProject && (
        <CoverageModal
          projectId={coverageProject.id}
          projectCode={coverageProject.project_code}
          onClose={() => setCoverageProject(null)}
        />
      )}
    </div>
  );
}

export default ProjectsPage;
