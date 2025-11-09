import React, { useState } from "react";
import AuditSelector from "./AuditSelector";
import ChecklistModule from "./ChecklistModule";
import NonConformitiesManager from "./NonConformitiesManager";
import MetricsDashboard from "./MetricsDashboard";
import ReportBuilder from "./ReportBuilder";
import EvidenceManager from "./EvidenceManager";
import PendingIssuesCascade from "./PendingIssuesCascade";
import ExportPanel from "./ExportPanel";
import StorageTestComponent from "./StorageTestComponent";
import AuditTabsLayout from "./AuditTabsLayout";
import AuditAccordionLayout from "./AuditAccordionLayout";
import WorkspaceManager from "./WorkspaceManager";
import { useStorage } from "../contexts/StorageContext";
import "./Dashboard.css";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("accordion");
  const { currentAudit, updateCurrentAudit } = useStorage();

  const handleMetadataUpdate = (field, value) => {
    updateCurrentAudit((audit) => ({
      ...audit,
      metadata: {
        ...audit.metadata,
        [field]: value,
        lastModified: new Date().toISOString(),
      },
    }));
  };

  const handleClearStorage = () => {
    if (
      window.confirm(
        "⚠️ ATTENZIONE: Cancellare tutti i dati salvati in localStorage?\n\nQuesto eliminerà tutti gli audit e le modifiche non salvate su file.\n\nProcedere?"
      )
    ) {
      localStorage.clear();
      alert(
        "✅ localStorage cancellato! Ricarica la pagina (F5) per ricaricare i mock data."
      );
      window.location.reload();
    }
  };

  return (
    <div className="dashboard">
      {/* Navigation Tabs */}
      <div className="tabs">
        <button
          className={activeTab === "accordion" ? "tab active" : "tab"}
          onClick={() => setActiveTab("accordion")}
        >
          📱 Accordion Mobile-First
        </button>
        <button
          className={activeTab === "tabs" ? "tab active" : "tab"}
          onClick={() => setActiveTab("tabs")}
        >
          💻 Tabs Desktop (Old)
        </button>
        <button
          className={activeTab === "audit" ? "tab active" : "tab"}
          onClick={() => setActiveTab("audit")}
        >
          🔍 Gestione Audit (Legacy)
        </button>
        <button
          className={activeTab === "settings" ? "tab active" : "tab"}
          onClick={() => setActiveTab("settings")}
        >
          ⚙️ Impostazioni
        </button>
        <button
          className={activeTab === "test" ? "tab active" : "tab"}
          onClick={() => setActiveTab("test")}
        >
          🧪 Test Storage
        </button>
      </div>

      {/* Content Area */}
      <div className="dashboard-content">
        {activeTab === "accordion" && (
          <>
            <AuditSelector />
            <AuditAccordionLayout
              currentAudit={currentAudit}
              onUpdate={handleMetadataUpdate}
            />
          </>
        )}

        {activeTab === "tabs" && (
          <>
            <AuditSelector />
            <AuditTabsLayout
              currentAudit={currentAudit}
              onUpdate={handleMetadataUpdate}
            />
          </>
        )}

        {activeTab === "audit" && (
          <div className="audit-management">
            <h2>Gestione Audit Interni</h2>
            <p className="section-description">
              Sistema di gestione audit conforme a UNI EN ISO 9001:2015 (punto
              9.2), ISO 14001:2015 e ISO 45001:2018
            </p>
            <AuditSelector />

            <ChecklistModule />

            <NonConformitiesManager />

            <MetricsDashboard />

            <ReportBuilder />

            <EvidenceManager />

            <PendingIssuesCascade />

            <ExportPanel />
          </div>
        )}

        {activeTab === "test" && (
          <div>
            <div
              style={{
                marginBottom: "24px",
                padding: "20px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: "12px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                color: "white",
              }}
            >
              <h3 style={{ margin: "0 0 16px 0", fontSize: "1.5rem" }}>
                🛠️ Strumenti di Debug
              </h3>
              <p style={{ margin: "0 0 16px 0", opacity: 0.95 }}>
                Utilizza questo pulsante per cancellare tutti i dati salvati in
                localStorage e ricaricare i mock data iniziali.
              </p>
              <button
                onClick={handleClearStorage}
                style={{
                  padding: "12px 24px",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  background: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
                onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
                onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
              >
                🗑️ Clear localStorage & Reload
              </button>
            </div>
            <StorageTestComponent />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="settings-panel">
            <h2>⚙️ Impostazioni Sistema</h2>
            <p className="section-description">
              Gestione cartella workspace e configurazioni avanzate
            </p>

            {/* Workspace Manager - Full mode */}
            <section style={{ marginTop: "24px" }}>
              <h3>📁 Gestione Cartella Workspace</h3>
              <WorkspaceManager compact={false} audit={currentAudit} />
            </section>

            {/* Debug Tools */}
            <section style={{ marginTop: "32px" }}>
              <h3>🛠️ Strumenti di Debug</h3>
              <button
                onClick={handleClearStorage}
                style={{
                  padding: "12px 24px",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  background: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
                onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
                onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
              >
                🗑️ Clear localStorage & Reload
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
