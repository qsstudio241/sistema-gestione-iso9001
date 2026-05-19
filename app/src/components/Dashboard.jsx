import React from "react";
import AuditSelector from "./AuditSelector";
import AuditAccordionLayout from "./AuditAccordionLayout";
import { useStorage } from "../contexts/StorageContext";
import "./Dashboard.css";

/**
 * Dashboard - UI semplificata (solo Accordion Layout)
 * Tab legacy e debug rimossi per evitare confusione
 */
const Dashboard = () => {
  const { currentAudit, updateCurrentAudit, deselectAudit, isSaving, allSaved } = useStorage();

  const handleMetadataUpdate = (field, value) => {
    updateCurrentAudit((audit) => {
      const metadata = {
        ...audit.metadata,
        [field]: value,
        lastModified: new Date().toISOString(),
      };
      if (field === "generalData" && value && typeof value === "object") {
        if (value.auditDate !== undefined) metadata.auditDate = value.auditDate;
        if (value.auditDateEnd !== undefined) {
          metadata.auditDateEnd = value.auditDateEnd || null;
        }
      }
      return { ...audit, metadata };
    });
  };

  return (
    <div className="dashboard">
      <AuditSelector />
      <AuditAccordionLayout
        currentAudit={currentAudit}
        onUpdate={handleMetadataUpdate}
        onBack={deselectAudit}
        isSaving={isSaving}
        allSaved={allSaved}
      />
    </div>
  );
};

export default Dashboard;
