/**
 * AuditAccordionLayout - Mobile-First Accordion Navigation
 * Struttura ad albero verticale conforme al template Word
 */

import { useState } from "react";
import "./AuditAccordionLayout.css";

// Import sezioni
import GeneralDataSection from "./GeneralDataSection";
import AuditObjectiveSection from "./AuditObjectiveSection";
import PendingIssuesCascade from "./PendingIssuesCascade";
import ChecklistModule from "./ChecklistModule";
// import AuditOutcomeSection from './AuditOutcomeSection';

function AuditAccordionLayout({ currentAudit, onUpdate }) {
  // Stato per gestire quali sezioni sono aperte
  const [openSections, setOpenSections] = useState({
    "general-data": true, // Aperta di default
    checklist: false,
    outcome: false,
  });

  // Stato per gestire quali sotto-sezioni sono aperte
  const [openSubSections, setOpenSubSections] = useState({
    "general-data-form": true,
    objective: false,
    "pending-issues": false,
    "iso-9001": false,
    "iso-14001": false,
    "iso-45001": false,
  });

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

  const handleGeneralDataUpdate = (updatedData) => {
    onUpdate("generalData", updatedData);
  };

  const handleAuditObjectiveUpdate = (updatedData) => {
    onUpdate("auditObjective", updatedData);
  };

  const handleStandardsUpdate = (updatedStandards) => {
    onUpdate("selectedStandards", updatedStandards);
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

  return (
    <div className="audit-accordion-layout">
      {/* Header con info audit */}
      <div className="audit-header">
        <div className="audit-title">
          <h1>{currentAudit.metadata.clientName}</h1>
          <span className="audit-number">
            Audit N. {currentAudit.metadata.auditNumber}
          </span>
        </div>
        <div className="audit-meta">
          <span
            className={`audit-status status-${currentAudit.metadata.status.toLowerCase()}`}
          >
            {currentAudit.metadata.status}
          </span>
          <span className="audit-date">
            {new Date(currentAudit.metadata.lastModified).toLocaleDateString(
              "it-IT"
            )}
          </span>
        </div>
      </div>

      {/* Accordion Content */}
      <div className="accordion-container">
        {/* ==================== SEZIONE 1: DATI GENERALI ==================== */}
        <div className="accordion-section">
          <button
            className={`accordion-header ${
              openSections["general-data"] ? "open" : ""
            }`}
            onClick={() => toggleSection("general-data")}
          >
            <span className="section-icon">📋</span>
            <span className="section-title">Dati Generali</span>
            <span className="section-arrow">
              {openSections["general-data"] ? "▼" : "▶"}
            </span>
          </button>

          {openSections["general-data"] && (
            <div className="accordion-content">
              {/* Sub-Section: 1.1 Dati Generali */}
              <div className="accordion-subsection">
                <button
                  className={`accordion-subheader ${
                    openSubSections["general-data-form"] ? "open" : ""
                  }`}
                  onClick={() => toggleSubSection("general-data-form")}
                >
                  <span className="subsection-number">1.1</span>
                  <span className="subsection-title">Dati Generali</span>
                  <span className="subsection-arrow">
                    {openSubSections["general-data-form"] ? "▼" : "▶"}
                  </span>
                </button>

                {openSubSections["general-data-form"] && (
                  <div className="subsection-content">
                    <GeneralDataSection
                      generalData={currentAudit.metadata.generalData}
                      selectedStandards={selectedStandards}
                      onUpdate={handleGeneralDataUpdate}
                      onStandardsUpdate={handleStandardsUpdate}
                    />
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
                  <span className="subsection-title">Obiettivo dell'Audit</span>
                  <span className="subsection-arrow">
                    {openSubSections["objective"] ? "▼" : "▶"}
                  </span>
                </button>

                {openSubSections["objective"] && (
                  <div className="subsection-content">
                    <AuditObjectiveSection
                      auditObjective={currentAudit.metadata.auditObjective}
                      onUpdate={handleAuditObjectiveUpdate}
                    />
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
                  <span className="subsection-title">Rilievi Pendenti</span>
                  <span className="subsection-arrow">
                    {openSubSections["pending-issues"] ? "▼" : "▶"}
                  </span>
                </button>

                {openSubSections["pending-issues"] && (
                  <div className="subsection-content">
                    <PendingIssuesCascade />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ==================== SEZIONE 2: CHECKLIST ==================== */}
        <div className="accordion-section">
          <button
            className={`accordion-header ${
              openSections["checklist"] ? "open" : ""
            }`}
            onClick={() => toggleSection("checklist")}
          >
            <span className="section-icon">✅</span>
            <span className="section-title">Checklist</span>
            <span className="section-arrow">
              {openSections["checklist"] ? "▼" : "▶"}
            </span>
          </button>

          {openSections["checklist"] && (
            <div className="accordion-content">
              {/* ISO 9001 - Solo se selezionato */}
              {selectedStandards.includes("ISO_9001") && (
                <div className="accordion-subsection standard-section">
                  <button
                    className={`accordion-subheader standard-header ${
                      openSubSections["iso-9001"] ? "open" : ""
                    }`}
                    onClick={() => toggleSubSection("iso-9001")}
                  >
                    <span className="standard-icon">📋</span>
                    <span className="subsection-title">
                      ISO 9001:2015 - Qualità
                    </span>
                    <span className="subsection-arrow">
                      {openSubSections["iso-9001"] ? "▼" : "▶"}
                    </span>
                  </button>

                  {openSubSections["iso-9001"] && (
                    <div className="subsection-content">
                      <ChecklistModule />
                    </div>
                  )}
                </div>
              )}

              {/* ISO 14001 - Solo se selezionato */}
              {selectedStandards.includes("ISO_14001") && (
                <div className="accordion-subsection standard-section">
                  <button
                    className={`accordion-subheader standard-header ${
                      openSubSections["iso-14001"] ? "open" : ""
                    }`}
                    onClick={() => toggleSubSection("iso-14001")}
                  >
                    <span className="standard-icon">🌱</span>
                    <span className="subsection-title">
                      ISO 14001:2015 - Ambiente
                    </span>
                    <span className="subsection-arrow">
                      {openSubSections["iso-14001"] ? "▼" : "▶"}
                    </span>
                  </button>

                  {openSubSections["iso-14001"] && (
                    <div className="subsection-content">
                      <div className="checklist-placeholder">
                        <p>Checklist ISO 14001 - In sviluppo</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ISO 45001 - Solo se selezionato */}
              {selectedStandards.includes("ISO_45001") && (
                <div className="accordion-subsection standard-section">
                  <button
                    className={`accordion-subheader standard-header ${
                      openSubSections["iso-45001"] ? "open" : ""
                    }`}
                    onClick={() => toggleSubSection("iso-45001")}
                  >
                    <span className="standard-icon">🦺</span>
                    <span className="subsection-title">
                      ISO 45001:2018 - Sicurezza
                    </span>
                    <span className="subsection-arrow">
                      {openSubSections["iso-45001"] ? "▼" : "▶"}
                    </span>
                  </button>

                  {openSubSections["iso-45001"] && (
                    <div className="subsection-content">
                      <div className="checklist-placeholder">
                        <p>Checklist ISO 45001 - In sviluppo</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Messaggio se nessuno standard selezionato */}
              {selectedStandards.length === 0 && (
                <div className="no-standards-message">
                  <p>⚠️ Nessuno standard selezionato</p>
                  <p className="hint">
                    Vai su <strong>Dati Generali → 1.1 Dati Generali</strong>{" "}
                    per selezionare gli standard da auditare
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ==================== SEZIONE 3: ESITO AUDIT ==================== */}
        <div className="accordion-section">
          <button
            className={`accordion-header ${
              openSections["outcome"] ? "open" : ""
            }`}
            onClick={() => toggleSection("outcome")}
          >
            <span className="section-icon">📊</span>
            <span className="section-title">Esito Audit</span>
            <span className="section-arrow">
              {openSections["outcome"] ? "▼" : "▶"}
            </span>
          </button>

          {openSections["outcome"] && (
            <div className="accordion-content">
              <div className="outcome-placeholder">
                <h3>Esito dell'Audit</h3>
                <p>Componente AuditOutcomeSection in sviluppo</p>
                <pre>
                  {JSON.stringify(currentAudit.metadata.auditOutcome, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuditAccordionLayout;
