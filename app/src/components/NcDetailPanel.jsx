/**
 * NcDetailPanel ? pannello dettaglio NC editabile (NC Fase 1 ? Slice 5)
 *
 * Campi: description, root_cause, verification_notes, verification_responsible,
 *        severity, responsible_person, due_date, allegati evidenze
 * API: PUT /non-conformities/:id via apiService.updateNcStatus
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import NcAttachmentsSection from "./NcAttachmentsSection";
import RichTextField, {
  resolveNcFieldInitial,
  clearNcFieldDraftsForScope,
} from "./RichTextField";
import { NC_SOURCE_TYPE_LABELS } from "../utils/ncCreateHelpers";
import "../components/ChecklistModule.css";

const SEVERITY_OPTIONS = [
  { value: "major", label: "Grave" },
  { value: "minor", label: "Lieve" },
  { value: "observation", label: "Osservazione" },
];

const NC_TEXT_FIELDS = [
  "description",
  "root_cause",
  "verification_notes",
  "verification_responsible",
];

function normalizeDate(val) {
  if (!val) return "";
  return String(val).substring(0, 10);
}

function ncDraftScope(ncId) {
  return ncId != null ? `nc:${ncId}` : null;
}

function initForm(nc, organizationId) {
  const scope = ncDraftScope(nc?.nc_id);
  return {
    description: resolveNcFieldInitial(nc?.description, organizationId, scope, "description"),
    root_cause: resolveNcFieldInitial(nc?.root_cause, organizationId, scope, "root_cause"),
    verification_notes: resolveNcFieldInitial(
      nc?.verification_notes,
      organizationId,
      scope,
      "verification_notes",
    ),
    verification_responsible: resolveNcFieldInitial(
      nc?.verification_responsible,
      organizationId,
      scope,
      "verification_responsible",
    ),
    severity: nc?.severity || "minor",
    responsible_person: nc?.responsible_person || "",
    due_date: normalizeDate(nc?.due_date),
  };
}

/**
 * @param {object} props
 * @param {object} props.nc ? riga NC da getAllNonConformities
 * @param {() => void} props.onSaved ? callback dopo salvataggio OK
 * @param {boolean} [props.readOnly] ? true se NC closed/verified
 */
