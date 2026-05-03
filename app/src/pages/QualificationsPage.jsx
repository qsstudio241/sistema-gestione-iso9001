/**
 * QualificationsPage — Registro Qualifiche del Personale
 * Sprint 4: semaforo scadenze, CRUD, filtri
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import QualificationForm from "./QualificationForm";
import { formatDate } from "../utils/dateHelpers";
import "./QualificationsPage.css";

// ── Semaforo ────────────────────────────────────────────────────────────────

const SEMAFORO_LABEL = {
  verde:    { label: "Valida",         cls: "sq-verde",    icon: "🟢" },
  giallo:   { label: "In scadenza",    cls: "sq-giallo",   icon: "🟡" },
  arancione:{ label: "Urgente",        cls: "sq-arancione",icon: "🟠" },
  rosso:    { label: "Scaduta",        cls: "sq-rosso",    icon: "🔴" },
  grigio:   { label: "Non attiva",     cls: "sq-grigio",   icon: "⚪" },
};

function SemaforoTag({ value }) {
  const s = SEMAFORO_LABEL[value] || SEMAFORO_LABEL.grigio;
  return <span className={`sq-tag ${s.cls}`}>{s.icon} {s.label}</span>;
}

// ── Barra statistiche ────────────────────────────────────────────────────────

function StatsBar({ stats }) {
  if (!stats) return null;
  return (
    <div className="sq-stats-bar">
      <div className="sq-stat">
        <span className="sq-stat-num">{stats.total}</span>
        <span className="sq-stat-lbl">Totale</span>
      </div>
      <div className="sq-stat sq-stat-verde">
        <span className="sq-stat-num">{stats.valide}</span>
        <span className="sq-stat-lbl">Valide</span>
      </div>
      <div className="sq-stat sq-stat-giallo">
        <span className="sq-stat-num">{stats.in_scadenza_60}</span>
        <span className="sq-stat-lbl">In scadenza 60gg</span>
      </div>
      <div className="sq-stat sq-stat-arancione">
        <span className="sq-stat-num">{stats.in_scadenza_30}</span>
        <span className="sq-stat-lbl">Urgenti 30gg</span>
      </div>
      <div className="sq-stat sq-stat-rosso">
        <span className="sq-stat-num">{stats.scadute}</span>
        <span className="sq-stat-lbl">Scadute</span>
      </div>
    </div>
  );
}

// ── Componente principale ────────────────────────────────────────────────────

function QualificationsPage() {
  const [qualifications, setQualifications] = useState([]);
  const [stats,          setStats]          = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [total,          setTotal]          = useState(0);
  const [page,           setPage]           = useState(1);
  const LIMIT = 30;

  const [filters, setFiltersState] = useState({
    search: "", status: "", expiring_days: "",
  });

  const [formOpen,    setFormOpen]    = useState(false);
  const [editingQual, setEditingQual] = useState(null);
  const [deleteId,    setDeleteId]    = useState(null);

  const setFilter = useCallback((key, val) => {
    setFiltersState(f => ({ ...f, [key]: val }));
    setPage(1);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: LIMIT };
      if (filters.search)        params.search        = filters.search;
      if (filters.status)        params.status        = filters.status;
      if (filters.expiring_days) params.expiring_days = filters.expiring_days;

      const [res, statsRes] = await Promise.all([
        apiService.getQualifications(params),
        apiService.getQualificationsStats(),
      ]);
      setQualifications(res.qualifications || []);
      setTotal(res.total || 0);
      setStats(statsRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { loadData(); }, [loadData]);

  function handleNew()       { setEditingQual(null); setFormOpen(true); }
  function handleEdit(q)     { setEditingQual(q);    setFormOpen(true); }
  function handleSaved()     { setFormOpen(false); setEditingQual(null); loadData(); }

  async function handleConfirmDelete(id) {
    try {
      await apiService.deleteQualification(id);
      setDeleteId(null);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="sq-page">
      {/* Header */}
      <div className="sq-header">
        <div>
          <h2 className="sq-title">🎓 Qualifiche Personale</h2>
          <p className="sq-subtitle">Registro qualifiche con controllo automatico scadenze</p>
        </div>
        <button className="sq-btn-new" onClick={handleNew}>+ Nuova qualifica</button>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Filtri */}
      <div className="sq-toolbar">
        <input
          className="sq-search"
          type="text"
          placeholder="Cerca persona, qualifica, certificato..."
          value={filters.search}
          onChange={e => setFilter("search", e.target.value)}
        />
        <select
          className="sq-select"
          value={filters.status}
          onChange={e => setFilter("status", e.target.value)}
        >
          <option value="">Tutti gli stati</option>
          <option value="valida">Valida</option>
          <option value="in_scadenza">In scadenza</option>
          <option value="scaduta">Scaduta</option>
          <option value="sospesa">Sospesa</option>
          <option value="revocata">Revocata</option>
        </select>
        <select
          className="sq-select"
          value={filters.expiring_days}
          onChange={e => setFilter("expiring_days", e.target.value)}
        >
          <option value="">Tutte le scadenze</option>
          <option value="30">In scadenza entro 30 gg</option>
          <option value="60">In scadenza entro 60 gg</option>
          <option value="90">In scadenza entro 90 gg</option>
        </select>
        <button className="sq-btn-reload" onClick={loadData} title="Aggiorna">↻</button>
      </div>

      {error && <div className="sq-error">⚠️ {error} <button onClick={() => setError(null)}>&#x2715;</button></div>}

      {/* Tabella */}
      <div className="sq-table-wrap">
        {loading ? (
          <div className="sq-loading"><div className="sq-spinner" /><span>Caricamento...</span></div>
        ) : qualifications.length === 0 ? (
          <div className="sq-empty">
            <span className="sq-empty-icon">🎓</span>
            <p>Nessuna qualifica trovata.</p>
            <button className="sq-btn-new-sm" onClick={handleNew}>Aggiungi la prima qualifica</button>
          </div>
        ) : (
          <table className="sq-table">
            <thead>
              <tr>
                <th className="sq-col-semaforo">Stato</th>
                <th className="sq-col-person">Persona</th>
                <th className="sq-col-type">Tipo qualifica</th>
                <th className="sq-col-cert">Certificato</th>
                <th className="sq-col-expiry">Scadenza</th>
                <th className="sq-col-actions">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {qualifications.map(q => (
                <tr key={q.id} className={`sq-row sq-row-${q.semaforo}`}>
                  <td className="sq-col-semaforo">
                    <SemaforoTag value={q.semaforo} />
                  </td>
                  <td className="sq-col-person">
                    <div className="sq-person-name">{q.person_name}</div>
                    {q.person_code && <div className="sq-person-code">{q.person_code}</div>}
                    {q.company_name && <div className="sq-person-company">{q.company_name}</div>}
                  </td>
                  <td className="sq-col-type">
                    <div className="sq-qual-type">{q.qualification_type}</div>
                    {q.standard_ref && <div className="sq-qual-std">{q.standard_ref}</div>}
                    {q.scope_detail && <div className="sq-qual-scope">{q.scope_detail}</div>}
                  </td>
                  <td className="sq-col-cert">
                    {q.certificate_number || "—"}
                    {q.issuing_body && <div className="sq-issuer">{q.issuing_body}</div>}
                  </td>
                  <td className="sq-col-expiry">
                    {q.expiry_date
                      ? <span className={`sq-expiry-date sq-expiry-${q.semaforo}`}>{formatDate(q.expiry_date)}</span>
                      : <span className="sq-expiry-none">Nessuna</span>
                    }
                    {q.issue_date && <div className="sq-issue-date">Emessa: {formatDate(q.issue_date)}</div>}
                  </td>
                  <td className="sq-col-actions">
                    {deleteId === q.id ? (
                      <div className="sq-confirm">
                        <span>Revocare?</span>
                        <button className="sq-confirm-yes" onClick={() => handleConfirmDelete(q.id)}>Sì</button>
                        <button className="sq-confirm-no"  onClick={() => setDeleteId(null)}>No</button>
                      </div>
                    ) : (
                      <>
                        <button className="sq-btn-icon" title="Modifica" onClick={() => handleEdit(q)}>✏️</button>
                        {q.status !== "revocata" && (
                          <button className="sq-btn-icon" title="Revoca" onClick={() => setDeleteId(q.id)}>🚫</button>
                        )}
                      </>
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
        <div className="sq-pagination">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>&laquo; Prec</button>
          <span>Pag. {page} / {totalPages} &mdash; {total} qualifiche</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Succ &raquo;</button>
        </div>
      )}

      {/* Form modale */}
      {formOpen && (
        <QualificationForm
          qualification={editingQual}
          onSave={handleSaved}
          onClose={() => { setFormOpen(false); setEditingQual(null); }}
        />
      )}
    </div>
  );
}

export default QualificationsPage;
