/**
 * Audit Selector Component
 * Dropdown per selezione, creazione, eliminazione audit
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useStorage } from "../contexts/StorageContext";
import { useAuth } from "../contexts/AuthContext";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import { getNextAuditNumber, sortAuditsByNumber } from "../utils/auditUtils";
import {
  auditMatchesCompanyScope,
  resolveNumericCompanyScope,
} from "../utils/auditCompanyScope";
import {
  formatAuditPeriodLabel,
  normalizeAuditDateEndForStorage,
  validateAuditDateRangeClient,
} from "../utils/auditDatePeriod";
import apiService from "../services/apiService";
import "./AuditSelector.css";

/**
 * Lista degli standard disponibili per la selezione in fase di creazione audit.
 * Per aggiungere un nuovo standard: inserire una nuova riga qui.
 */
const AVAILABLE_STANDARDS = [
  { code: "ISO_9001",   label: "ISO 9001:2015 - Qualit\u00e0", standardId: 1 },
  { code: "ISO_14001",  label: "ISO 14001:2015 - Ambiente", standardId: 2 },
  { code: "ISO_45001",  label: "ISO 45001:2018 - Salute e Sicurezza", standardId: 3 },
  { code: "ISO_3834_2", label: "ISO 3834-2 - Audit Fornitori in Campo", standardId: 6 },
  { code: "RDP_MSN",    label: "RDP Mason - Audit di Sistema Saldatura (ISO 3834-2)", standardId: 7 },
];

const CLOSED_AUDIT_STATUSES = new Set(["completed", "approved", "archived"]);

function auditRowId(audit) {
  return audit.metadata?.id || audit.id;
}