export default function NcDetailPanel({ nc, onSaved, readOnly: readOnlyProp }) {
  const { user } = useAuth();
  const organizationId = user?.organization_id ?? null;
  const draftScope = useMemo(() => ncDraftScope(nc?.nc_id), [nc?.nc_id]);

  const isClosed = ["closed", "verified"].includes(nc?.status);
  const readOnly = readOnlyProp ?? isClosed;

  const [form, setForm] = useState(() => initForm(nc, organizationId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [descError, setDescError] = useState(null);

  useEffect(() => {
    setForm(initForm(nc, organizationId));
    setError(null);
    setDescError(null);
  }, [nc?.nc_id, organizationId]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateDescription() {
    if (!form.description.trim()) {
      setDescError("La descrizione \u00E8 obbligatoria.");
      return false;
    }
    setDescError(null);
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (readOnly) return;
    if (!validateDescription()) return;

    setSaving(true);
    setError(null);
    try {
      await apiService.updateNcStatus(nc.nc_id, {
        description: form.description.trim(),
        root_cause: form.root_cause.trim() || null,
        verification_notes: form.verification_notes.trim() || null,
        verification_responsible: form.verification_responsible.trim() || null,
        severity: form.severity,
        responsible_person: form.responsible_person.trim() || null,
        due_date: form.due_date || null,
      });
      if (organizationId && draftScope) {
        clearNcFieldDraftsForScope(organizationId, draftScope, NC_TEXT_FIELDS);
      }
      onSaved?.();
    } catch {
      setError("Errore durante il salvataggio. Riprovare pi\u00F9 tardi.");
    } finally {
      setSaving(false);
    }
  }

  if (!nc) return null;

  const sourceLabel = NC_SOURCE_TYPE_LABELS[nc.source_type] || nc.source_type;

  return (
    <form
      className="nc-detail-form nc-action-form"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="nc-detail-meta-badges">
        {nc.source_type && (
          <span className="nc-source-badge" title="Origine NC">
            {nc.source_type === "manual" ? "\u270D\uFE0F" : nc.source_type?.startsWith("audit") ? "\uD83D\uDCE4" : "\uD83D\uDEA8"}{" "}
            {sourceLabel}
          </span>
        )}
        {nc.source_complaint_id && (
          <Link
            to={`/reclami?complaint=${nc.source_complaint_id}`}
            className="nc-complaint-link"
            title="Apri reclamo origine"
          >
            {"\uD83D\uDCE9"} Reclamo {nc.source_complaint_number || `#${nc.source_complaint_id}`}
          </Link>
        )}
        {nc.audit_number && (
          <Link
            to="/audit"
            className="nc-audit-link"
            title={`Audit ${nc.audit_number} - ${nc.client_name || ""}`}
          >
            {"\uD83D\uDCCB"} {nc.audit_number}
            {nc.client_name ? ` - ${nc.client_name}` : ""}
          </Link>
        )}
      </div>
      <div className="nc-form-row">
        <label htmlFor={`nc-desc-${nc.nc_id}`}>Descrizione *</label>
        <RichTextField
          id={`nc-desc-${nc.nc_id}`}
          rows={3}
          value={form.description}
          readOnly={readOnly}
          onChange={(e) => setField("description", e.target.value)}
          onBlur={() => { if (!readOnly) validateDescription(); }}
          placeholder="Descrivi la non conformit\u00E0 riscontrata..."
          draftScopeId={draftScope}
          draftFieldId="description"
          persistLocalDraft
          organizationId={organizationId}
        />
        {descError && <p className="nc-error">{descError}</p>}
      </div>

      <div className="nc-form-row">
        <label htmlFor={`nc-root-${nc.nc_id}`}>
          Analisi causa radice <small>(ISO {"\u00A7"}10.2.1b)</small>
        </label>
        <RichTextField
          id={`nc-root-${nc.nc_id}`}
          rows={3}
          value={form.root_cause}
          readOnly={readOnly}
          onChange={(e) => setField("root_cause", e.target.value)}
          placeholder="5W, Ishikawa, 8D... Qual \u00E8 la causa fondamentale del problema?"
          draftScopeId={draftScope}
          draftFieldId="root_cause"
          persistLocalDraft
          organizationId={organizationId}
        />
      </div>

      <div className="nc-form-row">
        <label htmlFor={`nc-verif-${nc.nc_id}`}>Note verifica efficacia</label>
        <RichTextField
          id={`nc-verif-${nc.nc_id}`}
          rows={3}
          value={form.verification_notes}
          readOnly={readOnly}
          onChange={(e) => setField("verification_notes", e.target.value)}
          placeholder="Esito della verifica dell'efficacia delle azioni correttive..."
          draftScopeId={draftScope}
          draftFieldId="verification_notes"
          persistLocalDraft
          organizationId={organizationId}
        />
      </div>

      <div className="nc-form-row">
        <label htmlFor={`nc-verif-resp-${nc.nc_id}`}>Responsabile verifica</label>
        <RichTextField
          id={`nc-verif-resp-${nc.nc_id}`}
          rows={1}
          value={form.verification_responsible}
          readOnly={readOnly}
          onChange={(e) => setField("verification_responsible", e.target.value)}
          placeholder="Chi verifica l'efficacia delle azioni"
          draftScopeId={draftScope}
          draftFieldId="verification_responsible"
          persistLocalDraft
          organizationId={organizationId}
        />
      </div>

      <div className="nc-form-row nc-form-row-2col">
        <div>
          <label htmlFor={`nc-sev-${nc.nc_id}`}>Severit{"\u00E0"}</label>
          <select
            id={`nc-sev-${nc.nc_id}`}
            value={form.severity}
            disabled={readOnly}
            onChange={(e) => setField("severity", e.target.value)}
          >
            {SEVERITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`nc-due-${nc.nc_id}`}>Scadenza NC</label>
          <input
            id={`nc-due-${nc.nc_id}`}
            type="date"
            value={form.due_date}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setField("due_date", e.target.value)}
          />
        </div>
      </div>

      <div className="nc-form-row">
        <label htmlFor={`nc-resp-${nc.nc_id}`}>Responsabile NC</label>
        <input
          id={`nc-resp-${nc.nc_id}`}
          type="text"
          value={form.responsible_person}
          readOnly={readOnly}
          onChange={(e) => setField("responsible_person", e.target.value)}
          placeholder="Referente generale della NC"
        />
      </div>

      <NcAttachmentsSection ncId={nc.nc_id} readOnly={readOnly} />

      {nc.corrective_action && (
        <div className="nc-form-row nc-corrective-legacy">
          <label>Nota azione (legacy)</label>
          <p className="nc-legacy-readonly">{nc.corrective_action}</p>
        </div>
      )}

      {error && <p className="nc-error custom-checklist-form-error">{error}</p>}

      {!readOnly && (
        <div className="nc-form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Salvataggio..." : "Salva modifiche"}
          </button>
        </div>
      )}
    </form>
  );
}
