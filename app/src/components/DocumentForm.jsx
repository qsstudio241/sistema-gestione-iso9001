/**
 * DocumentForm — Modale per creazione e modifica documenti SGQ
 * Sprint 1 UX:
 *   - Nuovo documento: wizard 2 passi (essenziali → dettagli)
 *   - Modifica: form completo in una sola schermata
 *
 * Fix BUG-001: footer spostato fuori dal tag <form> per evitare
 * submit involontaria al click di "Avanti →" in alcuni browser.
 * La submit ora è gestita esplicitamente tramite onClick.
 */

import React, { useState, useEffect, useRef } from "react";
import apiService from "../services/apiService";
import "./DocumentForm.css";

const DOC_TYPES = [
  { value: "procedura",        label: "Procedura" },
  { value: "istruzione",       label: "Istruzione operativa" },
  { value: "modulo",           label: "Modulo / Registrazione" },
  { value: "manuale",          label: "Manuale" },
  { value: "qualifica",        label: "Qualifica personale" },
  { value: "wps",              label: "WPS (Procedura saldatura)" },
  { value: "wpqr",             label: "WPQR (Qualifica procedura)" },
  { value: "dichiarazione_ce", label: "Dichiarazione CE" },
  { value: "taratura",         label: "Certificato taratura" },
  { value: "altro",            label: "Altro" },
];

const DOC_STATUSES = [
  { value: "vigente",         label: "Vigente" },
  { value: "in_revisione",    label: "In revisione" },
  { value: "in_approvazione", label: "In approvazione" },
  { value: "obsoleto",        label: "Obsoleto" },
];

function toDateInput(val) {
  if (!val) return "";
  return val.substring(0, 10);
}

// ─── Indicatore step ──────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  return (
    <div className="wizard-steps">
      <div className={`wizard-step ${step >= 1 ? "step-active" : ""}`}>
        <span className="step-dot">1</span>
        <span className="step-label">Identificazione</span>
      </div>
      <div className="step-connector" />
      <div className={`wizard-step ${step >= 2 ? "step-active" : ""}`}>
        <span className="step-dot">2</span>
        <span className="step-label">Dettagli</span>
      </div>
    </div>
  );
}

// ─── Componente principale ────────────────────────────────────────────────────

