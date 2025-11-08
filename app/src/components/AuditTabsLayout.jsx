/**
 * AuditTabsLayout - Sistema di navigazione a tabs per l'audit
 * Struttura conforme al template Word Check-List Report Audit
 */

import { useState } from "react";
import "./AuditTabsLayout.css";

// Import sezioni
import GeneralDataSection from "./GeneralDataSection";
import AuditObjectiveSection from "./AuditObjectiveSection";
// import PendingIssuesSection from './PendingIssuesSection';
// import ChecklistSection from './ChecklistSection';
// import AuditOutcomeSection from './AuditOutcomeSection';

const AUDIT_TABS = [
  { id: "general-data", label: "1 – Dati Generali", icon: "📋" },
  { id: "objective", label: "2 – Obiettivo", icon: "🎯" },
  { id: "pending-issues", label: "3 – Rilievi Pendenti", icon: "⏳" },
  { id: "clause-4", label: "4 – Contesto", icon: "🏢" },
  { id: "clause-5", label: "5 – Leadership", icon: "👔" },
  { id: "clause-6", label: "6 – Pianificazione", icon: "📊" },
  { id: "clause-7", label: "7 – Supporto", icon: "🛠️" },
  { id: "clause-8", label: "8 – Attività Operative", icon: "⚙️" },
  { id: "clause-9", label: "9 – Valutazione", icon: "📈" },
  { id: "clause-10", label: "10 – Miglioramento", icon: "🚀" },
  { id: "outcome", label: "11 – Esito", icon: "✅" },
];

function AuditTabsLayout({ currentAudit, onUpdate }) {
  const [activeTab, setActiveTab] = useState("general-data");

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  const handleGeneralDataUpdate = (updatedData) => {
    onUpdate("generalData", updatedData);
  };

  const handleAuditObjectiveUpdate = (updatedData) => {
    onUpdate("auditObjective", updatedData);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "general-data":
        return (
          <GeneralDataSection
            generalData={currentAudit.metadata.generalData}
            onUpdate={handleGeneralDataUpdate}
          />
        );

      case "objective":
        return (
          <AuditObjectiveSection
            auditObjective={currentAudit.metadata.auditObjective}
            onUpdate={handleAuditObjectiveUpdate}
          />
        );

      case "pending-issues":
        return (
          <div className="tab-content-placeholder">
            <h2>⏳ Rilievi Pendenti</h2>
            <p>Integrazione componente PendingIssuesCascade esistente</p>
          </div>
        );

      case "clause-4":
      case "clause-5":
      case "clause-6":
      case "clause-7":
      case "clause-8":
      case "clause-9":
      case "clause-10":
        return (
          <div className="tab-content-placeholder">
            <h2>Clausola ISO {activeTab.split("-")[1]}</h2>
            <p>Integrazione componente ChecklistModule esistente</p>
          </div>
        );

      case "outcome":
        return (
          <div className="tab-content-placeholder">
            <h2>✅ Esito dell'Audit</h2>
            <p>Sezione in sviluppo - Conclusioni e rilievi emersi</p>
            <pre>
              {JSON.stringify(currentAudit.metadata.auditOutcome, null, 2)}
            </pre>
          </div>
        );

      default:
        return <div>Seleziona un tab</div>;
    }
  };

  return (
    <div className="audit-tabs-layout">
      {/* Header con info audit */}
      <div className="audit-header">
        <div className="audit-title">
          <h1>{currentAudit.metadata.clientName}</h1>
          <span className="audit-number">
            Audit N. {currentAudit.metadata.auditNumber}
          </span>
        </div>
        <div className="audit-meta">
          <span className="audit-status">{currentAudit.metadata.status}</span>
          <span className="audit-date">
            {new Date(currentAudit.metadata.lastModified).toLocaleDateString(
              "it-IT"
            )}
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <nav className="tabs-nav">
        <div className="tabs-container">
          {AUDIT_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Tab Content */}
      <div className="tab-content">{renderTabContent()}</div>
    </div>
  );
}

export default AuditTabsLayout;
