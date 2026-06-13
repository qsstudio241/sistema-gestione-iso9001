/**
 * NcDetailPanel - drawer dettaglio NC guidato per flusso operativo ISO 10.2
 *
 * Ordine sezioni: Scheda / Stato workflow / Cause / Azioni / Evidenze / Verifica / Chiusura
 * API: PUT /non-conformities/:id via apiService.updateNcStatus
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import NcAttachmentsSection from "./NcAttachmentsSection";
import NcActionsList from "./NcActionsList";
import NcResponsibleSelect from "./NcResponsibleSelect";
import RichTextField, {
  resolveNcFieldInitial,
  clearNcFieldDraftsForScope,
} from "./RichTextField";
import { NC_SOURCE_TYPE_LABELS } from "../utils/ncCreateHelpers";
import {
  getNcWorkflowTransitionButtons,
  getNcClosureButton,
  getNcReopenButton,
} from "../utils/ncWorkflow";
import {
  loadNcResponsibleContacts,
  NC_SCOPE_ATTUAZIONE,
  NC_SCOPE_VERIFICA,
} from "../utils/ncResponsibleContacts";
import "../components/ChecklistModule.css";

const SEVERITY_OPTIONS = [
  { value: "major", label: "Grave" },
  { value: "minor", label: "Lieve" },
  { value: "observation", label: "Osservazione" },
];

const NC_WORKFLOW_CFG = {
  in_progress: { label: "Avvia lavorazione", statusBtn: "partial" },
  resolved:    { label: "Segna come risolta", statusBtn: "compliant" },
  verified:    { label: "Verifica", statusBtn: "compliant" },
  closed:      { label: "Chiudi NC", statusBtn: "not-applicable" },
};

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
    responsible_contact_id: nc?.responsible_contact_id ?? null,
    verification_contact_id: nc?.verification_contact_id ?? null,
    useExternalVerification: !nc?.verification_contact_id,
    due_date: normalizeDate(nc?.due_date),
  };
}

function isEarlyPhaseStatus(status) {
  return status === "open" || status === "in_progress";
}

/**
 * @param {object} props
 * @param {object} props.nc - riga NC da getAllNonConformities
 * @param {() => void} props.onSaved - callback dopo salvataggio OK
 * @param {boolean} [props.readOnly] - true se NC closed/verified
 * @param {(newStatus: string) => void} [props.onStatusChange]
 * @param {() => void} [props.onApproveClosure]
 * @param {boolean} [props.isRq]
 * @param {boolean} [props.approveLoading]
 */
