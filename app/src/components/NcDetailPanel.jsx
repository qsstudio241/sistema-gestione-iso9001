/**
 * NcDetailPanel - drawer dettaglio NC (flusso semplificato Aperta / Chiusa)
 *
 * Biforcazione ISO 10.2.1 b):
 * - Azione correttiva NON necessaria: Scheda → Difetto → Valutazione → Trattamento → Verifica → Chiudi
 * - Azione correttiva necessaria: + Cause + Azioni correttive
 * Chiudi visibile solo se gate soddisfatti (responsabile verifica selezionato dal menu).
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import NcAttachmentsSection from "./NcAttachmentsSection";
import NcActionsList from "./NcActionsList";
import NcCorrectionSection from "./NcCorrectionSection";
import { useNcActions } from "../hooks/useNcActions";
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
  getNcClosureButton,
  getNcReopenButton,
  getNcWorkflowProfile,
  canCloseNc,
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

/**
 * @param {object} props
 * @param {object} props.nc
 * @param {() => void} props.onSaved
 * @param {boolean} [props.readOnly]
 * @param {(newStatus: string) => void} [props.onStatusChange]
 * @param {boolean} [props.isRq] - admin/superadmin (riapertura)
 */
export default function NcDetailPanel({
  nc,
  onSaved,
  readOnly: readOnlyProp,
  onStatusChange,
  isRq = false,
}) {
  const { user } = useAuth();
  const organizationId = user?.organization_id ?? null;
  const draftScope = useMemo(() => ncDraftScope(nc?.nc_id), [nc?.nc_id]);

  const isClosed = nc?.status === "closed";
  const readOnly = readOnlyProp ?? isClosed;
  const profile = getNcWorkflowProfile(nc);
  const needsCorrective = profile === "full";
  const simplePath = profile === "simple";

  const [form, setForm] = useState(() => initForm(nc, organizationId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [descError, setDescError] = useState(null);
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
  }, [nc?.nc_id, nc?.status, nc?.corrective_action_needed, nc?.verification_contact_id, organizationId]);

  const ncActions = useNcActions({
    ncId: nc?.nc_id,
    ncStatus: nc?.status,
    companyId: nc?.company_id ?? null,
    organizationId,
  });

  const closeGate = useMemo(() => canCloseNc(nc), [nc]);
  const closureButton = useMemo(() => getNcClosureButton(nc), [nc]);
  const reopenButton = useMemo(() => getNcReopenButton(nc, user), [nc?.status, user?.role]);
  const showClosureSection = !!closureButton || !!reopenButton || (!isClosed && !closeGate.ok);

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
  const verifLabel = needsCorrective
    ? "Note verifica efficacia"
    : "Note verifica trattamento";
  const verifPlaceholder = needsCorrective
    ? "Esito della verifica dell'efficacia delle azioni correttive..."
    : "Esito della verifica: la correzione/trattamento ha risolto il problema?";

  return (
    <div className="nc-detail-form nc-action-form">
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
        <div className="nc-form-row nc-form-row-2col nc-form-row-2col--date">
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

      {/* 2. Difetto/Problema */}
      <section className="nc-drawer-section" aria-labelledby={`nc-sec-difetto-${nc.nc_id}`}>
        <h3 className="nc-drawer-section-title" id={`nc-sec-difetto-${nc.nc_id}`}>
          {"2. Difetto/Problema"}
        </h3>
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
      </section>

      {/* 3. Valutazione azione correttiva (biforcazione) */}
      <section className="nc-drawer-section" aria-labelledby={`nc-sec-valutazione-${nc.nc_id}`}>
        <h3 className="nc-drawer-section-title" id={`nc-sec-valutazione-${nc.nc_id}`}>
          {"3. Valutazione azione correttiva"}
        </h3>
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
              Motivazione valutazione{form.corrective_action_needed === "no" ? " *" : ""}
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
        {profile === "unset" && !readOnly && (
          <p className="nc-drawer-section-hint">
            Scegliere S{"\u00EC"} o No e salvare: il percorso di chiusura si adatta alla scelta.
          </p>
        )}
      </section>

      {/* 4. Trattamento (Correzione immediata, ISO 10.2.1a) */}
      <section className="nc-drawer-section" aria-labelledby={`nc-sec-trattamento-${nc.nc_id}`}>
        <h3 className="nc-drawer-section-title" id={`nc-sec-trattamento-${nc.nc_id}`}>
          {"4. Trattamento"}
        </h3>
        <NcCorrectionSection ncId={nc.nc_id} ncActions={ncActions} organizationId={organizationId} />
      </section>

      {/* 5. Cause — solo se azione correttiva necessaria */}
      {needsCorrective && (
        <section className="nc-drawer-section" aria-labelledby={`nc-sec-cause-${nc.nc_id}`}>
          <div className="nc-drawer-section-heading">
            <h3 className="nc-drawer-section-title" id={`nc-sec-cause-${nc.nc_id}`}>
              {"5. Cause"}
            </h3>
            <AskAiButton label={"Chiedi all\u2019AI"} />
          </div>
          <div className="nc-form-row">
            <label htmlFor={`nc-root-${nc.nc_id}`}>
              Analisi causa radice * <small>(ISO {"\u00A7"}10.2.1b)</small>
            </label>
            <RichTextField
              id={`nc-root-${nc.nc_id}`}
              rows={3}
              value={form.root_cause}
              readOnly={readOnly}
              onChange={(e) => setField("root_cause", e.target.value)}
              placeholder={"5W, Ishikawa, 8D... Qual \u00E8 la causa fondamentale del problema?"}
              draftScopeId={draftScope}
              draftFieldId="root_cause"
              persistLocalDraft
              organizationId={organizationId}
            />
          </div>
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
        </section>
      )}

      {/* 6. Azioni correttive — solo se necessarie */}
      {needsCorrective && (
        <section className="nc-drawer-section" aria-labelledby={`nc-sec-azioni-${nc.nc_id}`}>
          <h3 className="nc-drawer-section-title" id={`nc-sec-azioni-${nc.nc_id}`}>
            {"6. Azioni correttive / preventive"}
          </h3>
          <NcActionsList ncId={nc.nc_id} ncActions={ncActions} organizationId={organizationId} />
        </section>
      )}

      {/* Evidenze */}
      <section className="nc-drawer-section" aria-labelledby={`nc-sec-evidenze-${nc.nc_id}`}>
        <h3 className="nc-drawer-section-title" id={`nc-sec-evidenze-${nc.nc_id}`}>
          {needsCorrective ? "7. Evidenze" : "5. Evidenze"}
        </h3>
        <NcAttachmentsSection ncId={nc.nc_id} readOnly={readOnly} />
      </section>

      {/* Verifica */}
      <section
        className="nc-drawer-section nc-drawer-section--highlight"
        aria-labelledby={`nc-sec-verifica-${nc.nc_id}`}
      >
        <h3 className="nc-drawer-section-title" id={`nc-sec-verifica-${nc.nc_id}`}>
          {needsCorrective ? "8. Verifica efficacia" : "6. Verifica trattamento"}
        </h3>
        <p className="nc-drawer-section-hint">
          {"Il responsabile verifica (menu) \u00E8 chi attesta formalmente la risoluzione. Nessuna selezione automatica."}
        </p>
        <div className="nc-drawer-section-body">
          <div className="nc-form-row">
            <label htmlFor={`nc-verif-${nc.nc_id}`}>{verifLabel} *</label>
            <RichTextField
              id={`nc-verif-${nc.nc_id}`}
              rows={3}
              value={form.verification_notes}
              readOnly={readOnly}
              onChange={(e) => setField("verification_notes", e.target.value)}
              placeholder={verifPlaceholder}
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
            legacyText={
              !form.verification_contact_id && form.verification_responsible
                ? form.verification_responsible
                : null
            }
            useExternal={false}
            allowExternal={false}
            readOnly={readOnly}
            fieldId={`nc-verif-resp-${nc.nc_id}`}
            onContactIdChange={(id) => {
              setField("verification_contact_id", id);
              setField("useExternalVerification", false);
            }}
            onTextChange={(v) => setField("verification_responsible", v)}
            label="Responsabile verifica *"
            placeholder="Selezionare dal menu"
          />
        </div>
      </section>

      {/* Chiusura */}
      {showClosureSection && (
        <section className="nc-drawer-section" aria-labelledby={`nc-sec-chiusura-${nc.nc_id}`}>
          <h3 className="nc-drawer-section-title" id={`nc-sec-chiusura-${nc.nc_id}`}>
            {needsCorrective ? "9. Chiusura" : "7. Chiusura"}
          </h3>
          {!isClosed && !closeGate.ok && (
            <p className="nc-drawer-section-hint" role="status">
              {closeGate.message}
              {" "}Salvare le modifiche dopo ogni compilazione per aggiornare il pulsante Chiudi.
            </p>
          )}
          <div className="nc-workflow-btns">
            {closureButton && (
              <button
                type="button"
                className="status-btn not-applicable"
                onClick={() => onStatusChange?.(closureButton)}
              >
                Chiudi NC
              </button>
            )}
            {reopenButton && isRq && (
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
