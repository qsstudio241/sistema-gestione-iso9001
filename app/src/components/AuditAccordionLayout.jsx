/**
 * AuditAccordionLayout - Mobile-First Accordion Navigation
 * Struttura ad albero verticale conforme al template Word
 */

import { useState, useEffect, useCallback } from "react";
import { useStorage } from "../contexts/StorageContext";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import {
  STANDARDS_LIST,
  STANDARD_INIT_MAP,
} from "../data/standardsRegistry";
import "./AuditAccordionLayout.css";

// Import sezioni
import GeneralDataSection from "./GeneralDataSection";
import AuditObjectiveSection from "./AuditObjectiveSection";
import PendingIssuesCascade from "./PendingIssuesCascade";
import CertificationFindingsSection from "./CertificationFindingsSection";
import ChecklistModule from "./ChecklistModule";
import CustomChecklistAuditView from "./CustomChecklistAuditView";
import AuditOutcomeSection from "./AuditOutcomeSection";
import ExportPanel from "./ExportPanel";
import AuditClosePanel from "./AuditClosePanel";
import NonConformitiesManager from "./NonConformitiesManager";

/** Mappa status → etichetta italiana e classe CSS */
const STATUS_LABELS = {
  draft:       { label: "BOZZA",      cls: "draft"      },
  in_progress: { label: "IN CORSO",   cls: "in-progress" },
  suspended:   { label: "SOSPESO",    cls: "suspended"  },
  completed:   { label: "COMPLETATO", cls: "completed"  },
  approved:    { label: "APPROVATO",  cls: "approved"   },
  archived:    { label: "ARCHIVIATO", cls: "archived"   },
};