export default function NcDetailPanel({
  nc,
  onSaved,
  readOnly: readOnlyProp,
  onStatusChange,
  onApproveClosure,
  isRq = false,
  approveLoading = false,
}) {
  const { user } = useAuth();
  const organizationId = user?.organization_id ?? null;
  const draftScope = useMemo(() => ncDraftScope(nc?.nc_id), [nc?.nc_id]);

  const isClosed = ["closed", "verified"].includes(nc?.status);
  const readOnly = readOnlyProp ?? isClosed;
  const earlyPhase = isEarlyPhaseStatus(nc?.status);
  const showVerifHighlight = !earlyPhase;

  const [form, setForm] = useState(() => initForm(nc, organizationId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [descError, setDescError] = useState(null);
  const [verifExpanded, setVerifExpanded] = useState(!earlyPhase);
  const [contactsAttuazione, setContactsAttuazione] = useState([]);
  const [contactsVerifica, setContactsVerifica] = useState([]);

  useEffect(() => {
    const companyId = nc?.company_id ?? null;
    let cancelled = false;

    Promise.all([
      loadNcResponsibleContacts(apiService, { companyId, scope: NC_SCOPE_ATTUAZIONE }),
      loadNcResponsibleContacts(apiService, { companyId, scope: NC_SCOPE_VERIFICA }),
    ])
      .then(([attuazione, verifica]) => {
        if (cancelled) return;
        setContactsAttuazione(attuazione);
        setContactsVerifica(verifica);
      })
      .catch(() => {
        if (!cancelled) {
          setContactsAttuazione([]);
          setContactsVerifica([]);
        }
      });

    return () => { cancelled = true; };
  }, [nc?.company_id, organizationId]);

  useEffect(() => {
    setForm(initForm(nc, organizationId));
    setError(null);
    setDescError(null);
    setVerifExpanded(!isEarlyPhaseStatus(nc?.status));
  }, [nc?.nc_id, nc?.status, organizationId]);

  const workflowTransitions = useMemo(
    () => getNcWorkflowTransitionButtons(nc),
    [nc?.status],
  );
  const closureButton = useMemo(() => getNcClosureButton(nc), [nc?.status, nc?.approved_at]);
  const reopenButton = useMemo(() => getNcReopenButton(nc, user), [nc?.status, user?.role]);
  const showApproveClosure = nc?.status === "verified" && !nc?.approved_at && isRq;
  const showClosureSection = showApproveClosure || !!closureButton || !!reopenButton;

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
        verification_responsible: form.useExternalVerification
          ? form.verification_responsible.trim() || null
          : form.verification_responsible.trim() || null,
        verification_contact_id: form.useExternalVerification ? null : form.verification_contact_id,
        severity: form.severity,
        responsible_person: form.responsible_person.trim() || null,
        responsible_contact_id: form.responsible_contact_id,
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
    <div
      className="nc-detail-form nc-action-form"
    >
      {/* 1. Scheda NC */}
      <section className="nc-drawer-section" aria-labelledby={`nc-sec-scheda-${nc.nc_id}`}>
        <h3 className="nc-drawer-section-title" id={`nc-sec-scheda-${nc.nc_id}`}>
          {"1. Scheda NC"}
        </h3>
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
            placeholder="Descrivi la non conformità riscontrata..."
            draftScopeId={draftScope}
            draftFieldId="description"
            persistLocalDraft
            organizationId={organizationId}
          />
          {descError && <p className="nc-error">{descError}</p>}
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
        <NcResponsibleSelect
          contacts={contactsAttuazione}
          roleFilter={["attuazione", "generico"]}
          contactId={form.responsible_contact_id}
          legacyText={
            !form.responsible_contact_id && form.responsible_person
              ? form.responsible_person
              : null
          }
          readOnly={readOnly}
          fieldId={`nc-resp-${nc.nc_id}`}
          onContactIdChange={(id) => setField("responsible_contact_id", id)}
          onTextChange={(v) => setField("responsible_person", v)}
          label="Responsabile NC"
        />
      </section>

      {/* 2. Stato workflow */}
      {workflowTransitions.length > 0 && (
        <section
          className="nc-drawer-section nc-drawer-section--workflow nc-workflow-sticky"
          aria-labelledby={`nc-sec-stato-${nc.nc_id}`}
        >
          <h3 className="nc-drawer-section-title" id={`nc-sec-stato-${nc.nc_id}`}>
            {"2. Stato workflow"}
          </h3>
          <div className="nc-workflow-btns">
            {workflowTransitions.map((ns) => {
              const cfg = NC_WORKFLOW_CFG[ns] || { label: ns, statusBtn: "partial" };
              return (
                <button
                  key={ns}
                  type="button"
                  className={`status-btn ${cfg.statusBtn}`}
                  onClick={() => onStatusChange?.(ns)}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Cause */}
      <section className="nc-drawer-section" aria-labelledby={`nc-sec-cause-${nc.nc_id}`}>
        <h3 className="nc-drawer-section-title" id={`nc-sec-cause-${nc.nc_id}`}>
          {"3. Cause"}
        </h3>
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
            placeholder="5W, Ishikawa, 8D... Qual è la causa fondamentale del problema?"
            draftScopeId={draftScope}
            draftFieldId="root_cause"
            persistLocalDraft
            organizationId={organizationId}
          />
        </div>
      </section>

      {/* 4. Azioni correttive */}
      <section className="nc-drawer-section" aria-labelledby={`nc-sec-azioni-${nc.nc_id}`}>
        <h3 className="nc-drawer-section-title" id={`nc-sec-azioni-${nc.nc_id}`}>
          {"4. Azioni correttive"}
        </h3>
        <NcActionsList ncId={nc.nc_id} ncStatus={nc.status} companyId={nc.company_id} embedded />
      </section>

      {/* 5. Evidenze */}
      <section className="nc-drawer-section" aria-labelledby={`nc-sec-evidenze-${nc.nc_id}`}>
        <h3 className="nc-drawer-section-title" id={`nc-sec-evidenze-${nc.nc_id}`}>
          {"5. Evidenze"}
        </h3>
        <NcAttachmentsSection ncId={nc.nc_id} readOnly={readOnly} />
      </section>

      {/* 6. Verifica efficacia */}
      <section
        className={`nc-drawer-section${showVerifHighlight ? " nc-drawer-section--highlight" : ""}${!verifExpanded ? " nc-drawer-section--collapsed" : ""}`}
        aria-labelledby={`nc-sec-verifica-${nc.nc_id}`}
      >
        <div className="nc-drawer-section-heading">
          <h3 className="nc-drawer-section-title" id={`nc-sec-verifica-${nc.nc_id}`}>
            {"6. Verifica efficacia"}
          </h3>
          {earlyPhase && (
            <button
              type="button"
              className="nc-drawer-section-toggle btn-secondary"
              onClick={() => setVerifExpanded((v) => !v)}
              aria-expanded={verifExpanded}
            >
              {verifExpanded ? "Nascondi" : "Mostra"}
            </button>
          )}
        </div>
        {earlyPhase && !verifExpanded && (
          <p className="nc-drawer-section-hint">
            Compilare a fine lavori, prima di segnare la NC come risolta o verificata.
          </p>
        )}
        <div className="nc-drawer-section-body">
          {earlyPhase && verifExpanded && (
            <p className="nc-drawer-section-hint">
              Compilare a fine lavori, prima di segnare la NC come risolta o verificata.
            </p>
          )}
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
          <NcResponsibleSelect
            contacts={contactsVerifica}
            roleFilter={["verifica", "generico"]}
            contactId={form.verification_contact_id}
            textValue={form.verification_responsible}
            useExternal={form.useExternalVerification}
            allowExternal
            readOnly={readOnly}
            fieldId={`nc-verif-resp-${nc.nc_id}`}
            onContactIdChange={(id) => setField("verification_contact_id", id)}
            onTextChange={(v) => setField("verification_responsible", v)}
            onUseExternalChange={(v) => {
              setField("useExternalVerification", v);
              if (v) setField("verification_contact_id", null);
            }}
            label="Responsabile verifica"
            placeholder="Chi verifica l'efficacia delle azioni"
          />
        </div>
      </section>

      {/* 7. Chiusura */}
      {showClosureSection && (
        <section className="nc-drawer-section" aria-labelledby={`nc-sec-chiusura-${nc.nc_id}`}>
          <h3 className="nc-drawer-section-title" id={`nc-sec-chiusura-${nc.nc_id}`}>
            {"7. Chiusura"}
          </h3>
          <div className="nc-workflow-btns">
            {showApproveClosure && (
              <button
                type="button"
                className="status-btn compliant"
                disabled={approveLoading}
                onClick={() => onApproveClosure?.()}
              >
                {approveLoading ? "Approvazione..." : "Approva chiusura (RQ)"}
              </button>
            )}
            {closureButton && (
              <button
                type="button"
                className={`status-btn ${NC_WORKFLOW_CFG.closed.statusBtn}`}
                onClick={() => onStatusChange?.(closureButton)}
              >
                {NC_WORKFLOW_CFG.closed.label}
              </button>
            )}
            {reopenButton && (
              <button
                type="button"
                className="status-btn partial"
                onClick={() => onStatusChange?.(reopenButton)}
              >
                Riapri NC
              </button>
            )}
          </div>
        </section>
      )}

      {nc.corrective_action && (
        <div className="nc-form-row nc-corrective-legacy">
          <label>Nota azione (legacy)</label>
          <p className="nc-legacy-readonly">{nc.corrective_action}</p>
        </div>
      )}

      {error && <p className="nc-error custom-checklist-form-error">{error}</p>}

      {!readOnly && (
        <div className="nc-form-actions nc-drawer-footer">
          <button type="button" className="btn-primary" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvataggio..." : "Salva modifiche"}
          </button>
        </div>
      )}
    </div>
  );
}
