/**
 * Audit Selector Component
 * Dropdown per selezione, creazione, eliminazione audit
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useStorage } from "../contexts/StorageContext";
import { useAuth } from "../contexts/AuthContext";
import { getNextAuditNumber, sortAuditsByNumber } from "../utils/auditUtils";
import apiService from "../services/apiService";
import "./AuditSelector.css";

/**
 * Lista degli standard disponibili per la selezione in fase di creazione audit.
 * Per aggiungere un nuovo standard: inserire una nuova riga qui.
 */
const AVAILABLE_STANDARDS = [
  { code: "ISO_9001",   label: "ISO 9001:2015 \u2014 Qualit\u00e0", standardId: 1 },
  { code: "ISO_14001",  label: "ISO 14001:2015 \u2014 Ambiente", standardId: 2 },
  { code: "ISO_45001",  label: "ISO 45001:2018 \u2014 Salute e Sicurezza", standardId: 3 },
  { code: "ISO_3834_2", label: "ISO 3834-2 \u2014 Audit Fornitori in Campo", standardId: 6 },
  { code: "RDP_MSN",    label: "RDP Mason \u2014 Audit di Sistema Saldatura (ISO 3834-2)", standardId: 7 },
];

function AuditSelector() {
  const {
    audits,
    currentAudit,
    currentAuditId,
    switchAudit,
    createAudit,
    deleteAudit,
    isSaving,
  } = useStorage();
  const { user } = useAuth();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isReauditMode, setIsReauditMode] = useState(false);

  // Ordina audit per numero (più recente prima) - filtro audit validi
  const validAudits = audits.filter((audit) => audit && audit.metadata);
  const sortedAudits = sortAuditsByNumber(validAudits, false);

  /** Impronta elenco audit: forza remount del <select> quando cambia lo scope (anche con stesso conteggio). */
  const auditsMenuKey = useMemo(() => {
    return audits
      .map((a) => String(a?.metadata?.id || a?.id || ""))
      .filter(Boolean)
      .sort()
      .join("|");
  }, [audits]);

  // === HANDLERS ===

  const handleAuditChange = (e) => {
    const auditId = e.target.value;
    if (auditId) {
      switchAudit(auditId);
    }
  };

  const handleCreateNewAudit = () => {
    setIsReauditMode(false);
    setShowCreateModal(true);
  };

  const handleCreateReAudit = () => {
    setIsReauditMode(true);
    setShowCreateModal(true);
  };

  const handleDeleteAudit = () => {
    if (!currentAudit) return;
    const num = currentAudit.metadata.auditNumber || "—";
    const client = currentAudit.metadata.clientName || "—";
    const first = window.confirm(
      `Eliminare definitivamente l'audit?\n\n${num} — ${client}\n\nQuesta operazione rimuove l'audit dal browser e dal server.\nNon può essere annullata.`
    );
    if (!first) return;
    const second = window.confirm(
      `⚠️ CONFERMA FINALE\n\nAudit "${num}" verrà eliminato in modo permanente.\nProcedere?`
    );
    if (!second) return;
    deleteAudit(currentAuditId);
  };



  // === RENDER ===

  if (audits.length === 0) {
    return (
      <>
        <div className="audit-selector empty">
          <p>Nessun audit disponibile</p>
          <button onClick={handleCreateNewAudit} className="btn btn-primary">
            ➕ Crea Primo Audit
          </button>
        </div>

        {/* Modal Creazione - NECESSARIO anche quando lista vuota */}
        {showCreateModal && (
          <CreateAuditModal
            audits={audits}
            currentAudit={null}
            isReaudit={false}
            onClose={() => setShowCreateModal(false)}
            onCreate={createAudit}
          />
        )}
      </>
    );
  }

  return (
    <div className="audit-selector">
      <div className="audit-selector-header">
        <div className="audit-selector-controls">
          <select
            id="audit-select"
            key={`audit-dd-${user?.user_id ?? "x"}-${user?.organization_id ?? "o"}-${user?.auditor_org_id ?? "ao"}-${auditsMenuKey}`}
            value={currentAuditId || ""}
            onChange={handleAuditChange}
            className="audit-dropdown"
          >
            {/* Opzione vuota quando nessun audit selezionato */}
            <option value="">-- Seleziona un audit --</option>

            {sortedAudits.map((audit) => {
              const auditId = audit.metadata?.id || audit.id;
              return (
                <option key={auditId} value={auditId}>
                  {audit.metadata.auditNumber} - {audit.metadata.clientName} (
                  {audit.metadata.status})
                </option>
              );
            })}
          </select>

          {/* Due pulsanti distinti: Nuovo Audit vs Re-Audit */}
          <button
            onClick={handleCreateNewAudit}
            className="btn btn-icon btn-success"
            title="Crea nuovo audit (nuova azienda)"
            disabled={currentAudit !== null}
          >
            ➕ Nuovo
          </button>
          
          <button
            onClick={handleCreateReAudit}
            className="btn btn-icon btn-primary"
            title="Re-audit azienda selezionata"
            disabled={currentAudit === null}
          >
            🔄 Re-Audit
          </button>

          <button
            onClick={handleDeleteAudit}
            className="btn btn-icon btn-danger"
            title="Elimina audit corrente"
            disabled={currentAudit === null}
          >
            🗑️ Elimina
          </button>
        </div>

        {isSaving && <span className="save-indicator">💾 Salvataggio...</span>}
      </div>



      {currentAudit && (
        <div className="audit-info-bar">
          <div className="audit-info-item standards-info">
            <strong>Norme:</strong>{" "}
            <div className="standards-badges">
              {(() => {
                // Usa selectedStandards; se vuoto, usa le chiavi della checklist come fallback
                const declared = currentAudit.metadata.selectedStandards || [];
                const ckKeys = Object.keys(currentAudit.checklist || {});
                const display = declared.length > 0 ? declared : ckKeys;
                const hasCustom = currentAudit.metadata?.customChecklistId ?? currentAudit.custom_checklist_id;
                return (
                  <>
                    {display.map((std) => {
                  const s = String(std);
                  const category = s.includes("9001")
                    ? "quality"
                    : s.includes("14001")
                    ? "environment"
                    : s.includes("45001")
                    ? "safety"
                    : "other";
                  const displayName = s.replace("ISO_", "ISO ").replace(/_(\d)/, ":$1");
                  return (
                    <span key={std} className={`standard-badge-small category-${category}`}>
                      {displayName}
                    </span>
                  );
                })}
                    {hasCustom && (
                      <span key="custom" className="standard-badge-small category-other">
                        Checklist personalizzata
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
          <div className="audit-info-item">
            <strong>Completamento:</strong>{" "}
            {currentAudit.metrics.completionPercentage}%
          </div>
        </div>
      )}

      {/* Modal Creazione Audit */}
      {showCreateModal && (
        <CreateAuditModal
          audits={audits}
          currentAudit={currentAudit}
          isReaudit={isReauditMode}
          onClose={() => setShowCreateModal(false)}
          onCreate={createAudit}
        />
      )}


    </div>
  );
}

// === MODAL CREAZIONE AUDIT ===

function CreateAuditModal({ audits, currentAudit, isReaudit, onClose, onCreate }) {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  // Standard visibili in base a user_standards: se allowed_standard_ids presente, solo quelli
  const standardsForUser = !user?.allowed_standard_ids
    ? AVAILABLE_STANDARDS
    : user.allowed_standard_ids.length === 0
      ? []
      : AVAILABLE_STANDARDS.filter((s) => user.allowed_standard_ids.includes(s.standardId));
  const nextNumber = getNextAuditNumber(audits, currentYear);

  // Pre-popola clientName, companyId, tipologia e fornitore se re-audit
  const initialClientName = isReaudit && currentAudit 
    ? currentAudit.metadata.clientName 
    : "";
  const initialCompanyId = isReaudit && currentAudit?.metadata?.companyId 
    ? currentAudit.metadata.companyId 
    : null;
  const initialPartyType = isReaudit && currentAudit?.metadata?.auditPartyType 
    ? currentAudit.metadata.auditPartyType 
    : "first_party";
  const initialFornitore = isReaudit && currentAudit?.metadata?.fornitoreName 
    ? currentAudit.metadata.fornitoreName 
    : "";

  const [formData, setFormData] = useState({
    auditNumber: nextNumber,
    clientName: initialClientName,
    companyId: initialCompanyId,
    auditPartyType: initialPartyType,
    fornitoreName: initialFornitore,
    auditDate: new Date().toISOString().split("T")[0],
    auditorName: "",
    norms: [],
    customChecklistId: null,
  });

  const [customChecklists, setCustomChecklists] = useState([]);
  useEffect(() => {
    apiService.getCustomChecklists().then((res) => {
      setCustomChecklists(res?.data ?? []);
    }).catch(() => setCustomChecklists([]));
  }, []);

  // Carica aziende dall'anagrafica (Fase 1)
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const effectiveOrgId = user?.auditor_org_id ?? null;

  const loadCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    try {
      const params = effectiveOrgId ? { auditor_org_id: effectiveOrgId } : {};
      const res = await apiService.getCompanies(params);
      setCompanies(res.data || []);
    } catch (err) {
      console.warn("Caricamento aziende:", err.message);
      setCompanies([]);
    } finally {
      setCompaniesLoading(false);
    }
  }, [effectiveOrgId]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const [errors, setErrors] = useState({});
  const [pendingInfo, setPendingInfo] = useState(null); // { count, lastAuditId, issues }

  /**
   * Verifica se il cliente ha rilievi pendenti (NC/OSS/NV) da audit precedenti.
   * @param {string} clientName  - nome cliente da cercare
   * @param {string|null} excludeUuid - UUID dell'audit corrente da escludere (re-audit)
   */
  const checkPendingIssues = async (clientName, excludeUuid = null) => {
    if (!clientName?.trim()) return;
    try {
      const result = await apiService.checkReaudit(clientName.trim(), excludeUuid);
      if (result.has_previous_audit && result.pending_count > 0) {
        let issues = [];
        try {
          const ncResult = await apiService.getNcResponses(result.last_audit_id);
          issues = ncResult.responses || [];
        } catch (err) {
          console.warn('[Re-Audit] getNcResponses fallito (non bloccante):', err.message);
        }
        setPendingInfo({
          count: result.pending_count,
          lastAuditId: result.last_audit_id,
          lastAuditDate: result.last_audit_date,
          lastAuditNumber: result.last_audit_number,
          issues
        });
      } else {
        setPendingInfo(null);
      }
    } catch (err) {
      console.warn('[Re-Audit] check-reaudit fallito:', err.message);
      setPendingInfo(null);
    }
  };

  // Re-audit: controlla pending all'apertura modal (cliente già noto dall'audit corrente)
  React.useEffect(() => {
    if (isReaudit && currentAudit) {
      const cn   = currentAudit.metadata?.clientName;
      const uuid = currentAudit.metadata?.id || null;
      checkPendingIssues(cn, uuid);
    }
  }, [isReaudit, currentAudit]);

  // Nuovo audit: controlla pending quando l'utente lascia il campo clientName (min 3 char)
  const handleClientNameBlur = () => {
    if (!isReaudit && formData.clientName.trim().length >= 3) {
      checkPendingIssues(formData.clientName.trim(), null);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const MANUAL_COMPANY_VALUE = "__manual__";

  // Menu a tendina Azienda committente: selezione da Anagrafica o inserimento manuale
  const handleCompanySelect = (e) => {
    const value = e.target.value;
    if (!value) {
      setFormData((prev) => ({ ...prev, companyId: null, clientName: "" }));
      return;
    }
    if (value === MANUAL_COMPANY_VALUE) {
      setFormData((prev) => ({ ...prev, companyId: null, clientName: prev.clientName || "" }));
      return;
    }
    const company = companies.find((c) => String(c.id) === value);
    if (company) {
      setFormData((prev) => ({
        ...prev,
        companyId: company.id,
        clientName: company.name || "",
      }));
    }
  };

  // Valore del dropdown: companyId, MANUAL_COMPANY_VALUE, o ""
  const companySelectValue = formData.companyId != null && formData.companyId !== ""
    ? String(formData.companyId)
    : (formData.clientName && !formData.companyId ? MANUAL_COMPANY_VALUE : "");

  const handleNormToggle = (norm) => {
    setFormData((prev) => ({
      ...prev,
      norms: prev.norms.includes(norm)
        ? prev.norms.filter((n) => n !== norm)
        : [...prev.norms, norm],
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.clientName.trim()) {
      newErrors.clientName = "Nome cliente obbligatorio";
    }

    if (!formData.auditorName.trim()) {
      newErrors.auditorName = "Nome auditor obbligatorio";
    }

    if (formData.norms.length === 0 && !formData.customChecklistId) {
      newErrors.norms = "Selezionare almeno una norma oppure una checklist personalizzata";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // Propaga rilievi pendenti dell'audit precedente nel nuovo audit (re-audit e nuovo con storico)
    const submitData = { ...formData };
    // Mappa norms → selectedStandards (atteso da createNewAudit in auditDataModel.js)
    submitData.selectedStandards = formData.norms;
    submitData.companyId = formData.companyId || null;
    submitData.customChecklistId = formData.customChecklistId || null;
    if (pendingInfo?.issues?.length > 0) {
      submitData.pendingIssues = pendingInfo.issues
        .filter((issue) => issue.conformity_status !== 'OM')
        .map((issue) => ({
          // Campi richiesti da buildPendingIssuesOoxml in wordExportHelpers.js
          clause:            issue.section_code || '',
          description:       issue.question_text || `Domanda ${issue.question_id}`,
          originAuditNumber: pendingInfo.lastAuditNumber || `#${pendingInfo.lastAuditId}`,
          status:            'open',
          resolutionNotes:   '',
          // Campi di tracciamento interno
          id:               `issue_${issue.response_id}`,
          originalStatus:   issue.conformity_status,
          fromAuditNumber:  pendingInfo.lastAuditNumber || `#${pendingInfo.lastAuditId}`,
          sourceResponseId: issue.response_id,
          questionId:       issue.question_id || null,
          createdDate:      new Date().toISOString(),
        }));
    }

    onCreate(submitData);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isReaudit ? "🔄 Re-Audit Azienda" : "➕ Crea Nuovo Audit"}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Sezione rilievi pendenti — re-audit o nuovo audit con storico cliente */}
        {pendingInfo && pendingInfo.count > 0 && (
          <div className="pending-issues-section">
            <div className="pending-issues-header">
              <span className="pending-issues-icon">⚠️</span>
              <strong>
                {pendingInfo.count} rilievi pendenti dall'ultimo audit
              </strong>
              {pendingInfo.lastAuditDate && (
                <span className="pending-issues-date">
                  ({new Date(pendingInfo.lastAuditDate).toLocaleDateString('it-IT')})
                </span>
              )}
            </div>

            {pendingInfo.issues && pendingInfo.issues.length > 0 ? (
              <ul className="pending-issues-list">
                {pendingInfo.issues.map((issue) => (
                  <li key={issue.response_id} className={`pending-issue-item status-${issue.conformity_status?.toLowerCase()}`}>
                    <span className={`pending-issue-badge badge-${issue.conformity_status?.toLowerCase()}`}>
                      {issue.conformity_status}
                    </span>
                    <span className="pending-issue-ref">
                      {issue.clause_number || issue.requirement_reference || `Q${issue.question_id}`}
                    </span>
                    <span className="pending-issue-text">
                      {issue.question_text || issue.notes || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pending-issues-loading">⏳ Caricamento dettagli...</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="auditNumber">Numero Audit</label>
            <input
              type="text"
              id="auditNumber"
              name="auditNumber"
              value={formData.auditNumber}
              onChange={handleChange}
              disabled
              className="form-control"
            />
            <small className="form-hint">Generato automaticamente</small>
          </div>

          <div className="form-group">
            <label htmlFor="companySelect">Azienda committente *</label>
            {isReaudit ? (
              <input
                type="text"
                id="clientName"
                readOnly
                value={formData.clientName || "—"}
                className="form-control readonly"
              />
            ) : companies.length > 0 ? (
              <>
                <select
                  key={`company-select-${effectiveOrgId ?? "none"}`}
                  id="companySelect"
                  value={companySelectValue}
                  onChange={handleCompanySelect}
                  className={`form-control ${errors.clientName ? "error" : ""}`}
                  disabled={companiesLoading}
                >
                  <option value="">— Seleziona azienda —</option>
                  <option value={MANUAL_COMPANY_VALUE}>— Nuova azienda / Inserimento manuale —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.vat_number ? ` (P.IVA ${c.vat_number})` : ""}
                    </option>
                  ))}
                </select>
                {companySelectValue === MANUAL_COMPANY_VALUE && (
                  <input
                    type="text"
                    id="clientName"
                    name="clientName"
                    value={formData.clientName}
                    onChange={handleChange}
                    onBlur={handleClientNameBlur}
                    className={`form-control ${errors.clientName ? "error" : ""}`}
                    placeholder="es. Acme Industries SpA"
                    style={{ marginTop: "0.5rem" }}
                  />
                )}
                <small className="form-hint">Scegli dall&apos;anagrafica aziende oppure inserimento manuale per una nuova.</small>
              </>
            ) : (
              <>
                <input
                  type="text"
                  id="clientName"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleChange}
                  onBlur={handleClientNameBlur}
                  className={`form-control ${errors.clientName ? "error" : ""}`}
                  placeholder="es. Acme Industries SpA"
                />
                <small className="form-hint">Anagrafica vuota: inserisci il nome azienda. Aggiungi aziende da 🏢 Anagrafica Aziende.</small>
              </>
            )}
            {errors.clientName && (
              <span className="error-message">{errors.clientName}</span>
            )}
          </div>

          <div className="form-group">
            <label>Tipologia audit</label>
            <div className="checkbox-group" role="group" aria-label="Tipologia audit">
              <label className="checkbox-label">
                <input
                  type="radio"
                  name="auditPartyType"
                  checked={formData.auditPartyType === "first_party"}
                  onChange={() => setFormData((p) => ({ ...p, auditPartyType: "first_party", fornitoreName: p.auditPartyType === "second_party" ? "" : p.fornitoreName }))}
                />
                <span>Prima parte (interno) — audit sul committente</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="radio"
                  name="auditPartyType"
                  checked={formData.auditPartyType === "second_party"}
                  onChange={() => setFormData((p) => ({ ...p, auditPartyType: "second_party" }))}
                />
                <span>Seconda parte (fornitore) — audit su un fornitore</span>
              </label>
            </div>
            <small className="form-hint">I nostri audit sono di prima parte (interno) o seconda parte (fornitore).</small>
          </div>

          {formData.auditPartyType === "second_party" && (
            <div className="form-group">
              <label htmlFor="fornitoreName">Fornitore auditato</label>
              <input
                type="text"
                id="fornitoreName"
                name="fornitoreName"
                value={formData.fornitoreName}
                onChange={handleChange}
                className="form-control"
                placeholder="es. Fornitore XYZ Srl"
              />
              <small className="form-hint">Azienda fornitore oggetto dell&apos;audit (seconda parte).</small>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auditDate">Data Audit *</label>
            <input
              type="date"
              id="auditDate"
              name="auditDate"
              value={formData.auditDate}
              onChange={handleChange}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="auditorName">Auditor *</label>
            <input
              type="text"
              id="auditorName"
              name="auditorName"
              value={formData.auditorName}
              onChange={handleChange}
              className={`form-control ${errors.auditorName ? "error" : ""}`}
              placeholder="es. Mario Rossi"
            />
            {errors.auditorName && (
              <span className="error-message">{errors.auditorName}</span>
            )}
          </div>

          <div className="form-group audit-type-section">
            <label className="section-label">Tipo di audit</label>
            <small className="form-hint block-hint">
              Seleziona <strong>almeno uno</strong> tra norme ISO e checklist personalizzata. Puoi scegliere entrambi per un audit ibrido.
            </small>
          </div>

          <div className="form-group">
            <label>Norme ISO</label>
            <div className="checkbox-group">
              {standardsForUser.length === 0 && user?.allowed_standard_ids ? (
                <p className="form-hint">Nessuno standard assegnato. Contatta l'amministratore.</p>
              ) : null}
              {standardsForUser.map(({ code, label }) => (
                <label key={code} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.norms.includes(code)}
                    onChange={() => handleNormToggle(code)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <small className="form-hint">Opzionale se usi una checklist personalizzata.</small>
            {errors.norms && (
              <span className="error-message">{errors.norms}</span>
            )}
          </div>

          {customChecklists.length > 0 && (
            <div className="form-group">
              <label htmlFor="customChecklist">Checklist personalizzata</label>
              <select
                id="customChecklist"
                value={formData.customChecklistId ?? ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    customChecklistId: e.target.value ? parseInt(e.target.value, 10) : null,
                  }))
                }
                className="form-control"
              >
                <option value="">— Nessuna —</option>
                {customChecklists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <small className="form-hint">
                Verbale visita, checklist dinamica: sezioni e voci aggiunte durante l'audit. Nessuna norma ISO richiesta.
              </small>
            </div>
          )}
        </form>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Annulla
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="btn btn-primary"
          >
            ✓ Crea Audit
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuditSelector;
