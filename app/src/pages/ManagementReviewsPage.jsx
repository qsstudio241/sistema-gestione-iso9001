/**
 * ManagementReviewsPage — Riesame di Direzione ISO 9001 §9.3
 * Lista riesami + form completo con sezioni collassabili ISO.
 * Include widget "Dati disponibili §9.3.2" per pre-compilazione AI-assisted.
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { formatDate } from "../utils/dateHelpers";
import "./ManagementReviewsPage.css";

// ─── Configurazione stato ─────────────────────────────────────────────────────

const STATUS_CFG = {
  draft:     { label: "Bozza",       cls: "mr-draft" },
  finalized: { label: "Finalizzato", cls: "mr-final" },
  approved:  { label: "Approvato",   cls: "mr-approved" },
};

// ─── Form vuoto ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  review_date: "",
  chairperson: "",
  participants: "",
  status: "draft",
  input_previous_actions: "",
  input_audits: "",
  input_nc_corrective: "",
  input_objectives: "",
  input_complaints: "",
  input_suppliers: "",
  input_resources: "",
  input_improvements: "",
  output_improvements: "",
  output_sgq_changes: "",
  output_resources: "",
  notes: "",
};

// ─── Utility data ─────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function jan1Iso() {
  return `${new Date().getFullYear()}-01-01`;
}

// ─── Widget Dati disponibili §9.3.2 ──────────────────────────────────────────

function InputSummaryWidget({ companyId, reviewId, onPrefill }) {
  const [dateFrom,       setDateFrom]       = useState(jan1Iso);
  const [dateTo,         setDateTo]         = useState(todayIso);
  const [data,           setData]           = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [drafting,       setDrafting]       = useState(false);
  const [draftError,     setDraftError]     = useState(null);
  const [draftGenerated, setDraftGenerated] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (companyId) params.set("company_id", companyId);
      const res = await apiService.get(`/management-reviews/input-summary?${params}`);
      setData(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.error || "Errore durante il caricamento dei dati.");
    } finally {
      setLoading(false);
    }
  }

  function buildNcText(nc) {
    const lines = [
      `NC aperte: ${nc.open}`,
      `NC scadute: ${nc.overdue}`,
      `NC chiuse nel periodo: ${nc.total_closed_period}`,
    ];
    if (nc.note) lines.push(`Nota: ${nc.note}`);
    return lines.join("\n");
  }

  function buildObjText(obj) {
    const lines = [
      `Obiettivi totali: ${obj.total}`,
      `Raggiunti: ${obj.achieved} (${obj.percentage}%)`,
    ];
    if (obj.note) lines.push(`Nota: ${obj.note}`);
    return lines.join("\n");
  }

  function buildAuditText(aud) {
    const lines = [
      `Audit condotti nel periodo: ${aud.conducted}`,
      `Audit pianificati/in corso: ${aud.planned}`,
    ];
    if (aud.note) lines.push(`Nota: ${aud.note}`);
    return lines.join("\n");
  }

  function buildSuppText(sup) {
    const lines = [
      `Fornitori valutati nel periodo: ${sup.evaluated}`,
      sup.avg_score != null ? `Score medio: ${sup.avg_score}` : "Score medio: n.d.",
    ];
    if (sup.note) lines.push(`Nota: ${sup.note}`);
    return lines.join("\n");
  }

  function buildCmpText(cmp) {
    const lines = [`Reclami ricevuti nel periodo: ${cmp.total}`];
    if (cmp.note) lines.push(`Nota: ${cmp.note}`);
    return lines.join("\n");
  }

  async function generateDraft() {
    if (!reviewId) return;
    setDrafting(true);
    setDraftError(null);
    setDraftGenerated(false);
    try {
      const body = { period_from: dateFrom, period_to: dateTo };
      if (companyId) body.company_id = companyId;
      const res = await apiService.post(`/management-reviews/${reviewId}/generate-draft`, body);
      const { drafts } = res.data;
      if (drafts.nc_summary)         onPrefill("input_nc_corrective", drafts.nc_summary);
      if (drafts.objectives_summary) onPrefill("input_objectives",    drafts.objectives_summary);
      if (drafts.audits_summary)     onPrefill("input_audits",        drafts.audits_summary);
      if (drafts.suppliers_summary)  onPrefill("input_suppliers",     drafts.suppliers_summary);
      if (drafts.norm_gaps)          onPrefill("input_improvements",  drafts.norm_gaps);
      setDraftGenerated(true);
    } catch (err) {
      setDraftError(err?.response?.data?.error || "Errore durante la generazione della bozza.");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="isw-card">
      <div className="isw-header">
        <h4>{"Dati disponibili \u00A79.3.2"}</h4>
        <div className="isw-controls">
          <label>{"Dal"}</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <label>{"al"}</label>
          <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   />
          <button
            type="button"
            className="btn-secondary"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Caricamento dati\u2026" : "Carica dati"}
          </button>
          {reviewId && (
            <button
              type="button"
              className="btn-primary isw-draft-btn"
              onClick={generateDraft}
              disabled={drafting}
              title={"Genera testi bozza per i campi \u00A79.3.2 dal riesame corrente"}
            >
              {drafting ? "Generazione\u2026" : "\u2728 Genera bozza testo"}
            </button>
          )}
        </div>
      </div>

      {draftGenerated && (
        <div className="isw-body">
          <p className="isw-draft-ok">{"Bozza generata e inserita nei campi \u00A79.3.2."}</p>
        </div>
      )}
      {draftError && <div className="isw-body"><p className="isw-error">{draftError}</p></div>}
      {error && <div className="isw-body"><p className="isw-error">{error}</p></div>}

      {data && (
        <div className="isw-body">
          <div className="isw-grid">
            {/* NC */}
            <div className="isw-tile">
              <div className="isw-tile-title">{"c) Non Conformit\u00E0"}</div>
              <div className="isw-tile-metrics">
                <div className="isw-metric">
                  <span className={`isw-metric-val${data.nc.open > 0 ? " isw-red" : ""}`}>
                    {data.nc.open}
                  </span>
                  <span className="isw-metric-lbl">{"Aperte"}</span>
                </div>
                <div className="isw-metric">
                  <span className={`isw-metric-val${data.nc.overdue > 0 ? " isw-red" : ""}`}>
                    {data.nc.overdue}
                  </span>
                  <span className="isw-metric-lbl">{"Scadute"}</span>
                </div>
                <div className="isw-metric">
                  <span className="isw-metric-val">{data.nc.total_closed_period}</span>
                  <span className="isw-metric-lbl">{"Chiuse"}</span>
                </div>
              </div>
              {data.nc.note && <p className="isw-tile-note">{data.nc.note}</p>}
              <button
                type="button"
                className="isw-prefill-btn"
                onClick={() => onPrefill("input_nc_corrective", buildNcText(data.nc))}
              >
                {"Pre-compila campo c)"}
              </button>
            </div>

            {/* Obiettivi */}
            <div className="isw-tile">
              <div className="isw-tile-title">{"d) Obiettivi"}</div>
              <div className="isw-tile-metrics">
                <div className="isw-metric">
                  <span className="isw-metric-val">{data.objectives.achieved}</span>
                  <span className="isw-metric-lbl">{"Raggiunti"}</span>
                </div>
                <div className="isw-metric">
                  <span className="isw-metric-val">{data.objectives.total}</span>
                  <span className="isw-metric-lbl">{"Totali"}</span>
                </div>
                <div className="isw-metric">
                  <span className="isw-metric-val">{data.objectives.percentage}{"%" }</span>
                  <span className="isw-metric-lbl">{"% raggiunto"}</span>
                </div>
              </div>
              {data.objectives.note && <p className="isw-tile-note">{data.objectives.note}</p>}
              <button
                type="button"
                className="isw-prefill-btn"
                onClick={() => onPrefill("input_objectives", buildObjText(data.objectives))}
              >
                {"Pre-compila campo d)"}
              </button>
            </div>

            {/* Audit */}
            <div className="isw-tile">
              <div className="isw-tile-title">{"b) Audit"}</div>
              <div className="isw-tile-metrics">
                <div className="isw-metric">
                  <span className="isw-metric-val">{data.audits.conducted}</span>
                  <span className="isw-metric-lbl">{"Condotti"}</span>
                </div>
                <div className="isw-metric">
                  <span className="isw-metric-val">{data.audits.planned}</span>
                  <span className="isw-metric-lbl">{"Pianificati"}</span>
                </div>
              </div>
              {data.audits.note && <p className="isw-tile-note">{data.audits.note}</p>}
              <button
                type="button"
                className="isw-prefill-btn"
                onClick={() => onPrefill("input_audits", buildAuditText(data.audits))}
              >
                {"Pre-compila campo b)"}
              </button>
            </div>

            {/* Fornitori */}
            <div className="isw-tile">
              <div className="isw-tile-title">{"f) Fornitori"}</div>
              <div className="isw-tile-metrics">
                <div className="isw-metric">
                  <span className="isw-metric-val">{data.suppliers.evaluated}</span>
                  <span className="isw-metric-lbl">{"Valutati"}</span>
                </div>
                {data.suppliers.avg_score != null && (
                  <div className="isw-metric">
                    <span className="isw-metric-val">{data.suppliers.avg_score}</span>
                    <span className="isw-metric-lbl">{"Score medio"}</span>
                  </div>
                )}
              </div>
              {data.suppliers.note && <p className="isw-tile-note">{data.suppliers.note}</p>}
              <button
                type="button"
                className="isw-prefill-btn"
                onClick={() => onPrefill("input_suppliers", buildSuppText(data.suppliers))}
              >
                {"Pre-compila campo f)"}
              </button>
            </div>

            {/* Reclami */}
            <div className="isw-tile">
              <div className="isw-tile-title">{"e) Reclami"}</div>
              <div className="isw-tile-metrics">
                <div className="isw-metric">
                  <span className={`isw-metric-val${data.complaints.total > 0 ? " isw-red" : ""}`}>
                    {data.complaints.total}
                  </span>
                  <span className="isw-metric-lbl">{"Ricevuti"}</span>
                </div>
              </div>
              {data.complaints.note && <p className="isw-tile-note">{data.complaints.note}</p>}
              <button
                type="button"
                className="isw-prefill-btn"
                onClick={() => onPrefill("input_complaints", buildCmpText(data.complaints))}
              >
                {"Pre-compila campo e)"}
              </button>
            </div>
          </div>

          {/* Copertura normativa */}
          {data.norm_coverage && data.norm_coverage.length > 0 && (
            <div>
              <div className="isw-tile-title" style={{ marginBottom: 6 }}>
                {"Copertura clausole normative"}
              </div>
              <ul className="isw-norm-list">
                {data.norm_coverage.map((item) => (
                  <li
                    key={item.clause}
                    className={`isw-norm-item${item.status === "gap" ? " isw-gap" : ""}`}
                  >
                    <span className="isw-norm-clause">{item.clause}</span>
                    <span>{item.title}</span>
                    {item.last_verified
                      ? <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#718096" }}>{item.last_verified}</span>
                      : <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#c53030" }}>{"Mai verificato"}</span>
                    }
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sezione collassabile ─────────────────────────────────────────────────────

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`mr-section ${open ? "mr-section--open" : ""}`}>
      <button
        type="button"
        className="mr-section-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="mr-section-icon">{open ? "\u25BC" : "\u25B6"}</span>
        {title}
      </button>
      {open && <div className="mr-section-body">{children}</div>}
    </div>
  );
}

// ─── Form completo ────────────────────────────────────────────────────────────

function ReviewForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function upd(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function handlePrefill(field, text) {
    setForm((f) => ({ ...f, [field]: f[field] ? `${f[field]}\n\n${text}` : text }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.review_date) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box mr-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {initial?.id
              ? `Modifica riesame ${initial.review_number}`
              : "Nuovo riesame di direzione"}
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi">
            {"\u2715"}
          </button>
        </div>

        <form className="mr-form" onSubmit={submit}>
          {/* 1. Intestazione */}
          <CollapsibleSection title="1 — Intestazione" defaultOpen>
            <div className="form-row">
              <label>Data riesame *</label>
              <input
                type="date"
                required
                value={form.review_date}
                onChange={(e) => upd("review_date", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>Presidente / Responsabile</label>
              <input
                value={form.chairperson}
                onChange={(e) => upd("chairperson", e.target.value)}
                placeholder="es. Direttore Qualità"
              />
            </div>
            <div className="form-row">
              <label>Stato</label>
              <select value={form.status} onChange={(e) => upd("status", e.target.value)}>
                <option value="draft">Bozza</option>
                <option value="finalized">Finalizzato</option>
                <option value="approved">Approvato</option>
              </select>
            </div>
          </CollapsibleSection>

          {/* 2. Partecipanti */}
          <CollapsibleSection title="2 — Partecipanti">
            <div className="form-row">
              <label>Elenco partecipanti</label>
              <textarea
                className="notes-textarea"
                rows={3}
                value={form.participants}
                onChange={(e) => upd("participants", e.target.value)}
                placeholder="Nome, Ruolo — uno per riga"
              />
            </div>
          </CollapsibleSection>

          {/* 3. §9.3.2 Input (8 campi) */}
          <CollapsibleSection title="3 — §9.3.2 Input del riesame">
            <InputSummaryWidget
              companyId={form.company_id || initial?.company_id || null}
              reviewId={initial?.id || null}
              onPrefill={handlePrefill}
            />
            {[
              { key: "input_previous_actions", label: "a) Azioni da precedenti riesami" },
              { key: "input_audits",           label: "b) Risultati degli audit" },
              { key: "input_nc_corrective",    label: "c) Non conformità e azioni correttive" },
              { key: "input_objectives",       label: "d) Monitoraggio e misurazione processi / obiettivi" },
              { key: "input_complaints",       label: "e) Reclami dei clienti" },
              { key: "input_suppliers",        label: "f) Prestazioni dei fornitori" },
              { key: "input_resources",        label: "g) Adeguatezza delle risorse" },
              { key: "input_improvements",     label: "h) Opportunità di miglioramento" },
            ].map(({ key, label }) => (
              <div className="form-row" key={key}>
                <label>{label}</label>
                <textarea
                  className="notes-textarea"
                  rows={3}
                  value={form[key]}
                  onChange={(e) => upd(key, e.target.value)}
                />
              </div>
            ))}
          </CollapsibleSection>

          {/* 4. §9.3.3 Output (3 campi) */}
          <CollapsibleSection title="4 — §9.3.3 Output del riesame">
            {[
              { key: "output_improvements",  label: "Opportunità di miglioramento" },
              { key: "output_sgq_changes",   label: "Modifiche al SGQ" },
              { key: "output_resources",     label: "Fabbisogno di risorse" },
            ].map(({ key, label }) => (
              <div className="form-row" key={key}>
                <label>{label}</label>
                <textarea
                  className="notes-textarea"
                  rows={3}
                  value={form[key]}
                  onChange={(e) => upd(key, e.target.value)}
                />
              </div>
            ))}
          </CollapsibleSection>

          {/* 5. Note */}
          <CollapsibleSection title="5 — Note e conclusioni">
            <div className="form-row">
              <label>Note generali</label>
              <textarea
                className="notes-textarea"
                rows={4}
                value={form.notes}
                onChange={(e) => upd("notes", e.target.value)}
              />
            </div>
          </CollapsibleSection>

          {error && <p className="mr-form-error">{error}</p>}

          <div className="mr-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Annulla
            </button>
            <button type="submit" className="btn-primary" disabled={saving || !form.review_date}>
              {saving ? "Salvataggio…" : initial?.id ? "Aggiorna" : "Crea riesame"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function ManagementReviewsPage() {
  const [reviews, setReviews]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [filterStatus, setFilter]   = useState("");
  const [delConfirm, setDelConfirm] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: pagination.page, limit: pagination.limit });
      if (filterStatus) params.set("status", filterStatus);
      const res = await apiService.get(`/management-reviews?${params}`);
      setReviews(res.data.data || []);
      if (res.data.pagination) setPagination((p) => ({ ...p, ...res.data.pagination }));
    } catch (err) {
      setError(err?.response?.data?.error || "Errore caricamento riesami.");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, pagination.page, pagination.limit]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  async function handleSave(formData) {
    if (editItem) {
      await apiService.put(`/management-reviews/${editItem.id}`, formData);
    } else {
      await apiService.post("/management-reviews", formData);
    }
    await fetchReviews();
  }

  async function handleDelete(id) {
    await apiService.delete(`/management-reviews/${id}`);
    setDelConfirm(null);
    await fetchReviews();
  }

  function openCreate() { setEditItem(null); setShowForm(true); }
  function openEdit(item) { setEditItem(item); setShowForm(true); }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="mr-page">
      <div className="mr-page-header">
        <div>
          <h1>Riesame di Direzione</h1>
          <p className="mr-page-sub">ISO 9001:2015 §9.3 — Verbali e output del riesame annuale</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          + Nuovo riesame
        </button>
      </div>

      {/* Toolbar filtri */}
      <div className="tab-toolbar">
        <select
          value={filterStatus}
          onChange={(e) => { setFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
        >
          <option value="">Tutti gli stati</option>
          <option value="draft">Bozza</option>
          <option value="finalized">Finalizzato</option>
          <option value="approved">Approvato</option>
        </select>
        <span className="mr-total">
          {pagination.total} riesame{pagination.total !== 1 ? "i" : ""}
        </span>
      </div>

      {/* Contenuto */}
      {loading && <p className="mr-loading">Caricamento…</p>}
      {error && <p className="mr-error">{error}</p>}

      {!loading && !error && reviews.length === 0 && (
        <div className="mr-empty">
          <p>Nessun riesame trovato.</p>
          <button className="btn-primary" onClick={openCreate}>Crea il primo riesame</button>
        </div>
      )}

      {!loading && reviews.length > 0 && (
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Data</th>
                <th>Presidente</th>
                <th>Azienda</th>
                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => {
                const sc = STATUS_CFG[r.status] || STATUS_CFG.draft;
                return (
                  <tr key={r.id}>
                    <td className="mr-number">{r.review_number}</td>
                    <td>{r.review_date ? formatDate(r.review_date) : "—"}</td>
                    <td>{r.chairperson || "—"}</td>
                    <td>{r.company_name || "—"}</td>
                    <td>
                      <span className={`mr-badge ${sc.cls}`}>{sc.label}</span>
                    </td>
                    <td className="mr-actions-cell">
                      <button
                        className="btn-icon-sm"
                        title="Modifica"
                        onClick={() => openEdit(r)}
                      >
                        {"\u270F\uFE0F"}
                      </button>
                      <button
                        className="btn-icon-sm btn-icon-danger"
                        title="Elimina"
                        onClick={() => setDelConfirm(r)}
                      >
                        {"\uD83D\uDDD1\uFE0F"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Paginazione */}
          {totalPages > 1 && (
            <div className="mr-pagination">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                {"\u2190"} Precedente
              </button>
              <span>
                Pagina {pagination.page} / {totalPages}
              </span>
              <button
                disabled={pagination.page >= totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                Successiva {"\u2192"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <ReviewForm
          initial={editItem || {}}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Confirm delete */}
      {delConfirm && (
        <div className="modal-overlay" onClick={() => setDelConfirm(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Elimina riesame</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDelConfirm(null)}
                aria-label="Chiudi"
              >
                {"\u2715"}
              </button>
            </div>
            <p>
              Eliminare definitivamente <strong>{delConfirm.review_number}</strong>?
            </p>
            <div className="mr-form-actions">
              <button className="btn-secondary" onClick={() => setDelConfirm(null)}>
                Annulla
              </button>
              <button
                className="btn-danger"
                onClick={() => handleDelete(delConfirm.id)}
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
