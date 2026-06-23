/**
 * ManagementReviewsPage — Riesame di Direzione ISO 9001 §9.3
 * Lista riesami + form completo con sezioni collassabili ISO.
 * Include widget "Dati disponibili §9.3.2" per pre-compilazione AI-assisted.
 * Pattern "Ambito" (company scope) identico a QualificationsPage e DocumentRegistry.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiService from "../services/apiService";
import ParticipantsList from "../components/ParticipantsList";
import { formatDate } from "../utils/dateHelpers";
import {
  resolveInitialMgmtReviewCompanyScope,
  persistMgmtReviewCompanyScope,
} from "../utils/managementReviewsCompanyScope";
import { exportManagementReviewDocx } from "../utils/wordExportReview";
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
  participants: [],
  status: "draft",
  company_id: "",
  input_previous_actions: "",
  input_context_changes: "",
  input_audits: "",
  input_nc_corrective: "",
  input_objectives: "",
  input_complaints: "",
  input_customer_satisfaction: "",
  input_suppliers: "",
  input_resources: "",
  input_improvements: "",
  input_process_performance: "",
  input_risk_effectiveness: "",
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

// onPrefill  → ACCODA al testo esistente (pulsanti singoli "Pre-compila campo X")
// onFillAll  → SOSTITUISCE tutti i campi auto-popolati (pulsante "Genera bozza")
// reviewId   → se presente (riesame gia salvato) usa l'endpoint backend (AI o fallback
//              deterministico server); altrimenti ricade sui template locali.
export function InputSummaryWidget({ companyId, reviewId, onPrefill, onFillAll }) {
  const [dateFrom,  setDateFrom]  = useState(jan1Iso);
  const [dateTo,    setDateTo]    = useState(todayIso);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [filled,    setFilled]    = useState(false);
  const [drafting,  setDrafting]  = useState(false);
  // null = non ancora generato; 'ai' = testo da provider LLM; 'auto' = bozza deterministica
  const [draftMode, setDraftMode] = useState(null);

  // Auto-carica i dati §9.3.2 all'apertura della sezione
  useEffect(() => {
    doLoad(jan1Iso(), todayIso(), companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doLoad(from, to, cid) {
    setLoading(true);
    setError(null);
    setFilled(false);
    try {
      const params = new URLSearchParams({ date_from: from, date_to: to });
      if (cid) params.set("company_id", cid);
      const res = await apiService.get(`/management-reviews/input-summary?${params}`);
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || "Errore durante il caricamento dei dati.");
    } finally {
      setLoading(false);
    }
  }

  function loadData() {
    doLoad(dateFrom, dateTo, companyId);
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

  function buildSatisfText(cmp) {
    const lines = [
      `Reclami formali ricevuti nel periodo: ${cmp.total}`,
      "Livello soddisfazione cliente: [da rilevare — es. sondaggio, feedback diretto, tasso riacquisto]",
    ];
    if (cmp.note) lines.push(`Nota reclami: ${cmp.note}`);
    return lines.join("\n");
  }

  // Template locali deterministici (comportamento storico, usato come fallback)
  function applyLocalDrafts() {
    if (!data) return;
    const fill = onFillAll || onPrefill; // onFillAll sostituisce, onPrefill accoda
    if (data.nc)         fill("input_nc_corrective",         buildNcText(data.nc));
    if (data.objectives) fill("input_objectives",            buildObjText(data.objectives));
    if (data.audits)     fill("input_audits",                buildAuditText(data.audits));
    if (data.suppliers)  fill("input_suppliers",             buildSuppText(data.suppliers));
    if (data.complaints) fill("input_complaints",            buildCmpText(data.complaints));
    if (data.complaints) fill("input_customer_satisfaction", buildSatisfText(data.complaints));
  }

  // Compila (SOSTITUISCE) i campi §9.3.2.
  // Se il riesame è già salvato → usa l'endpoint backend (AI se configurata, altrimenti
  // testo deterministico server-side). In assenza di id o in caso di errore → template locali.
  async function generateAllFields() {
    if (!data) return;
    const fill = onFillAll || onPrefill; // onFillAll sostituisce, onPrefill accoda

    if (reviewId) {
      setDrafting(true);
      try {
        const res = await apiService.post(`/management-reviews/${reviewId}/generate-draft`, {
          company_id:  companyId || undefined,
          period_from: dateFrom,
          period_to:   dateTo,
        });
        const drafts = res?.drafts;
        if (drafts) {
          // I 5 summary generati dal backend (NC, obiettivi, audit, fornitori, gap normativi)
          if (drafts.nc_summary)         fill("input_nc_corrective", drafts.nc_summary);
          if (drafts.objectives_summary) fill("input_objectives",    drafts.objectives_summary);
          if (drafts.audits_summary)     fill("input_audits",        drafts.audits_summary);
          if (drafts.suppliers_summary)  fill("input_suppliers",     drafts.suppliers_summary);
          if (drafts.norm_gaps)          fill("input_improvements",  drafts.norm_gaps);
          // Campi non coperti dall'endpoint: template locali sui dati già caricati
          if (data.complaints) fill("input_complaints",            buildCmpText(data.complaints));
          if (data.complaints) fill("input_customer_satisfaction", buildSatisfText(data.complaints));
          setDraftMode(res?.meta?.ai_used === true ? "ai" : "auto");
          setFilled(true);
          return;
        }
      } catch (_) {
        // Graceful degradation: nessun blocco UI, si ricade sui template locali.
      } finally {
        setDrafting(false);
      }
    }

    // Fallback: riesame non salvato o chiamata fallita → comportamento storico locale
    applyLocalDrafts();
    setDraftMode("auto");
    setFilled(true);
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
            {loading ? "Caricamento\u2026" : "Aggiorna dati"}
          </button>
          <button
            type="button"
            className="btn-primary isw-draft-btn"
            onClick={generateAllFields}
            disabled={!data || loading || drafting}
            title={
              data
                ? "Compila automaticamente tutti i campi \u00A79.3.2 con i dati del periodo"
                : "Attendere il caricamento dei dati\u2026"
            }
          >
            {drafting ? "Generazione\u2026" : "\u2728 Genera bozza testo"}
          </button>
        </div>
      </div>

      {filled && (
        <div className="isw-body">
          <p className="isw-draft-ok">
            {"Campi \u00A79.3.2 compilati con i dati del periodo."}
            {draftMode === "ai" && (
              <span className="mr-badge mr-approved" style={{ marginLeft: 8 }}>{"AI attiva"}</span>
            )}
            {draftMode === "auto" && (
              <span className="mr-badge mr-draft" style={{ marginLeft: 8 }}>{"Bozza automatica"}</span>
            )}
          </p>
        </div>
      )}
      {loading && !data && (
        <div className="isw-body">
          <p className="isw-loading">{"Caricamento dati in corso\u2026"}</p>
        </div>
      )}
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

            {/* Azioni precedenti */}
            <div className="isw-tile">
              <div className="isw-tile-title">{"a) Azioni da precedenti riesami"}</div>
              <p className="isw-tile-note">
                {"Inserire manualmente lo stato delle azioni definite nel riesame precedente."}
              </p>
              <button
                type="button"
                className="isw-prefill-btn"
                onClick={() =>
                  onPrefill(
                    "input_previous_actions",
                    "Azioni definite nel precedente riesame:\n- [Azione 1]: [stato avanzamento]\n- [Azione 2]: [stato avanzamento]"
                  )
                }
              >
                {"Pre-compila campo a)"}
              </button>
            </div>

            {/* Risorse */}
            <div className="isw-tile">
              <div className="isw-tile-title">{"g) Adeguatezza delle risorse"}</div>
              <p className="isw-tile-note">
                {"Valutare l\u2019adeguatezza di risorse umane, infrastrutture e ambiente di lavoro."}
              </p>
              <button
                type="button"
                className="isw-prefill-btn"
                onClick={() =>
                  onPrefill(
                    "input_resources",
                    "Valutazione risorse:\nRisorse umane: [adeguate / da integrare]\nInfrastrutture: [adeguate / interventi previsti]\nAmbiente di lavoro: [adeguato / miglioramenti previsti]"
                  )
                }
              >
                {"Pre-compila campo g)"}
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