function AuditStatusBadge({ status }) {
  const cfg = STATUS_LABELS[status] || { label: (status || "").toUpperCase(), cls: "draft" };
  return (
    <span className={`audit-status-badge badge-status-${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// Source of Truth degli standard supportati: importata da
// `app/src/data/standardsRegistry.js` (ADR-009 Fase 1).
// Per aggiungere un nuovo standard: aggiungere UNA SOLA RIGA in
// STANDARDS_REGISTRY (registry condiviso) — questo file non richiede modifiche.

const MANUAL_COMPANY_VALUE = "__manual__";

function AuditAccordionLayout({ currentAudit, onUpdate, onBack, isSaving, allSaved }) {
  const { initializeChecklist, hydrateQuestionIds, fetchAndApplyServerResponses, syncStatus, serverDataStatus, setServerDataStatus, auditLock } = useStorage();
  // Il banner "ready" sparisce dopo 3 secondi
  const [showReadyBanner, setShowReadyBanner] = useState(false);
  useEffect(() => {
    if (serverDataStatus === 'ready') {
      setShowReadyBanner(true);
      const t = setTimeout(() => setShowReadyBanner(false), 3000);
      return () => clearTimeout(t);
    } else {
      setShowReadyBanner(false);
    }
  }, [serverDataStatus]);
  const { user } = useAuth();

  const LOCKED_STATUSES = ['completed', 'approved', 'archived'];
  // Read-only se: audit formalmente chiuso/approvato OPPURE lock in uso da altro utente
  const isReadOnly = LOCKED_STATUSES.includes(currentAudit?.metadata?.status) || auditLock?.mode === 'foreign';

  // Caricamento aziende per dropdown "Azienda auditata" (seconda parte)
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const isSuperadmin = user?.role === 'admin' && !user?.auditor_org_id;

  const loadCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    try {
      let orgId = user?.auditor_org_id ?? null;
      // Superadmin senza auditor_org_id: carica il primo auditor_org disponibile
      if (!orgId && isSuperadmin) {
        const orgsRes = await apiService.getAuditorOrgs();
        const orgs = orgsRes?.data || orgsRes || [];
        orgId = Array.isArray(orgs) && orgs.length > 0 ? orgs[0].id : null;
      }
      if (!orgId) { setCompanies([]); return; }
      const res = await apiService.getCompanies({ auditor_org_id: orgId });
      setCompanies(res.data || []);
    } catch {
      setCompanies([]);
    } finally {
      setCompaniesLoading(false);
    }
  }, [user?.auditor_org_id, isSuperadmin]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // Metriche per-norma in tempo reale (ADR-009 Fase 1).
  // Il chip header le legge per mostrare "9001: 2 NC · 14001: 1 NC · totale 3".
  // Calcolato a livello top del componente (PRIMA del guard `if (!currentAudit)`)
  // Stato per gestire quali sezioni sono aperte
  const [checklistExpandTrigger, setChecklistExpandTrigger] = useState(0);

  const [openSections, setOpenSections] = useState({
    "general-data": false,
    checklist: false,
    "nc-register": false,
    outcome: false,
    conclusions: false,
    close: false,
    export: false,
  });

  // Stato per gestire quali sotto-sezioni sono aperte.
  // Le sottosezioni standard sono generate dinamicamente da STANDARDS_REGISTRY
  // (ADR-009 Fase 1): aggiungere un nuovo standard al registro popola in
  // automatico la mappa qui sotto.
  const [openSubSections, setOpenSubSections] = useState(() => ({
    "general-data-form": false,
    objective: false,
    "pending-issues": false,
    "cert-findings": false,
    "custom-checklist": false,
    ...Object.fromEntries(STANDARDS_LIST.map(({ subsId }) => [subsId, false])),
  }));

  const toggleSection = (sectionId) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const toggleSubSection = (subSectionId) => {
    setOpenSubSections((prev) => ({
      ...prev,
      [subSectionId]: !prev[subSectionId],
    }));
  };

  /**
   * navigateTo(path, fieldId) — apre tutti i livelli accordion dichiarati in path[],
   * poi scrolla al fieldId. Aggiungere un nuovo tipo a PathStep è sufficiente
   * per supportare qualsiasi futura struttura annidata senza modificare i chiamanti.
   *
   * Tipi PathStep supportati:
   *   { type: 'section',      key }  → openSections[key] = true
   *   { type: 'subsection',   key }  → openSubSections[key] = true
   *   { type: 'clauseExpand'      }  → checklistExpandTrigger++ (apre tutte le clausole)
   */
  const navigateTo = useCallback((path, fieldId) => {
    // Applica tutti i passi del path in un unico batch React 18
    (path ?? []).forEach((step) => {
      if (step.type === "section" && step.key)
        setOpenSections((prev) => ({ ...prev, [step.key]: true }));
      else if (step.type === "subsection" && step.key)
        setOpenSubSections((prev) => ({ ...prev, [step.key]: true }));
      else if (step.type === "clauseExpand")
        setChecklistExpandTrigger((prev) => prev + 1);
    });

    // Attende che React re-renda tutti i livelli, poi scrolla e focalizza
    setTimeout(() => {
      const firstSectionKey = (path ?? []).find((s) => s.type === "section")?.key;
      const target = fieldId
        ? document.getElementById(fieldId)
        : document.getElementById(`sgq-section-${firstSectionKey}`);
      if (!target) return;

      target.scrollIntoView({ behavior: "smooth", block: "center" });
      try { target.focus({ preventScroll: true }); } catch (_) {}
      target.classList.add("sgq-guided-highlight");
      setTimeout(() => target.classList.remove("sgq-guided-highlight"), 1800);
    }, 400);
  }, []);

  const handleGeneralDataUpdate = (updatedData) => {
    onUpdate("generalData", updatedData);
  };

  const handleAuditObjectiveUpdate = (updatedData) => {
    onUpdate("auditObjective", updatedData);
  };

  const handleAuditOutcomeUpdate = (updatedData) => {
    onUpdate("auditOutcome", updatedData);
  };

  /**
   * Deep-link: apre la sezione checklist e la sottosezione dello standard
   * che contiene section_code, poi scrolla alla domanda tramite id DOM.
   *
   * Identifica lo standard cercando, dentro il registry, una entry il cui
   * `key` o uno dei `codes` sia contenuto come substring nel `sectionCode`
   * (es. "ISO_9001_clause4" → ISO_9001). Pattern scalabile: aggiungere uno
   * standard al registry lo rende automaticamente deep-linkabile.
   */
  const handleGoToQuestion = useCallback((sectionCode, questionId) => {
    if (!sectionCode) return;
    const upper = sectionCode.toUpperCase();

    const stdEntry =
      STANDARDS_LIST.find(({ key, codes }) => {
        if (upper.includes(key.toUpperCase())) return true;
        return codes.some((code) => upper.includes(code.toUpperCase()));
      }) ?? null;

    setOpenSections(prev => ({ ...prev, checklist: true }));
    if (stdEntry) {
      setOpenSubSections(prev => ({ ...prev, [stdEntry.subsId]: true }));
    }

    if (questionId) {
      setTimeout(() => {
        const el = document.getElementById(`question-${questionId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
    }
  }, []); // STANDARDS_LIST e setter React sono stabili

  // Auto-inizializza checklist al caricamento dell'audit per tutti gli standard selezionati
  useEffect(() => {
    if (!currentAudit) return;
    const standards = currentAudit.metadata?.selectedStandards || [];

    // Per ogni standard supportato: se selezionato e checklist vuota → inizializza template
    Object.entries(STANDARD_INIT_MAP).forEach(([key, codes]) => {
      const isSelected = standards.some((s) => codes.includes(s));
      const checklist = currentAudit.checklist?.[key];
      const isEmpty = !checklist || Object.keys(checklist).length === 0;
      if (isSelected && isEmpty) {
        console.log(`[AuditAccordionLayout] Auto-init checklist ${key} per audit:`, currentAudit.id);
        initializeChecklist(key);
        if (key === "ISO_3834_2" || key === "RDP_MSN") {
          hydrateQuestionIds(key)?.catch((e) => console.warn("[HYDRATE] questionIds:", e.message));
        }
      }
    });

    // Idrata risposte dal server per TUTTI gli standard (audit esistente con auditId).
    // Il banner loading parte subito (setServerDataStatus), poi fetchAndApplyServerResponses
    // aggiorna il banner a 'ready' o 'error' al termine del fetch.
    // Il delay garantisce che React abbia processato gli setState di initializeChecklist
    // prima che le risposte vengano applicate (evita race condition).
    const numericId = currentAudit.metadata?.auditId;
    if (numericId) {
      setServerDataStatus('loading');
      setTimeout(() => fetchAndApplyServerResponses(numericId), 150);
    } else {
      // Audit solo locale (non ancora sul server): nessun fetch, stato idle
      setServerDataStatus('idle');
    }
  }, [currentAudit?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStandardsUpdate = (updatedStandards) => {
    const previousStandards = currentAudit.metadata.selectedStandards || [];

    // Trova standard aggiunti
    const addedStandards = updatedStandards.filter(
      (std) => !previousStandards.includes(std)
    );

    // Trova standard rimossi
    const removedStandards = previousStandards.filter(
      (std) => !updatedStandards.includes(std)
    );

    console.log(`[Accordion] Standard update: added=${addedStandards}, removed=${removedStandards}`);

    // Aggiorna metadata
    onUpdate("selectedStandards", updatedStandards);

    // Inizializza checklist per standard aggiunti — usa STANDARD_INIT_MAP per scalabilità
    addedStandards.forEach((standard) => {
      const entry = Object.entries(STANDARD_INIT_MAP).find(([, codes]) => codes.includes(standard));
      if (entry) {
        const [key] = entry;
        console.log(`[Accordion] Triggering initializeChecklist for ${standard} → key: ${key}`);
        initializeChecklist(key);
      } else {
        console.warn(`[Accordion] Standard non riconosciuto in STANDARD_INIT_MAP: ${standard}`);
      }
    });

    // TODO: Rimuovere checklist per standard deselezionati
    // (per ora lasciamo la checklist anche se deselezionato, per evitare perdita dati)
  };

  // Guardia: se currentAudit è null, mostra messaggio
  if (!currentAudit) {
    return (
      <div className="audit-accordion-layout">
        <div className="no-audit-message">
          <h2>⚠️ Nessun audit selezionato</h2>
          <p>Seleziona un audit dalla lista o creane uno nuovo.</p>
        </div>
      </div>
    );
  }

  // Verifica quali standard sono selezionati
  const selectedStandards = currentAudit.metadata.selectedStandards || [];

  // Calcola quali standard hanno già risposte nella checklist locale
  // (usato da GeneralDataSection per bloccare la deselezione e proteggere i dati)
  const standardsWithData = Object.entries(currentAudit.checklist || {})
    .filter(([, data]) => data && Object.keys(data).length > 0)
    .map(([key]) => key); // es. ["ISO_9001", "ISO_14001"]

  return (
    <div className="audit-accordion-layout">
      {/* Header con info audit */}
      <div className="audit-header">
        <div className="audit-header-top">
          {onBack && (
            <button
              type="button"
              className="btn-back-to-list"
              onClick={onBack}
              title="Torna alla lista audit"
            >
              ← Lista Audit
            </button>
          )}
          <div className="audit-save-status">
            {isSaving ? (
              <span className="save-indicator saving">⏳ Salvataggio...</span>
            ) : syncStatus?.isSyncing ? (
              <span className="save-indicator syncing">📤 Sincronizzazione...</span>
            ) : syncStatus?.queueSize > 0 ? (
              <span className="save-indicator queued" title={`${syncStatus.queueSize} operazioni in attesa di essere inviate al server`}>
                ⏰ In coda ({syncStatus.queueSize})
              </span>
            ) : allSaved ? (
              <span className="save-indicator server-saved">✓ Sul server</span>
            ) : (
              <span className="save-indicator pending">● In attesa</span>
            )}
          </div>
        </div>
        <div className="audit-header-main">
          <div className="audit-title">
            <h1>{currentAudit.metadata.clientName}</h1>
            <span className="audit-number">
              Audit N. {currentAudit.metadata.auditNumber}
            </span>
          </div>
          <div className="audit-meta">
            <AuditStatusBadge status={currentAudit.metadata.status} />
            <span className="audit-date">
              {new Date(currentAudit.metadata.lastModified).toLocaleDateString(
                "it-IT"
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Banner read-only — visibile quando audit è in stato bloccato */}
      {isReadOnly && (
        <div className="audit-readonly-banner">
          🔒 Audit in sola lettura — stato: <strong>{currentAudit.metadata.status?.toUpperCase()}</strong>.
          Nessuna modifica consentita.
        </div>
      )}

      {/* Banner stato caricamento dati dal server */}
      {serverDataStatus === 'loading' && (
        <div className="server-data-banner server-data-banner--loading">
          <span className="server-data-banner__spinner" aria-hidden="true">⏳</span>
          <span>Caricamento risposte dal server in corso — le modifiche sono disabilitate temporaneamente…</span>
        </div>
      )}
      {showReadyBanner && (
        <div className="server-data-banner server-data-banner--ready">
          <span aria-hidden="true">✅</span>
          <span>Dati aggiornati dal server — puoi modificare</span>
        </div>
      )}
      {serverDataStatus === 'error' && (
        <div className="server-data-banner server-data-banner--error">
          <span aria-hidden="true">⚠️</span>
          <span>Impossibile caricare le risposte dal server — vengono mostrati i dati locali. Ricarica per riprovare.</span>
        </div>
      )}

      {/* Accordion Content */}
      <div className="accordion-container">
        {/* ==================== SEZIONE 1: DATI GENERALI ==================== */}
        <div id="sgq-section-general-data" className="accordion-section">
          <button
            className={`accordion-header ${
              openSections["general-data"] ? "open" : ""
            }`}
            onClick={() => toggleSection("general-data")}
          >
            <span className="section-icon">📋</span>
            <span className="section-arrow">
              {openSections["general-data"] ? "▼" : "▶"}
            </span>
            <span className="section-title">1 – DATI GENERALI</span>
          </button>

          {openSections["general-data"] && (
            <div className="accordion-content">
              {/* Sub-Section: 1.1 Informazioni Audit */}
              <div className="accordion-subsection">
                <button
                  className={`accordion-subheader ${
                    openSubSections["general-data-form"] ? "open" : ""
                  }`}
                  onClick={() => toggleSubSection("general-data-form")}
                >
                  <span className="subsection-number">1.1</span>
                  <span className="subsection-arrow">
                    {openSubSections["general-data-form"] ? "▼" : "▶"}
                  </span>
                  <span className="subsection-title">Informazioni di base sull'audit: oggetto, campo di applicazione, riferimenti documentali</span>
                </button>

                {openSubSections["general-data-form"] && (
                  <div className="subsection-content">
                    {/* Blocco Tipologia audit: modifica dopo creazione */}

                    <div className="tipologia-audit-block">
                      <span className="tipologia-label">Tipologia audit</span>
                      <div className="tipologia-audit-options">
                        <label>
                          <input
                            type="radio"
                            name="auditPartyType"
                            checked={(currentAudit.metadata?.auditPartyType || 'first_party') === 'first_party'}
                            onChange={() => onUpdate('auditPartyType', 'first_party')}
                            disabled={isReadOnly}
                          />
                          Prima parte (interno)
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="auditPartyType"
                            checked={(currentAudit.metadata?.auditPartyType || 'first_party') === 'second_party'}
                            onChange={() => onUpdate('auditPartyType', 'second_party')}
                            disabled={isReadOnly}
                          />
                          Seconda parte (fornitore)
                        </label>
                      </div>
                      {(currentAudit.metadata?.auditPartyType || 'first_party') === 'second_party' && (
                        <div className="tipologia-audit-fornitore">
                          <label className="subsection-label">Azienda auditata</label>
                          {companies.length > 0 ? (
                            <>
                              <select
                                className="subsection-input form-control"
                                style={{ width: '100%', maxWidth: '400px', padding: '0.35rem 0.5rem' }}
                                value={
                                  currentAudit.metadata?.fornitoreCompanyId
                                    ? String(currentAudit.metadata.fornitoreCompanyId)
                                    : (currentAudit.metadata?.fornitoreName && !currentAudit.metadata?.fornitoreCompanyId
                                        ? MANUAL_COMPANY_VALUE
                                        : "")
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === MANUAL_COMPANY_VALUE) {
                                    onUpdate('fornitoreCompanyId', null);
                                  } else if (val === "") {
                                    onUpdate('fornitoreCompanyId', null);
                                    onUpdate('fornitoreName', "");
                                  } else {
                                    const found = companies.find(c => String(c.id) === val);
                                    onUpdate('fornitoreCompanyId', found ? found.id : null);
                                    onUpdate('fornitoreName', found ? found.name : "");
                                  }
                                }}
                                disabled={isReadOnly || companiesLoading}
                              >
                                <option value="">— Seleziona azienda auditata —</option>
                                <option value={MANUAL_COMPANY_VALUE}>— Inserimento manuale —</option>
                                {companies.map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}{c.vat_number ? ` (P.IVA ${c.vat_number})` : ""}
                                  </option>
                                ))}
                              </select>
                              {!currentAudit.metadata?.fornitoreCompanyId && (
                                <input
                                  type="text"
                                  className="subsection-input"
                                  value={currentAudit.metadata?.fornitoreName || ''}
                                  onChange={(e) => onUpdate('fornitoreName', e.target.value)}
                                  placeholder="es. Fornitore XYZ Srl"
                                  style={{ width: '100%', maxWidth: '400px', padding: '0.35rem 0.5rem', marginTop: '0.4rem' }}
                                  disabled={isReadOnly}
                                />
                              )}
                              <small style={{ color: '#6b7280', fontSize: '0.78rem' }}>Scegli dall&apos;anagrafica o inserisci manualmente.</small>
                            </>
                          ) : (
                            <input
                              type="text"
                              className="subsection-input"
                              value={currentAudit.metadata?.fornitoreName || ''}
                              onChange={(e) => onUpdate('fornitoreName', e.target.value)}
                              placeholder="es. Fornitore XYZ Srl"
                              style={{ width: '100%', maxWidth: '400px', padding: '0.35rem 0.5rem' }}
                              disabled={isReadOnly}
                            />
                          )}
                        </div>
                      )}
                    </div>
                    <GeneralDataSection
                      generalData={currentAudit.metadata.generalData}
                      selectedStandards={selectedStandards}
                      standardsWithData={standardsWithData}
                      customChecklistId={currentAudit?.metadata?.customChecklistId ?? currentAudit?.custom_checklist_id}
                      onUpdate={handleGeneralDataUpdate}
                      onStandardsUpdate={handleStandardsUpdate}
                      readOnly={isReadOnly}
                    />
                    <button className="accordion-collapse-btn" onClick={() => toggleSubSection("general-data-form")}>▲ Chiudi 1.1</button>
                  </div>
                )}
              </div>

              {/* Sub-Section: 1.2 Obiettivo */}
              <div className="accordion-subsection">
                <button
                  className={`accordion-subheader ${
                    openSubSections["objective"] ? "open" : ""
                  }`}
                  onClick={() => toggleSubSection("objective")}
                >
                  <span className="subsection-number">1.2</span>
                  <span className="subsection-arrow">
                    {openSubSections["objective"] ? "▼" : "▶"}
                  </span>
                  <span className="subsection-title">Obiettivo dell'Audit</span>
                </button>

                {openSubSections["objective"] && (
                  <div className="subsection-content">
                    <AuditObjectiveSection
                      auditObjective={currentAudit.metadata.auditObjective}
                      onUpdate={handleAuditObjectiveUpdate}
                      readOnly={isReadOnly}
                    />
                    <button className="accordion-collapse-btn" onClick={() => toggleSubSection("objective")}>▲ Chiudi 1.2</button>
                  </div>
                )}
              </div>

              {/* Sub-Section: 1.3 Rilievi Pendenti */}
              <div className="accordion-subsection">
                <button
                  className={`accordion-subheader ${
                    openSubSections["pending-issues"] ? "open" : ""
                  }`}
                  onClick={() => toggleSubSection("pending-issues")}
                >
                  <span className="subsection-number">1.3</span>
                  <span className="subsection-arrow">
                    {openSubSections["pending-issues"] ? "▼" : "▶"}
                  </span>
                  <span className="subsection-title">Rilievi Pendenti</span>
                </button>

                {openSubSections["pending-issues"] && (
                  <div className="subsection-content">
                    <PendingIssuesCascade onGoToQuestion={handleGoToQuestion} />
                  </div>
                )}
              </div>

              {/* Sub-Section: 1.4 Rilievi dell'Ente Certificatore */}
              <div className="accordion-subsection">
                <button
                  className={`accordion-subheader ${openSubSections["cert-findings"] ? "open" : ""}`}
                  onClick={() => toggleSubSection("cert-findings")}
                >
                  <span className="subsection-number">1.4</span>
                  <span className="subsection-arrow">
                    {openSubSections["cert-findings"] ? "▼" : "▶"}
                  </span>
                  <span className="subsection-title">Rilievi dell'Ente Certificatore</span>
                </button>
                {openSubSections["cert-findings"] && (
                  <div className="subsection-content">
                    <CertificationFindingsSection
                      companyId={currentAudit?.metadata?.companyId}
                      standardId={currentAudit?.metadata?.selectedStandards?.includes("ISO_14001") ? 2
                        : currentAudit?.metadata?.selectedStandards?.includes("ISO_45001") ? 3 : 1}
                    />
                  </div>
                )}
              </div>
              <button className="accordion-collapse-btn" onClick={() => toggleSection("general-data")}>▲ Chiudi sezione 1</button>
            </div>
          )}
        </div>

        {/* ==================== SEZIONE 2: CHECKLIST ==================== */}
        <div id="sgq-section-checklist" className="accordion-section">
          <button
            className={`accordion-header ${
              openSections["checklist"] ? "open" : ""
            }`}
            onClick={() => toggleSection("checklist")}
          >
            <span className="section-icon">✅</span>
            <span className="section-arrow">
              {openSections["checklist"] ? "▼" : "▶"}
            </span>
            <span className="section-title">Checklist</span>
          </button>

          {openSections["checklist"] && (
            <div className="accordion-content">
              {/* Sezioni checklist generate dinamicamente da STANDARDS_REGISTRY (ADR-009 Fase 1) */}
              {/* Checklist personalizzata (Phase 6) */}
              {(currentAudit?.metadata?.customChecklistId || currentAudit?.custom_checklist_id) && (
                <div id="sgq-subsection-custom-checklist" className="accordion-subsection standard-section custom-checklist-section">
                  <button
                    className={`accordion-subheader standard-header ${
                      openSubSections["custom-checklist"] ? "open" : ""
                    }`}
                    onClick={() => toggleSubSection("custom-checklist")}
                  >
                    <span className="standard-icon">📋</span>
                    <span className="subsection-arrow">
                      {openSubSections["custom-checklist"] ? "\u25BC" : "\u25B6"}
                    </span>
                    <span className="subsection-title">Checklist personalizzata</span>
                  </button>
                  {openSubSections["custom-checklist"] && (
                    <div className="subsection-content">
                      <CustomChecklistAuditView audit={currentAudit} readOnly={isReadOnly} />
                    </div>
                  )}
                </div>
              )}

              {STANDARDS_LIST.map(({ key, codes, label, icon, subsId }) => {
                const isSelected = selectedStandards.some((s) => codes.includes(s));
                if (!isSelected) return null;
                return (
                  <div key={key} className={`accordion-subsection standard-section standard-${key.toLowerCase().replace(/_/g, '-')}`}>
                    <button
                      className={`accordion-subheader standard-header ${
                        openSubSections[subsId] ? "open" : ""
                      }`}
                      onClick={() => toggleSubSection(subsId)}
                    >
                      <span className="standard-icon">{icon}</span>
                      <span className="subsection-arrow">
                        {openSubSections[subsId] ? "\u25BC" : "\u25B6"}
                      </span>
                      <span className="subsection-title">{label}</span>
                    </button>
                    {openSubSections[subsId] && (
                      <div className="subsection-content">
                        <ChecklistModule defaultNorm={key} readOnly={isReadOnly} forceExpandTrigger={checklistExpandTrigger} />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Messaggio se nessuno standard né checklist custom selezionato */}
              {selectedStandards.length === 0 &&
                !(currentAudit?.metadata?.customChecklistId ?? currentAudit?.custom_checklist_id) && (
                <div className="no-standards-message">
                  <p>⚠️ Nessuno standard selezionato</p>
                  <p className="hint">
                    Vai su <strong>Dati Generali → 1.1 Dati Generali</strong>{" "}
                    per selezionare gli standard da auditare, oppure crea un audit con checklist personalizzata.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ==================== REGISTRO NC (NonConformitiesManager) ==================== */}
        <div className="accordion-section">
          <button
            className={`accordion-header ${openSections["nc-register"] ? "open" : ""}`}
            onClick={() => toggleSection("nc-register")}
          >
            <span className="section-icon">📋</span>
            <span className="section-arrow">
              {openSections["nc-register"] ? "▼" : "▶"}
            </span>
            <span className="section-title">Registro Non Conformità</span>
          </button>

          {openSections["nc-register"] && (
            <div className="accordion-content">
              <NonConformitiesManager readOnly={isReadOnly} />
              <button className="accordion-collapse-btn" onClick={() => toggleSection("nc-register")}>▲ Chiudi sezione</button>
            </div>
          )}
        </div>

        {/* ==================== SEZIONE 11: ESITO DELL'AUDIT (metriche NC/OSS/OM) ==================== */}
        <div className="accordion-section">
          <button
            className={`accordion-header ${
              openSections["outcome"] ? "open" : ""
            }`}
            onClick={() => toggleSection("outcome")}
          >
            <span className="section-icon">📊</span>
            <span className="section-arrow">
              {openSections["outcome"] ? "▼" : "▶"}
            </span>
            <span className="section-title">11 – ESITO DELL'AUDIT</span>
          </button>

          {openSections["outcome"] && (
            <div className="accordion-content">
              <AuditOutcomeSection
                auditOutcome={currentAudit.metadata.auditOutcome}
                onUpdate={handleAuditOutcomeUpdate}
                showConclusions={false}
                readOnly={isReadOnly}
                selectedStandards={selectedStandards}
              />
              <button className="accordion-collapse-btn" onClick={() => toggleSection("outcome")}>▲ Chiudi sezione 11</button>
            </div>
          )}
        </div>

        {/* ==================== SEZIONE 12: CONCLUSIONI ==================== */}
        <div id="sgq-section-conclusions" className="accordion-section">
          <button
            className={`accordion-header ${
              openSections["conclusions"] ? "open" : ""
            }`}
            onClick={() => toggleSection("conclusions")}
          >
            <span className="section-icon">📝</span>
            <span className="section-arrow">
              {openSections["conclusions"] ? "▼" : "▶"}
            </span>
            <span className="section-title">12 – CONCLUSIONI</span>
          </button>

          {openSections["conclusions"] && (
            <div className="accordion-content">
              <AuditOutcomeSection
                auditOutcome={currentAudit.metadata.auditOutcome}
                onUpdate={handleAuditOutcomeUpdate}
                showConclusions={true}
                readOnly={isReadOnly}
              />
              <button className="accordion-collapse-btn" onClick={() => toggleSection("conclusions")}>▲ Chiudi sezione 12</button>
            </div>
          )}
        </div>

        {/* ==================== CHIUSURA AUDIT ==================== */}
        <div className="accordion-section">
          <button
            className={`accordion-header ${openSections["close"] ? "open" : ""}`}
            onClick={() => toggleSection("close")}
          >
            <span className="section-icon">🔒</span>
            <span className="section-arrow">
              {openSections["close"] ? "▼" : "▶"}
            </span>
            <span className="section-title">Chiusura Audit</span>
          </button>

          {openSections["close"] && (
            <div className="accordion-content">
              <AuditClosePanel
                currentAudit={currentAudit}
                onNavigateTo={navigateTo}
                onCompleted={() => {
                  setOpenSections((prev) => ({ ...prev, close: false }));
                }}
              />
            </div>
          )}
        </div>

        {/* ==================== EXPORT REPORT ==================== */}
        <div className="accordion-section">
          <button
            className={`accordion-header ${
              openSections["export"] ? "open" : ""
            }`}
            onClick={() => toggleSection("export")}
          >
            <span className="section-icon">📤</span>
            <span className="section-arrow">
              {openSections["export"] ? "▼" : "▶"}
            </span>
            <span className="section-title">Export Report</span>
          </button>

          {openSections["export"] && (
            <div className="accordion-content">
              <ExportPanel />
              <button className="accordion-collapse-btn" onClick={() => toggleSection("export")}>▲ Chiudi sezione</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuditAccordionLayout;
