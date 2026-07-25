/**
 * NcCreateModal — creazione NC / Azione Piano Azioni (source_type manual)
 * Supporta categorie multi-fonte: audit, reclamo, rischi, riesame, miglioramento, operativo, esterno
 * ISO 9001:2015 §6.1 + §9.3 + §10.2 + §10.3
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import NcResponsibleSelect from "./NcResponsibleSelect";
import RichTextField, {
  resolveNcFieldInitial,
  clearNcFieldDraftsForScope,
} from "./RichTextField";
import {
  NC_MANUAL_SECTIONS,
  NC_SOURCE_CATEGORIES,
  NC_SOURCE_CATEGORY_OPTIONS,
  buildManualNcPayload,
  mapApiSectionsToOptions,
} from "../utils/ncCreateHelpers";
import {
  loadNcResponsibleContacts,
  NC_SCOPE_ATTUAZIONE,
} from "../utils/ncResponsibleContacts";
import "../components/ChecklistModule.css";

const CREATE_SCOPE = "nc-create";

const SEVERITY_OPTIONS = [
  { value: "major",       label: "Grave" },
  { value: "minor",       label: "Lieve" },
  { value: "observation", label: "Osservazione" },
];

const EMPTY_FORM = {
  source_category:    "audit",
  source_origin_text: "",
  audit_id:           "",
  section_code:       "",
  description:        "",
  severity:           "minor",
  responsible_person: "",
  responsible_contact_id: null,
  due_date:           "",
  source_complaint_id: null,
  company_id:         "",
};

export default function NcCreateModal({
  open, onClose, onCreated, defaultCategory, initialDescription,
  managementReviewId = null, initialOriginText = "",
  initialSectionCode = null, sourceRiskId = null,
}) {
  const { user } = useAuth();
  const organizationId = user?.organization_id ?? null;

  const [audits, setAudits]               = useState([]);
  const [sectionOptions, setSectionOptions] = useState(NC_MANUAL_SECTIONS);
  const [loadingAudits, setLoadingAudits]   = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState(null);
  const [contacts, setContacts]           = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [complaints, setComplaints]       = useState([]);
  const [companies, setCompanies]         = useState([]);

  const categoryConfig = NC_SOURCE_CATEGORIES[form.source_category] || NC_SOURCE_CATEGORIES.audit;
  const requiresAudit  = categoryConfig.requiresAudit;

  /* ── Carica contatti responsabile ─────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadNcResponsibleContacts(apiService, {
      companyId: selectedCompanyId,
      scope: NC_SCOPE_ATTUAZIONE,
    })
      .then(rows => { if (!cancelled) setContacts(rows); })
      .catch(() => { if (!cancelled) setContacts([]); });
    return () => { cancelled = true; };
  }, [open, selectedCompanyId]);

  /* ── Carica aziende per selettore ambito (categorie non legate ad audit) ── */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiService.getCompanies({ limit: 500 })
      .then(res => { if (!cancelled) setCompanies(res?.data || []); })
      .catch(() => { if (!cancelled) setCompanies([]); });
    return () => { cancelled = true; };
  }, [open]);

  /* ── Carica reclami quando source_category = 'complaint' ─────── */
  useEffect(() => {
    if (!open || form.source_category !== 'complaint') { setComplaints([]); return; }
    let cancelled = false;
    apiService.getComplaints({ limit: 50, status: '' })
      .then(res => { if (!cancelled) setComplaints(res?.data || []); })
      .catch(() => { if (!cancelled) setComplaints([]); });
    return () => { cancelled = true; };
  }, [open, form.source_category]);

  /* ── Reset form all'apertura ──────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const initCategory = defaultCategory || "audit";
    const catCfg = NC_SOURCE_CATEGORIES[initCategory] || NC_SOURCE_CATEGORIES.audit;
    setForm({
      ...EMPTY_FORM,
      source_category: initCategory,
      section_code: initialSectionCode || catCfg.defaultSection || "",
      source_origin_text: initialOriginText || "",
      description: resolveNcFieldInitial(initialDescription || "", organizationId, CREATE_SCOPE, "description"),
    });
    setSectionOptions(NC_MANUAL_SECTIONS);
    setError(null);
    setLoadingAudits(true);
    apiService.getAudits({ limit: 100 })
      .then(res => {
        const rows = res?.data || [];
        const openish = rows.filter(a => a.status !== "completed" && a.status !== "approved");
        setAudits(openish.length ? openish : rows);
      })
      .catch(() => setAudits([]))
      .finally(() => setLoadingAudits(false));
  }, [open, organizationId, defaultCategory, initialDescription, initialOriginText, initialSectionCode]);

  /* ── Carica sezioni dall'audit selezionato ────────────────────── */
  useEffect(() => {
    if (!open || !requiresAudit || !form.audit_id) {
      if (!requiresAudit) {
        // Categorie non-audit: usa sezioni ISO 9001 standard
        setSectionOptions(NC_MANUAL_SECTIONS);
        setSelectedCompanyId(null);
      }
      return;
    }
    let cancelled = false;
    setLoadingSections(true);
    apiService.getAudit(form.audit_id)
      .then(res => {
        const audit = res?.data || res;
        if (!cancelled) setSelectedCompanyId(audit?.company_id ?? null);
        const standardId = audit?.standards?.[0]?.standard_id;
        if (!standardId) {
          if (!cancelled) {
            setSectionOptions(NC_MANUAL_SECTIONS);
            setForm(f => ({ ...f, section_code: NC_MANUAL_SECTIONS[6]?.value || "clause10" }));
          }
          return null;
        }
        return apiService.getChecklistSectionsByStandard(standardId);
      })
      .then(sectionsRes => {
        if (cancelled || !sectionsRes) return;
        const opts = mapApiSectionsToOptions(sectionsRes?.sections || sectionsRes?.data?.sections);
        if (opts.length) {
          setSectionOptions(opts);
          setForm(f => ({
            ...f,
            section_code: opts.some(o => o.value === f.section_code) ? f.section_code : opts[0].value,
          }));
        }
      })
      .catch(() => { if (!cancelled) setSectionOptions(NC_MANUAL_SECTIONS); })
      .finally(() => { if (!cancelled) setLoadingSections(false); });
    return () => { cancelled = true; };
  }, [open, form.audit_id, requiresAudit]);

  if (!open) return null;

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleCategoryChange(newCat) {
    const cfg = NC_SOURCE_CATEGORIES[newCat] || NC_SOURCE_CATEGORIES.audit;
    setForm(f => ({
      ...f,
      source_category: newCat,
      section_code: cfg.defaultSection || f.section_code,
      // Reset audit_id se si passa a categoria non-audit
      audit_id: cfg.requiresAudit ? f.audit_id : "",
      // Reset complaint se si passa ad altra categoria
      source_complaint_id: newCat === 'complaint' ? f.source_complaint_id : null,
    }));
    setSectionOptions(NC_MANUAL_SECTIONS);
    setSelectedCompanyId(null);
  }

  const selectedAudit = audits.find(a => String(a.audit_id) === String(form.audit_id));

  async function handleSubmit(e) {
    e.preventDefault();
    const built = buildManualNcPayload(
      { ...form, management_review_id: managementReviewId },
      selectedAudit?.audit_number,
    );
    if (!built.ok) { setError(built.message); return; }
    if (sourceRiskId) built.payload.source_risk_id = sourceRiskId;
    setSaving(true);
    setError(null);
    try {
      const res = await apiService.createNonConformity(built.payload);
      const created = res?.data || res;
      if (organizationId) {
        clearNcFieldDraftsForScope(organizationId, CREATE_SCOPE, ["description"]);
      }
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      // apiService lancia ApiError con { message, code, data } diretti sull'oggetto
      // (non è un errore stile axios con .response.data — vedi apiService.js ApiError).
      const code = err?.code;
      const msg = err?.message
        || (code === "INVALID_SECTION_FOR_STANDARD"
          ? "Sezione non valida per lo standard dell\u2019audit selezionato."
          : "Errore durante la creazione.");
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const isAuditCat = requiresAudit;

  return (
    <div className="nc-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="nc-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="nc-create-title"
      >
        <h3 id="nc-create-title">{"\u2795 Nuova azione / Non Conformit\u00E0"}</h3>
        <p className="nc-modal-desc">
          Piano Azioni — ISO 9001:2015{" "}
          <span className="nc-cat-iso-ref">{categoryConfig.iso}</span>
        </p>

        <form className="nc-action-form" onSubmit={handleSubmit}>

          {/* ── 1. Categoria origine ─────────────────────────────── */}
          <div className="nc-form-row">
            <label htmlFor="nc-create-category">
              Categoria origine *
            </label>
            <select
              id="nc-create-category"
              required
              value={form.source_category}
              disabled={saving}
              onChange={e => handleCategoryChange(e.target.value)}
            >
              {NC_SOURCE_CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label} — {o.iso}
                </option>
              ))}
            </select>
          </div>

          {/* ── 2a. Audit picker (solo se categoria richiede audit) ─ */}
          {isAuditCat && (
            <div className="nc-form-row">
              <label htmlFor="nc-create-audit">Audit di riferimento *</label>
              <select
                id="nc-create-audit"
                required
                value={form.audit_id}
                disabled={loadingAudits || saving}
                onChange={e => setField("audit_id", e.target.value)}
              >
                <option value="">
                  {loadingAudits ? "Caricamento audit..." : "Seleziona audit"}
                </option>
                {audits.map(a => (
                  <option key={a.audit_id} value={a.audit_id}>
                    {a.audit_number} - {a.client_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── 2b. Testo origine libero (categorie non-audit) ────── */}
          {!isAuditCat && (
            <div className="nc-form-row">
              <label htmlFor="nc-create-origin">
                Riferimento / origine (opzionale)
              </label>
              <input
                id="nc-create-origin"
                type="text"
                placeholder={`es. ${
                  form.source_category === "management_review" ? "Riesame del 15/06/2026" :
                  form.source_category === "risk_action" ? "Rischio R-07: fornitura critica" :
                  form.source_category === "improvement" ? "OFI-2026-03" :
                  "Riferimento documento / evento"
                }`}
                value={form.source_origin_text}
                disabled={saving}
                onChange={e => setField("source_origin_text", e.target.value)}
              />
            </div>
          )}

          {/* ── 2b-bis. Ambito azienda (opzionale, solo categorie non legate ad audit) ── */}
          {!isAuditCat && companies.length > 0 && (
            <div className="nc-form-row">
              <label htmlFor="nc-create-company">Azienda / ambito (opzionale)</label>
              <select
                id="nc-create-company"
                value={form.company_id}
                disabled={saving}
                onChange={e => setField("company_id", e.target.value)}
              >
                <option value="">{"\u2014"} Nessuna azienda specifica (organizzazione) {"\u2014"}</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <small className="form-hint">Se questa azione riguarda un cliente specifico, selezionalo per ritrovarla nei filtri per azienda.</small>
            </div>
          )}

          {/* ── 2c. Picker reclamo (solo se source_category = 'complaint') ── */}
          {form.source_category === "complaint" && (
            <div className="nc-form-row">
              <label htmlFor="nc-create-complaint">Reclamo collegato</label>
              <select
                id="nc-create-complaint"
                value={form.source_complaint_id || ""}
                disabled={saving}
                onChange={e => setField("source_complaint_id", e.target.value || null)}
              >
                <option value="">{"\u2014"} Seleziona reclamo (opzionale) {"\u2014"}</option>
                {complaints.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.complaint_number} {c.description ? `\u2014 ${c.description.substring(0, 60)}` : ""}
                  </option>
                ))}
              </select>
              <small className="form-hint">Collega questa azione al reclamo di origine.</small>
            </div>
          )}

          {/* ── 3. Sezione ISO + Severità ────────────────────────── */}
          <div className="nc-form-row nc-form-row-2col">
            <div>
              <label htmlFor="nc-create-section">Sezione ISO *</label>
              <select
                id="nc-create-section"
                required
                value={form.section_code}
                disabled={saving || loadingSections || (isAuditCat && !form.audit_id)}
                onChange={e => setField("section_code", e.target.value)}
              >
                {isAuditCat && !form.audit_id && (
                  <option value="">Seleziona prima un audit</option>
                )}
                {isAuditCat && form.audit_id && loadingSections && (
                  <option value="">Caricamento sezioni...</option>
                )}
                {sectionOptions.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nc-create-severity">Severit{"\u00E0"} *</label>
              <select
                id="nc-create-severity"
                required
                value={form.severity}
                disabled={saving}
                onChange={e => setField("severity", e.target.value)}
              >
                {SEVERITY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── 4. Descrizione ───────────────────────────────────── */}
          <div className="nc-form-row">
            <label htmlFor="nc-create-desc">Descrizione *</label>
            <RichTextField
              id="nc-create-desc"
              rows={3}
              value={form.description}
              disabled={saving}
              onChange={e => setField("description", e.target.value)}
              draftScopeId={CREATE_SCOPE}
              draftFieldId="description"
              persistLocalDraft
              organizationId={organizationId}
            />
          </div>

          {/* ── 5. Responsabile + Scadenza ───────────────────────── */}
          <div className="nc-form-row nc-form-row-2col">
            <NcResponsibleSelect
              contacts={contacts}
              roleFilter={["attuazione", "generico"]}
              contactId={form.responsible_contact_id}
              onContactIdChange={id => setField("responsible_contact_id", id)}
              onTextChange={v => setField("responsible_person", v)}
              label="Responsabile"
            />
            <div>
              <label htmlFor="nc-create-due">Scadenza</label>
              <input
                id="nc-create-due"
                type="date"
                value={form.due_date}
                disabled={saving}
                onChange={e => setField("due_date", e.target.value)}
              />
            </div>
          </div>

          {error && <p className="custom-checklist-form-error">{error}</p>}

          <div className="nc-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Annulla
            </button>
            <button type="submit" className="btn-primary" disabled={saving || loadingSections}>
              {saving ? "Salvataggio..." : "Crea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
