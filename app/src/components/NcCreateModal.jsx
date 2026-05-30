/**
 * NcCreateModal - creazione NC manuale (POST source_type manual)
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import RichTextField, {
  resolveNcFieldInitial,
  clearNcFieldDraftsForScope,
} from "./RichTextField";
import {
  NC_MANUAL_SECTIONS,
  buildManualNcPayload,
  mapApiSectionsToOptions,
} from "../utils/ncCreateHelpers";
import "../components/ChecklistModule.css";

const CREATE_SCOPE = "nc-create";

const SEVERITY_OPTIONS = [
  { value: "major", label: "Grave" },
  { value: "minor", label: "Lieve" },
  { value: "observation", label: "Osservazione" },
];

const EMPTY_FORM = {
  audit_id: "",
  section_code: "",
  description: "",
  severity: "minor",
  responsible_person: "",
  due_date: "",
};

export default function NcCreateModal({ open, onClose, onCreated }) {
  const { user } = useAuth();
  const organizationId = user?.organization_id ?? null;
  const [audits, setAudits] = useState([]);
  const [sectionOptions, setSectionOptions] = useState(NC_MANUAL_SECTIONS);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...EMPTY_FORM,
      description: resolveNcFieldInitial("", organizationId, CREATE_SCOPE, "description"),
    });
    setSectionOptions(NC_MANUAL_SECTIONS);
    setError(null);
    setLoadingAudits(true);
    apiService.getAudits({ limit: 100 })
      .then(res => {
        const rows = res?.data || [];
        const openish = rows.filter(a => a.status !== 'completed' && a.status !== 'approved');
        setAudits(openish.length ? openish : rows);
      })
      .catch(() => setAudits([]))
      .finally(() => setLoadingAudits(false));
  }, [open, organizationId]);

  useEffect(() => {
    if (!open || !form.audit_id) {
      setSectionOptions(NC_MANUAL_SECTIONS);
      return;
    }
    let cancelled = false;
    setLoadingSections(true);
    apiService.getAudit(form.audit_id)
      .then(res => {
        const audit = res?.data || res;
        const standardId = audit?.standards?.[0]?.standard_id;
        if (!standardId) {
          if (!cancelled) {
            setSectionOptions(NC_MANUAL_SECTIONS);
            setForm(f => ({ ...f, section_code: NC_MANUAL_SECTIONS[6]?.value || 'clause10' }));
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
      .catch(() => {
        if (!cancelled) setSectionOptions(NC_MANUAL_SECTIONS);
      })
      .finally(() => {
        if (!cancelled) setLoadingSections(false);
      });
    return () => { cancelled = true; };
  }, [open, form.audit_id]);

  if (!open) return null;

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  const selectedAudit = audits.find(
    a => String(a.audit_id) === String(form.audit_id)
  );

  async function handleSubmit(e) {
    e.preventDefault();
    const built = buildManualNcPayload(form, selectedAudit?.audit_number);
    if (!built.ok) {
      setError(built.message);
      return;
    }
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
      const code = err?.response?.data?.code;
      const msg = err?.response?.data?.error
        || (code === 'INVALID_SECTION_FOR_STANDARD'
          ? 'Sezione non valida per lo standard dell\'audit selezionato.'
          : 'Errore durante la creazione della NC.');
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nc-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="nc-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="nc-create-title"
      >
        <h3 id="nc-create-title">{"\u2795 Nuova NC manuale"}</h3>
        <p className="nc-modal-desc">
          Crea una non conformit{"\u00E0"} collegata a un audit (origine manuale, ISO {"\u00A7"}10.2).
        </p>
        <form className="nc-action-form" onSubmit={handleSubmit}>
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
          <div className="nc-form-row nc-form-row-2col">
            <div>
              <label htmlFor="nc-create-section">Sezione ISO *</label>
              <select
                id="nc-create-section"
                required
                value={form.section_code}
                disabled={saving || loadingSections || !form.audit_id}
                onChange={e => setField("section_code", e.target.value)}
              >
                {!form.audit_id && (
                  <option value="">Seleziona prima un audit</option>
                )}
                {form.audit_id && loadingSections && (
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
          <div className="nc-form-row">
            <label htmlFor="nc-create-desc">Descrizione *</label>
            <RichTextField
              id="nc-create-desc"
              rows={3}
              value={form.description}
              disabled={saving}
              onChange={(e) => setField("description", e.target.value)}
              draftScopeId={CREATE_SCOPE}
              draftFieldId="description"
              persistLocalDraft
              organizationId={organizationId}
            />
          </div>
          <div className="nc-form-row nc-form-row-2col">
            <div>
              <label htmlFor="nc-create-resp">Responsabile</label>
              <input
                id="nc-create-resp"
                type="text"
                value={form.responsible_person}
                disabled={saving}
                onChange={e => setField("responsible_person", e.target.value)}
              />
            </div>
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
              {saving ? "Salvataggio..." : "Crea NC"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