function DocumentForm({ doc, companies, standards, onSave, onClose }) {
  const isEdit = !!doc;
  const [step, setStep] = useState(1);
  // Timestamp di mount: previene ghost-click mobile che chiuderebbe l'overlay
  // ~300ms dopo il tap sul pulsante che ha aperto questa modale.
  const openTimeRef = useRef(Date.now());

  const [form, setForm] = useState({
    doc_type:        doc?.doc_type        || "procedura",
    doc_code:        doc?.doc_code        || "",
    title:           doc?.title           || "",
    revision:        doc?.revision        || "",
    status:          doc?.status          || "vigente",
    issue_date:      toDateInput(doc?.issue_date),
    expiry_date:     toDateInput(doc?.expiry_date),
    responsible:     doc?.responsible     || "",
    retention_years: doc?.retention_years || "",
    standard_id:     doc?.standard_id     || "",
    clause_ref:      doc?.clause_ref      || "",
    company_id:      doc?.company_id      || "",
    notes:           doc?.notes           || "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleChange = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const step1Valid = form.title.trim().length > 0;

  // Avanza dal passo 1 al passo 2 — NON salva nulla
  const handleNext = () => {
    if (!step1Valid) { setError("Il titolo è obbligatorio."); return; }
    setError(null);
    setStep(2);
  };

  const handleBack = () => { setError(null); setStep(1); };

  // Salvataggio effettivo (chiamato solo dal pulsante "Crea" o "Salva modifiche")
  const handleSave = async () => {
    if (!form.title.trim()) { setError("Il titolo è obbligatorio."); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        retention_years: form.retention_years ? parseInt(form.retention_years) : null,
        standard_id:     form.standard_id     ? parseInt(form.standard_id)     : null,
        company_id:      form.company_id       ? parseInt(form.company_id)      : null,
        issue_date:      form.issue_date       || null,
        expiry_date:     form.expiry_date      || null,
        doc_code:        form.doc_code.trim()  || null,
        revision:        form.revision.trim()  || null,
        responsible:     form.responsible.trim() || null,
        clause_ref:      form.clause_ref.trim() || null,
        notes:           form.notes.trim()     || null,
      };
      if (isEdit) {
        await apiService.updateDocument(doc.id, payload);
      } else {
        await apiService.createDocument(payload);
      }
      onSave();
    } catch (err) {
      setError(err.message || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Sezioni form ──────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="docform-step-content">
      <div className="docform-field">
        <label>Tipo documento <span className="required">*</span></label>
        <div className="doc-type-grid">
          {DOC_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`doc-type-chip ${form.doc_type === t.value ? "doc-type-chip-active" : ""}`}
              onClick={() => setForm((f) => ({ ...f, doc_type: t.value }))}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="docform-field">
        <label>Titolo <span className="required">*</span></label>
        <input
          type="text"
          placeholder="es. Procedura Controllo Qualità Saldature"
          value={form.title}
          onChange={handleChange("title")}
          autoFocus={!isEdit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNext(); } }}
        />
      </div>

      <div className="docform-row">
        <div className="docform-field">
          <label>Codice documento</label>
          <input
            type="text"
            placeholder="es. PG-01, WPS-141-001"
            value={form.doc_code}
            onChange={handleChange("doc_code")}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNext(); } }}
          />
        </div>
        {companies.length > 0 && (
          <div className="docform-field">
            <label>Azienda</label>
            <select value={form.company_id} onChange={handleChange("company_id")}>
              <option value="">— Documento di studio —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2orEdit = () => (
    <div className="docform-step-content">
      {isEdit && (
        <>
          <div className="docform-field">
            <label>Tipo documento</label>
            <select value={form.doc_type} onChange={handleChange("doc_type")}>
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="docform-field">
            <label>Titolo <span className="required">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={handleChange("title")}
              autoFocus
            />
          </div>
          <div className="docform-row">
            <div className="docform-field">
              <label>Codice documento</label>
              <input type="text" value={form.doc_code} onChange={handleChange("doc_code")} />
            </div>
            {companies.length > 0 && (
              <div className="docform-field">
                <label>Azienda</label>
                <select value={form.company_id} onChange={handleChange("company_id")}>
                  <option value="">— Documento di studio —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <hr className="docform-divider" />
        </>
      )}

      <div className="docform-row">
        <div className="docform-field docform-field-sm">
          <label>Revisione</label>
          <input
            type="text"
            placeholder="es. Rev.2"
            value={form.revision}
            onChange={handleChange("revision")}
          />
        </div>
        <div className="docform-field">
          <label>Stato</label>
          <select value={form.status} onChange={handleChange("status")}>
            {DOC_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="docform-row">
        <div className="docform-field">
          <label>Data emissione</label>
          <input type="date" value={form.issue_date} onChange={handleChange("issue_date")} />
        </div>
        <div className="docform-field">
          <label>Data scadenza</label>
          <input type="date" value={form.expiry_date} onChange={handleChange("expiry_date")} />
        </div>
      </div>

      <div className="docform-row">
        <div className="docform-field">
          <label>Responsabile</label>
          <input
            type="text"
            placeholder="Nome / funzione"
            value={form.responsible}
            onChange={handleChange("responsible")}
          />
        </div>
        <div className="docform-field docform-field-xs">
          <label>Conservazione (anni)</label>
          <input
            type="number"
            min="1"
            max="99"
            placeholder="10"
            value={form.retention_years}
            onChange={handleChange("retention_years")}
          />
        </div>
      </div>

      <div className="docform-row">
        <div className="docform-field">
          <label>Norma di riferimento</label>
          <select value={form.standard_id} onChange={handleChange("standard_id")}>
            <option value="">— Nessuna —</option>
            {standards.map((s) => (
              <option key={s.standard_id} value={s.standard_id}>
                {s.standard_code} — {s.standard_name}
              </option>
            ))}
          </select>
        </div>
        <div className="docform-field docform-field-sm">
          <label>Paragrafo</label>
          <input
            type="text"
            placeholder="es. 7.5"
            value={form.clause_ref}
            onChange={handleChange("clause_ref")}
            disabled={!form.standard_id}
          />
        </div>
      </div>

      <div className="docform-field">
        <label>Note</label>
        <textarea
          rows={3}
          placeholder="Note aggiuntive..."
          value={form.notes}
          onChange={handleChange("notes")}
        />
      </div>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  // Il footer è FUORI dal tag <form> per evitare submit involontaria.
  // La submit è gestita esclusivamente tramite onClick su "Crea documento" / "Salva modifiche".

  return (
    <div className="docform-overlay" onClick={(e) => {
      if (e.target !== e.currentTarget) return;
      if (Date.now() - openTimeRef.current < 350) return;
      onClose();
    }}>
      <div className="docform-modal">

        {/* Header */}
        <div className="docform-header">
          <h3>{isEdit ? `Modifica — ${doc.title}` : "Nuovo documento"}</h3>
          <button className="docform-close" type="button" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        {/* Indicatore wizard (solo nuovo) */}
        {!isEdit && <StepIndicator step={step} />}

        {/* Corpo — div invece di form, niente submit automatica */}
        <div className="docform-body">
          {!isEdit
            ? (step === 1 ? renderStep1() : renderStep2orEdit())
            : renderStep2orEdit()
          }

          {/* Errore */}
          {error && <div className="docform-error">⚠️ {error}</div>}
        </div>

        {/* Footer — fuori dal body scrollabile, fuori da qualsiasi form */}
        <div className="docform-footer">
          {!isEdit && step === 1 && (
            <>
              <button type="button" className="btn-cancel" onClick={onClose}>Annulla</button>
              <button
                type="button"
                className="btn-save"
                onClick={handleNext}
                disabled={!step1Valid}
              >
                Avanti →
              </button>
            </>
          )}
          {!isEdit && step === 2 && (
            <>
              <button type="button" className="btn-cancel" onClick={handleBack}>← Indietro</button>
              <button
                type="button"
                className="btn-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Salvataggio..." : "Crea documento"}
              </button>
            </>
          )}
          {isEdit && (
            <>
              <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>Annulla</button>
              <button
                type="button"
                className="btn-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Salvataggio..." : "Salva modifiche"}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

export default DocumentForm;