/** Deserializza participants da stringa JSON (dati legacy o server) → array [{name,role}] */
function parseParticipants(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fallback: testo libero "Nome, Ruolo — uno per riga"
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const comma = line.indexOf(",");
        return comma > -1
          ? { name: line.slice(0, comma).trim(), role: line.slice(comma + 1).trim() }
          : { name: line, role: "" };
      });
  }
  return [];
}

function ReviewForm({ initial, onSave, onClose, companies = [], companyScope = "", scopeCompanyName = "" }) {
  const [form, setForm] = useState(() => {
    const base = { ...EMPTY_FORM, ...initial };
    return { ...base, participants: parseParticipants(base.participants) };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function upd(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  // Accoda al testo esistente (pulsanti singoli "Pre-compila campo X")
  function handlePrefill(field, text) {
    setForm((f) => ({ ...f, [field]: f[field] ? `${f[field]}\n\n${text}` : text }));
  }

  // Sostituisce il campo (usato da "Genera bozza" per non duplicare al secondo click)
  function handleFillReplace(field, text) {
    setForm((f) => ({ ...f, [field]: text }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.review_date) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        participants: Array.isArray(form.participants)
          ? JSON.stringify(form.participants)
          : (form.participants || ""),
      };
      await onSave(payload);
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
            {companies.length > 0 && (
              <div className="form-row">
                <label>{"Azienda"}</label>
                {companyScope ? (
                  /* Ambito attivo → mostra come testo fisso (non modificabile dal form) */
                  <span className="mr-scope-fixed">
                    {scopeCompanyName}
                    <span className="mr-scope-fixed-hint">{" (da ambito)"}</span>
                  </span>
                ) : (
                  /* Nessun ambito → selezione libera */
                  <select
                    value={form.company_id || ""}
                    onChange={(e) => upd("company_id", e.target.value || null)}
                  >
                    <option value="">{"— Nessuna azienda —"}</option>
                    {companies.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
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
            <ParticipantsList
              participants={form.participants}
              onChange={(list) => upd("participants", list)}
              companyId={form.company_id || initial?.company_id || null}
            />
          </CollapsibleSection>

          {/* 3. §9.3.2 Input (8 campi) */}
          <CollapsibleSection title="3 — §9.3.2 Input del riesame">
            {/* key forza re-mount (e nuovo auto-load) se l'utente cambia azienda */}
            <InputSummaryWidget
              key={form.company_id || initial?.company_id || "nessuna-azienda"}
              companyId={form.company_id || initial?.company_id || null}
              reviewId={initial?.id || null}
              onPrefill={handlePrefill}
              onFillAll={handleFillReplace}
            />
            {[
              { key: "input_previous_actions",      label: "a) Azioni da precedenti riesami" },
              { key: "input_context_changes",       label: "b) Cambiamenti nel contesto dell\u2019organizzazione rilevanti per il SGQ" },
              { key: "input_audits",                label: "c.6) Risultati degli audit interni" },
              { key: "input_nc_corrective",         label: "c.4) Non conformit\u00E0 e azioni correttive" },
              { key: "input_objectives",            label: "c.2) Stato degli obiettivi per la qualit\u00E0" },
              { key: "input_process_performance",   label: "c.3) Prestazioni dei processi e conformit\u00E0 di prodotti/servizi" },
              { key: "input_customer_satisfaction", label: "c.1) Soddisfazione del cliente e feedback delle parti interessate" },
              { key: "input_complaints",            label: "e.reclami) Reclami dei clienti (dettaglio)" },
              { key: "input_suppliers",             label: "c.7) Prestazioni dei fornitori esterni" },
              { key: "input_resources",             label: "d) Adeguatezza delle risorse" },
              { key: "input_risk_effectiveness",    label: "e) Efficacia delle azioni intraprese per affrontare rischi e opportunit\u00E0" },
              { key: "input_improvements",          label: "f) Opportunit\u00E0 di miglioramento" },
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

// ─── Anni disponibili per il filtro (anno corrente ± 4) ─────────────────────

function buildYearOptions() {
  const cur = new Date().getFullYear();
  const opts = [];
  for (let y = cur + 1; y >= cur - 4; y--) opts.push(y);
  return opts;
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function ManagementReviewsPage() {
  const [reviews, setReviews]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [filterStatus, setFilter]   = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [companies, setCompanies]   = useState([]);
  const [delConfirm, setDelConfirm] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [exportingId, setExportingId] = useState(null);

  // ── Ambito azienda (pattern condiviso con Qualifiche, Registro documenti) ──
  const [companyScope, setCompanyScope] = useState(
    () => resolveInitialMgmtReviewCompanyScope()
  );

  const handleCompanyScopeChange = useCallback((value) => {
    setCompanyScope(value);
    persistMgmtReviewCompanyScope(value);
    setPagination((p) => ({ ...p, page: 1 }));
  }, []);

  const scopeCompanyName = useMemo(() => {
    if (!companyScope) return "Tutto lo studio";
    const match = companies.find((c) => String(c.id) === String(companyScope));
    return match?.name || `Azienda #${companyScope}`;
  }, [companyScope, companies]);

  useEffect(() => {
    apiService.getCompanies()
      .then((res) => {
        const list = res?.data || [];
        setCompanies(list);
        // Auto-selezione se l'utente ha accesso ad una sola azienda
        if (list.length === 1 && !companyScope) {
          const onlyId = String(list[0].id);
          setCompanyScope(onlyId);
          persistMgmtReviewCompanyScope(onlyId);
        }
      })
      .catch(() => setCompanies([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: pagination.page, limit: pagination.limit });
      if (filterStatus)  params.set("status",     filterStatus);
      if (filterYear)    params.set("year",        filterYear);
      if (companyScope)  params.set("company_id",  companyScope);
      const res = await apiService.get(`/management-reviews?${params}`);
      setReviews(res.data || []);
      if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
    } catch (err) {
      setError(err?.response?.data?.error || "Errore caricamento riesami.");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterYear, companyScope, pagination.page, pagination.limit]);

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

  async function handleExport(r) {
    setExportingId(r.id);
    try {
      // Carica i dati completi del riesame (la lista ha campi parziali)
      const res = await apiService.get(`/management-reviews/${r.id}`);
      const full = res.data;
      await exportManagementReviewDocx(full);
    } catch (err) {
      alert(`Errore export Word: ${err.message}`);
    } finally {
      setExportingId(null);
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="mr-page">
      {/* ── Header con selettore Ambito ── */}
      <div className="mr-page-header">
        <div>
          <h1>Riesame di Direzione</h1>
          <p className="mr-page-sub">{"ISO 9001:2015 \u00A79.3 \u2014 Verbali e output del riesame annuale"}</p>
        </div>
        <div className="mr-header-actions">
          {companies.length > 0 && (
            <label className="mr-scope-label">
              {"Ambito:"}
              <select
                className="mr-scope-select"
                value={companyScope}
                onChange={(e) => handleCompanyScopeChange(e.target.value)}
                aria-label="Ambito riesame per azienda"
              >
                <option value="">{"Tutto lo studio"}</option>
                {companies.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
          <button className="btn-primary" onClick={openCreate}>
            {"+ Nuovo riesame"}
          </button>
        </div>
      </div>

      {/* Hint ambito attivo */}
      {companyScope && (
        <p className="mr-scope-hint">{"Ambito attivo: "}{scopeCompanyName}</p>
      )}

      {/* ── Toolbar filtri secondari ── */}
      <div className="tab-toolbar">
        <select
          value={filterStatus}
          onChange={(e) => { setFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
        >
          <option value="">{"Tutti gli stati"}</option>
          <option value="draft">{"Bozza"}</option>
          <option value="finalized">{"Finalizzato"}</option>
          <option value="approved">{"Approvato"}</option>
        </select>

        <select
          value={filterYear}
          onChange={(e) => { setFilterYear(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
        >
          <option value="">{"Tutti gli anni"}</option>
          {buildYearOptions().map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>

        <span className="mr-total">
          {pagination.total}{" riesame"}{pagination.total !== 1 ? "i" : ""}
        </span>
      </div>

      {/* ── Contenuto ── */}
      {loading && <p className="mr-loading">{"Caricamento\u2026"}</p>}
      {error && <p className="mr-error">{error}</p>}

      {!loading && !error && reviews.length === 0 && (
        <div className="mr-empty">
          <p>{"Nessun riesame trovato."}</p>
          <button className="btn-primary" onClick={openCreate}>{"Crea il primo riesame"}</button>
        </div>
      )}

      {!loading && reviews.length > 0 && (
        <div className="mr-table-wrap">
          <table className="mr-table">
            <thead>
              <tr>
                <th>{"Numero"}</th>
                <th>{"Data"}</th>
                <th>{"Presidente"}</th>
                {!companyScope && <th>{"Azienda"}</th>}
                <th>{"Stato"}</th>
                <th>{"Azioni"}</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => {
                const sc = STATUS_CFG[r.status] || STATUS_CFG.draft;
                return (
                  <tr key={r.id}>
                    <td className="mr-number">{r.review_number}</td>
                    <td>{r.review_date ? formatDate(r.review_date) : "\u2014"}</td>
                    <td>{r.chairperson || "\u2014"}</td>
                    {!companyScope && <td>{r.company_name || "\u2014"}</td>}
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
                        className="btn-icon-sm btn-icon-export"
                        title="Esporta verbale Word (\u00A77.5)"
                        onClick={() => handleExport(r)}
                        disabled={exportingId === r.id}
                      >
                        {exportingId === r.id ? "\u23F3" : "\uD83D\uDCCB"}
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
                {"\u2190 Precedente"}
              </button>
              <span>{"Pagina "}{pagination.page}{" / "}{totalPages}</span>
              <button
                disabled={pagination.page >= totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                {"Successiva \u2192"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Modal form ── */}
      {showForm && (
        <ReviewForm
          initial={editItem
            ? { ...editItem }
            : { company_id: companyScope || "" }
          }
          onSave={handleSave}
          onClose={() => setShowForm(false)}
          companies={companies}
          companyScope={companyScope}
          scopeCompanyName={scopeCompanyName}
        />
      )}

      {/* ── Confirm delete ── */}
      {delConfirm && (
        <div className="modal-overlay" onClick={() => setDelConfirm(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{"Elimina riesame"}</h3>
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
              {"Eliminare definitivamente "}<strong>{delConfirm.review_number}</strong>{"?"}
            </p>
            <div className="mr-form-actions">
              <button className="btn-secondary" onClick={() => setDelConfirm(null)}>
                {"Annulla"}
              </button>
              <button
                className="btn-danger"
                onClick={() => handleDelete(delConfirm.id)}
              >
                {"Elimina"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