function isClosedAuditStatus(status) {
  return CLOSED_AUDIT_STATUSES.has(String(status || "").toLowerCase());
}

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
  const { companyId: companyScope, scopeCompanyName } = useCompanyScope();
  const scopedNumericId = resolveNumericCompanyScope(companyScope);
  const canCreateAudit = scopedNumericId != null;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isReauditMode, setIsReauditMode] = useState(false);
  const [showClosedAudits, setShowClosedAudits] = useState(false);

  // Ordina audit per numero (più recente prima) - filtro audit validi
  const validAudits = audits.filter((audit) => audit && audit.metadata);
  const sortedAudits = sortAuditsByNumber(validAudits, false);

  /** Impronta elenco audit: forza remount del secondo <select> quando cambia lo scope (RBAC/reconcile). */
  const auditsMenuKey = useMemo(() => {
    return audits
      .map((a) => String(a?.metadata?.id || a?.id || ""))
      .filter(Boolean)
      .sort()
      .join("|");
  }, [audits]);

  const scopedAudits = useMemo(
    () =>
      sortedAudits.filter((a) =>
        auditMatchesCompanyScope(a, companyScope, { scopeCompanyName })
      ),
    [sortedAudits, companyScope, scopeCompanyName]
  );

  const hasAnyClosedAudit = useMemo(
    () => scopedAudits.some((a) => isClosedAuditStatus(a.metadata?.status)),
    [scopedAudits]
  );

  const buildAuditsForSecondSelect = useCallback(
    (includeClosed) => {
      const filtered = includeClosed
        ? scopedAudits
        : scopedAudits.filter((a) => !isClosedAuditStatus(a.metadata?.status));
      const cur =
        currentAuditId &&
        validAudits.find((a) => auditRowId(a) === currentAuditId);
      // L'audit corrente è sempre incluso nella lista, indipendentemente dal filtro attivo.
      // Se è stato escluso dai filtri, viene aggiunto in testa e marcato come fuori filtro.
      const forcedCurrent =
        !!cur && !filtered.some((a) => auditRowId(a) === currentAuditId);
      return {
        list: forcedCurrent ? [cur, ...filtered] : filtered,
        currentOutsideFilter: forcedCurrent,
      };
    },
    [scopedAudits, validAudits, currentAuditId]
  );

  const { list: auditsForSecondSelect, currentOutsideFilter } = useMemo(
    () => buildAuditsForSecondSelect(showClosedAudits),
    [buildAuditsForSecondSelect, showClosedAudits]
  );

  // === HANDLERS ===

  const handleAuditChange = (e) => {
    const auditId = e.target.value;
    if (auditId) {
      switchAudit(auditId);
    }
  };

  const handleShowClosedAuditsChange = (e) => {
    setShowClosedAudits(e.target.checked);
    // Il filtro restringe la lista visibile ma non cambia l'audit attivo.
  };

  const handleCreateNewAudit = () => {
    if (!canCreateAudit) return;
    setIsReauditMode(false);
    setShowCreateModal(true);
  };

  const handleCreateReAudit = () => {
    setIsReauditMode(true);
    setShowCreateModal(true);
  };

  const handleDeleteAudit = async () => {
    if (!currentAudit) return;
    const num = currentAudit.metadata.auditNumber || "-";
    const client = currentAudit.metadata.clientName || "-";
    const first = window.confirm(
      `Eliminare definitivamente l'audit?\n\n${num} - ${client}\n\nQuesta operazione rimuove l'audit dal browser e dal server.\nNon può essere annullata.`
    );
    if (!first) return;
    const second = window.confirm(
      `⚠️ CONFERMA FINALE\n\nAudit "${num}" verrà eliminato in modo permanente.\nProcedere?`
    );
    if (!second) return;
    try {
      await deleteAudit(currentAuditId);
    } catch (err) {
      alert(`Errore durante l'eliminazione dell'audit.\n${err?.message || "Riprova o contatta l'assistenza."}`);
    }
  };



  // === RENDER ===

  if (audits.length === 0) {
    return (
      <>
        <div className="audit-selector empty">
          <p>Nessun audit disponibile</p>
          <button
            type="button"
            onClick={handleCreateNewAudit}
            className="btn btn-primary"
            disabled={!canCreateAudit}
            title={!canCreateAudit ? "Seleziona un'azienda nell'Ambito in alto" : ""}
          >
            {"\u2795"} Crea Primo Audit
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
            defaultCompanyId={scopedNumericId}
            companyName={scopeCompanyName}
          />
        )}
      </>
    );
  }

  return (
    <div className="audit-selector">
      <div className="audit-selector-header">
        <div className="audit-selector-controls">
<div className="audit-selector-filters">
            <div className="audit-filter-field audit-filter-field-grow">
              <label htmlFor="audit-select" className="audit-filter-label">
                Audit
              </label>
              <select
                id="audit-select"
                key={`audit-dd-${user?.user_id ?? "x"}-${user?.organization_id ?? "o"}-${user?.auditor_org_id ?? "ao"}-${auditsMenuKey}`}
                value={currentAuditId || ""}
                onChange={handleAuditChange}
                className="audit-dropdown"
              >
                <option value="">-- Seleziona un audit --</option>
                {auditsForSecondSelect.map((audit) => {
                  const auditId = audit.metadata?.id || audit.id;
                  const outsideFilter =
                    currentOutsideFilter && auditId === currentAuditId;
                  const periodLabel = formatAuditPeriodLabel(
                    audit.metadata.auditDate,
                    audit.metadata.auditDateEnd
                  );
                  return (
                    <option key={auditId} value={auditId}>
                      {outsideFilter ? "⚠ " : ""}
                      {audit.metadata.auditNumber} - {audit.metadata.clientName}
                      {periodLabel ? ` [${periodLabel}]` : ""}{" "}
                      ({audit.metadata.status})
                      {outsideFilter ? " - fuori filtro" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            {hasAnyClosedAudit && (
              <div className="audit-filter-field audit-show-closed-wrap">
                <span className="audit-filter-label audit-filter-label-spacer" aria-hidden="true">
                  &nbsp;
                </span>
                <label htmlFor="audit-show-closed" className="audit-show-closed-label">
                  <input
                    id="audit-show-closed"
                    type="checkbox"
                    checked={showClosedAudits}
                    onChange={handleShowClosedAuditsChange}
                  />
                  <span>Mostra audit completati / approvati</span>
                </label>
              </div>
            )}
          </div>

          {/* Due pulsanti distinti: Nuovo Audit vs Re-Audit */}
          <button
            type="button"
            onClick={handleCreateNewAudit}
            className="btn btn-icon btn-success"
            title={!canCreateAudit ? "Seleziona un'azienda nell'Ambito in alto" : "Crea nuovo audit"}
            disabled={!canCreateAudit}
          >
            {"\u2795"} Nuovo
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
          defaultCompanyId={scopedNumericId}
          companyName={scopeCompanyName}
        />
      )}


    </div>
  );
}

// === MODAL CREAZIONE AUDIT ===

function CreateAuditModal({
  audits, currentAudit, isReaudit, onClose, onCreate, defaultCompanyId, companyName,
}) {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  // Standard visibili in base a user_standards: se allowed_standard_ids presente, solo quelli
  const standardsForUser = !user?.allowed_standard_ids
    ? AVAILABLE_STANDARDS
    : user.allowed_standard_ids.length === 0
      ? []
      : AVAILABLE_STANDARDS.filter((s) => user.allowed_standard_ids.includes(s.standardId));
  const nextNumber = getNextAuditNumber(audits, currentYear);

  // Pre-popola clientName, companyId, tipologia, fornitore, norme e auditor se re-audit
  const initialClientName = isReaudit && currentAudit
    ? currentAudit.metadata.clientName
    : (companyName || "");
  const initialCompanyId = isReaudit && currentAudit?.metadata?.companyId
    ? currentAudit.metadata.companyId
    : (defaultCompanyId ?? null);
  const initialPartyType = isReaudit && currentAudit?.metadata?.auditPartyType 
    ? currentAudit.metadata.auditPartyType 
    : "first_party";
  const initialFornitore = isReaudit && currentAudit?.metadata?.fornitoreName 
    ? currentAudit.metadata.fornitoreName 
    : "";
  const initialFornitoreSupplierId = isReaudit && currentAudit?.metadata?.fornitoreSupplierId
    ? currentAudit.metadata.fornitoreSupplierId
    : null;
  // Re-audit: riporta le stesse norme, auditor e checklist personalizzata
  const initialNorms = isReaudit && currentAudit?.metadata?.selectedStandards?.length > 0
    ? currentAudit.metadata.selectedStandards
    : [];
  const initialAuditorName = isReaudit && currentAudit?.metadata?.auditorName
    ? currentAudit.metadata.auditorName
    : "";
  const initialCustomChecklistId = isReaudit
    ? (currentAudit?.metadata?.customChecklistId ?? currentAudit?.custom_checklist_id ?? null)
    : null;

  const [formData, setFormData] = useState({
    auditNumber: nextNumber,
    clientName: initialClientName,
    companyId: initialCompanyId,
    auditPartyType: initialPartyType,
    fornitoreName: initialFornitore,
    fornitoreSupplierId: initialFornitoreSupplierId,
    auditDate: new Date().toISOString().split("T")[0],
    auditDateEnd: "",
    auditorName: initialAuditorName,
    norms: initialNorms,
    customChecklistId: initialCustomChecklistId,
  });

  const [customChecklists, setCustomChecklists] = useState([]);
  useEffect(() => {
    apiService.getCustomChecklists().then((res) => {
      setCustomChecklists(res?.data ?? []);
    }).catch(() => setCustomChecklists([]));
  }, []);

  // Aziende: il tenant arriva da Ambito (o dalla riga in re-audit), non da un select.

  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);

  const loadSuppliers = useCallback(async (companyId) => {
    if (!companyId) {
      setSuppliers([]);
      return;
    }
    setSuppliersLoading(true);
    try {
      const res = await apiService.getSuppliers({ company_id: companyId, is_active: 'true' });
      setSuppliers(res?.data || []);
    } catch (err) {
      console.warn("Caricamento fornitori:", err.message);
      setSuppliers([]);
    } finally {
      setSuppliersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (formData.auditPartyType === 'second_party' && formData.companyId) {
      loadSuppliers(formData.companyId);
    } else {
      setSuppliers([]);
    }
  }, [formData.auditPartyType, formData.companyId, loadSuppliers]);

  const prevCompanyIdRef = React.useRef(formData.companyId);
  useEffect(() => {
    if (prevCompanyIdRef.current !== formData.companyId) {
      prevCompanyIdRef.current = formData.companyId;
      setFormData(p => ({ ...p, fornitoreSupplierId: null, fornitoreName: "" }));
    }
  }, [formData.companyId]);

  const [errors, setErrors] = useState({});
  const [pendingInfo, setPendingInfo] = useState(null); // { count, lastAuditId, issues }
  const [auditHistory, setAuditHistory] = useState([]);  // storico audit completati GAP-13

  /**
   * Verifica se il cliente ha rilievi pendenti (NC/OSS/NV) da audit precedenti.
   * @param {string} clientName  - nome cliente da cercare
   * @param {string|null} excludeUuid - UUID dell'audit da escludere dalla ricerca
   *   (null per "Nuovo audit" e re-audit: trova l'audit più recente del cliente)
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

  // Re-audit: controlla pending all'apertura modal (cliente già noto dall'audit corrente).
  // Si passa null come excludeUuid: vogliamo i rilievi aperti DELL'audit corrente (non del precedente).
  React.useEffect(() => {
    if (isReaudit && currentAudit) {
      const cn = currentAudit.metadata?.clientName;
      checkPendingIssues(cn, null);
    }
  }, [isReaudit, currentAudit]);

  // Re-audit: carica storico ultimi audit completati per il cliente (GAP-13).
  React.useEffect(() => {
    if (!isReaudit) return;
    const companyId = formData.companyId;
    const clientName = formData.clientName?.trim();
    if (!companyId && !clientName) return;
    const params = companyId
      ? { company_id: companyId, limit: 5 }
      : { client_name: clientName, limit: 5 };
    apiService.getClientAuditHistory(params)
      .then(res => setAuditHistory(res?.history || []))
      .catch(() => setAuditHistory([]));
  }, [isReaudit, formData.companyId, formData.clientName]);

  // Nuovo audit: rilievi pendenti del cliente fissato dall'Ambito.
  React.useEffect(() => {
    if (isReaudit) return;
    const cn = formData.clientName?.trim();
    if (cn && cn.length >= 3) checkPendingIssues(cn, null);
  }, [isReaudit, formData.clientName]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const MANUAL_COMPANY_VALUE = "__manual__";

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

    const dateCheck = validateAuditDateRangeClient(
      formData.auditDate,
      formData.auditDateEnd
    );
    if (!dateCheck.valid) {
      newErrors.auditDate = dateCheck.message;
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
    submitData.auditDateEnd = normalizeAuditDateEndForStorage(
      formData.auditDate,
      formData.auditDateEnd
    );
    // Mappa norms → selectedStandards (atteso da createNewAudit in auditDataModel.js)
    submitData.selectedStandards = formData.norms;
    submitData.companyId = formData.companyId || null;
    submitData.fornitoreSupplierId = formData.fornitoreSupplierId || null;
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

        {/* Storico audit completati — solo in re-audit, mostra trend NC/OSS nel tempo (GAP-13) */}
        {isReaudit && auditHistory.length > 0 && (
          <div className="audit-history-section">
            <div className="audit-history-header">
              <span className="audit-history-icon">📊</span>
              <strong>Storico audit ({auditHistory.length} completati)</strong>
            </div>
            <div className="audit-history-list">
              {auditHistory.map((h) => (
                <div key={h.audit_id} className="audit-history-item">
                  <span className="audit-history-number">{h.audit_number}</span>
                  <span className="audit-history-date">
                    {new Date(h.audit_date).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}
                  </span>
                  <span className="audit-history-badges">
                    {h.nc_count > 0 && (
                      <span className="audit-history-badge badge-nc">{h.nc_count} NC</span>
                    )}
                    {h.oss_count > 0 && (
                      <span className="audit-history-badge badge-oss">{h.oss_count} OSS</span>
                    )}
                    {h.nc_count === 0 && h.oss_count === 0 && h.answered_count > 0 && (
                      <span className="audit-history-badge badge-ok">✓ Conforme</span>
                    )}
                    {h.answered_count === 0 && (
                      <span className="audit-history-badge badge-na">—</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sezione rilievi pendenti - re-audit o nuovo audit con storico cliente */}
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
                      {issue.question_text || issue.notes || '-'}
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
            <label htmlFor="clientName">Azienda committente</label>
            <input
              type="text"
              id="clientName"
              readOnly
              value={formData.clientName || "\u2014"}
              className="form-control readonly"
              aria-label="Azienda non modificabile"
            />
            <small className="form-hint">
              {isReaudit
                ? "Presa dall'audit da rinnovare. Non si cambia da qui."
                : "Fissata dall'Ambito. Non si cambia da qui."}
            </small>
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
                <span>Prima parte (interno) - audit sul committente</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="radio"
                  name="auditPartyType"
                  checked={formData.auditPartyType === "second_party"}
                  onChange={() => setFormData((p) => ({ ...p, auditPartyType: "second_party" }))}
                />
                <span>Seconda parte (fornitore) - audit su un fornitore</span>
              </label>
            </div>
            <small className="form-hint">I nostri audit sono di prima parte (interno) o seconda parte (fornitore).</small>
          </div>

          {formData.auditPartyType === "second_party" && (
            <div className="form-group">
              <label htmlFor="fornitoreSelect">Azienda auditata</label>
              {!formData.companyId ? (
                <>
                  <p className="form-hint" style={{ marginBottom: '0.5rem' }}>
                    Seleziona prima l&apos;azienda committente per elencare i fornitori collegati.
                  </p>
                  <input
                    type="text"
                    id="fornitoreName"
                    name="fornitoreName"
                    value={formData.fornitoreName || ""}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="es. Fornitore XYZ Srl (inserimento manuale)"
                  />
                </>
              ) : suppliers.length > 0 || formData.fornitoreName ? (
                <>
                  <select
                    id="fornitoreSelect"
                    value={
                      formData.fornitoreSupplierId
                        ? String(formData.fornitoreSupplierId)
                        : (formData.fornitoreName && !formData.fornitoreSupplierId ? MANUAL_COMPANY_VALUE : "")
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === MANUAL_COMPANY_VALUE) {
                        setFormData(p => ({ ...p, fornitoreSupplierId: null }));
                      } else if (val === "") {
                        setFormData(p => ({ ...p, fornitoreSupplierId: null, fornitoreName: "" }));
                      } else {
                        const found = suppliers.find(s => String(s.id) === val);
                        setFormData(p => ({
                          ...p,
                          fornitoreSupplierId: found ? found.id : null,
                          fornitoreName: found ? found.name : p.fornitoreName,
                        }));
                      }
                    }}
                    className="form-control"
                    disabled={suppliersLoading}
                  >
                    <option value="">- Seleziona fornitore -</option>
                    <option value={MANUAL_COMPANY_VALUE}>- Inserimento manuale -</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.vat_number ? ` (P.IVA ${s.vat_number})` : ""}
                      </option>
                    ))}
                  </select>
                  {(!formData.fornitoreSupplierId) && (
                    <input
                      type="text"
                      id="fornitoreName"
                      name="fornitoreName"
                      value={formData.fornitoreName || ""}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="es. Fornitore XYZ Srl"
                      style={{ marginTop: "0.5rem" }}
                    />
                  )}
                  <small className="form-hint">Fornitori dell&apos;anagrafica collegati al committente, oppure inserimento manuale.</small>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    id="fornitoreName"
                    name="fornitoreName"
                    value={formData.fornitoreName || ""}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="es. Fornitore XYZ Srl"
                  />
                  <small className="form-hint">Nessun fornitore in anagrafica per questo committente: inserimento manuale.</small>
                </>
              )}
            </div>
          )}

          <div className="form-row form-row-dates" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div className="form-group">
              <label htmlFor="auditDate">Data inizio *</label>
              <input
                type="date"
                id="auditDate"
                name="auditDate"
                value={formData.auditDate}
                onChange={handleChange}
                className={`form-control ${errors.auditDate ? "error" : ""}`}
              />
              {errors.auditDate && (
                <span className="error-message">{errors.auditDate}</span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="auditDateEnd">Data fine</label>
              <input
                type="date"
                id="auditDateEnd"
                name="auditDateEnd"
                value={formData.auditDateEnd || ""}
                min={formData.auditDate || undefined}
                onChange={handleChange}
                className="form-control"
              />
              <small className="form-hint">Opzionale per audit su più giorni</small>
            </div>
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
                <option value="">- Nessuna -</option>
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
