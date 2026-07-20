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
import AskAiButton from "./AskAiButton";
import { useAiAssist } from "../hooks/useAiAssist";
import AiDisclaimer from "./AiDisclaimer";
import { hasLicensedModule } from "../utils/licenseUtils";
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
  "corrective_action_evaluation_notes",
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
    corrective_action_needed: nc?.corrective_action_needed || "",
    corrective_action_evaluation_notes: resolveNcFieldInitial(
      nc?.corrective_action_evaluation_notes,
      organizationId,
      scope,
      "corrective_action_evaluation_notes",
    ),
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

  const { suggest: suggestCause, suggestion: causeSuggestion, loading: causeLoading, error: causeError, clear: clearCause } = useAiAssist();
  const hasAiAssist = hasLicensedModule(user, "ai_assist");

  function handleSuggestCause() {
    clearCause();
    suggestCause("nc_cause", {
      description: form.description,
      severity: form.severity,
      auditNumber: nc.audit_number || null,
      clientName: nc.client_name || null,
    });
  }

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
        corrective_action_needed: form.corrective_action_needed || null,
        corrective_action_evaluation_notes: form.corrective_action_evaluation_notes.trim() || null,
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

      {/* 3. Cause e valutazione */}
      <section className="nc-drawer-section" aria-labelledby={`nc-sec-cause-${nc.nc_id}`}>
        <div className="nc-drawer-section-heading">
          <h3 className="nc-drawer-section-title" id={`nc-sec-cause-${nc.nc_id}`}>
            {"3. Cause e valutazione"}
          </h3>
          <AskAiButton label="Chiedi all\u2019AI" />
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
        {/* AI — suggerisci causa radice */}
        {!readOnly && hasAiAssist && (
          <div className="nc-ai-cause">
            <button
              type="button"
              className="nc-ai-cause__btn"
              onClick={handleSuggestCause}
              disabled={causeLoading || !form.description.trim()}
              title={!form.description.trim() ? "Inserisci prima la descrizione NC" : ""}
            >
              {causeLoading
                ? "Analisi in corso\u2026"
                : "\uD83E\uDD16 Suggerisci causa (AI)"}
            </button>
            {causeError && <p className="nc-ai-cause__error">{causeError}</p>}
            {causeSuggestion && !causeLoading && (
              <div className="nc-ai-cause__result">
                <p className="nc-ai-cause__text">
                  {causeSuggestion.suggestion || causeSuggestion.raw || "Nessuna proposta generata."}
                </p>
                {causeSuggestion.methodology && (
                  <p className="nc-ai-cause__meta">Metodologia: {causeSuggestion.methodology}</p>
                )}
                <div className="nc-ai-cause__actions">
                  <button
                    type="button"
                    className="nc-ai-cause__accept"
                    onClick={() => { setForm((f) => ({ ...f, root_cause: causeSuggestion.suggestion || "" })); clearCause(); }}
                  >
                    Accetta
                  </button>
                  <button type="button" className="nc-ai-cause__rephrase" onClick={handleSuggestCause} disabled={causeLoading}>
                    Riformula
                  </button>
                  <button type="button" className="nc-ai-cause__discard" onClick={clearCause}>
                    Scarta
                  </button>
                </div>
                <AiDisclaimer style={{ marginTop: "0.5rem" }} />
              </div>
            )}
          </div>
        )}

        <div className="nc-form-row">
          <label htmlFor={`nc-ca-needed-${nc.nc_id}`}>
            {"\u00C8"} necessaria un{"'"}azione correttiva? <small>(ISO {"\u00A7"}10.2.1b)</small>
          </label>
          <select
            id={`nc-ca-needed-${nc.nc_id}`}
            value={form.corrective_action_needed}
            disabled={readOnly}
            onChange={(e) => setField("corrective_action_needed", e.target.value)}
          >
            <option value="">-- Non valutato --</option>
            <option value="yes">S{"\u00EC"}, necessaria</option>
            <option value="no">No, non necessaria</option>
          </select>
        </div>
        {form.corrective_action_needed && (
          <div className="nc-form-row">
            <label htmlFor={`nc-ca-eval-${nc.nc_id}`}>
              Motivazione valutazione
            </label>
            <RichTextField
              id={`nc-ca-eval-${nc.nc_id}`}
              rows={2}
              value={form.corrective_action_evaluation_notes}
              readOnly={readOnly}
              onChange={(e) => setField("corrective_action_evaluation_notes", e.target.value)}
              placeholder={form.corrective_action_needed === "no"
                ? "Motivare perch\u00E9 non \u00E8 necessaria un'azione correttiva..."
                : "Descrivere brevemente la valutazione effettuata..."}
              draftScopeId={draftScope}
              draftFieldId="corrective_action_evaluation_notes"
              persistLocalDraft
              organizationId={organizationId}
            />
          </div>
        )}
      </section>

      {/* 4. Correzione e azioni */}
      <section className="nc-drawer-section" aria-labelledby={`nc-sec-azioni-${nc.nc_id}`}>
        <h3 className="nc-drawer-section-title" id={`nc-sec-azioni-${nc.nc_id}`}>
          {"4. Correzione e azioni"}
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
