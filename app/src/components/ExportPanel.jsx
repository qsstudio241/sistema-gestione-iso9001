import React from "react";
import { useStorage } from "../contexts/StorageContext";
import {
  downloadAuditJSON,
  downloadAllAuditsJSON,
  downloadAuditSummaryJSON,
  downloadAuditSummaryCSV,
} from "../utils/exportManager";
import "./ExportPanel.css";

const ExportPanel = () => {
  const { currentAudit, audits } = useStorage();

  const handleExportCurrent = (format) => {
    if (!currentAudit) return;

    switch (format) {
      case "json-full":
        downloadAuditJSON(currentAudit);
        break;
      case "json-summary":
        downloadAuditSummaryJSON(currentAudit);
        break;
      case "csv":
        downloadAuditSummaryCSV(currentAudit);
        break;
      default:
        break;
    }
  };

  const handleExportAll = () => {
    downloadAllAuditsJSON(audits);
  };

  return (
    <div className="export-panel">
      <div className="export-header">
        <h3>� Export Dati</h3>
        <p>Esporta audit corrente o backup completo del database</p>
      </div>

      <div className="export-sections">
        {/* Export Audit Corrente */}
        <div className="export-section">
          <h4>Audit Corrente</h4>
          {!currentAudit ? (
            <p className="export-info">
              Seleziona un audit per abilitare export
            </p>
          ) : (
            <>
              <p className="export-info">
                Esporta <strong>{currentAudit.metadata.auditNumber}</strong> -{" "}
                {currentAudit.metadata.clientName}
              </p>
              <div className="export-buttons">
                <button
                  onClick={() => handleExportCurrent("json-full")}
                  className="btn btn-primary"
                >
                  � JSON Completo
                </button>
                <button
                  onClick={() => handleExportCurrent("json-summary")}
                  className="btn btn-secondary"
                >
                  � JSON Summary
                </button>
                <button
                  onClick={() => handleExportCurrent("csv")}
                  className="btn btn-success"
                >
                  � CSV Summary
                </button>
              </div>
            </>
          )}
        </div>

        {/* Export Tutti */}
        <div className="export-section">
          <h4>Backup Completo</h4>
          <p className="export-info">
            Esporta tutti gli audit ({audits.length} totali) in un unico file
            JSON
          </p>
          <div className="export-buttons">
            <button
              onClick={handleExportAll}
              disabled={audits.length === 0}
              className="btn btn-warning"
            >
              💾 Backup Tutti gli Audit
            </button>
          </div>
        </div>

        {/* Info Export */}
        <div className="export-info-section">
          <h4>ℹ️ Formati Export</h4>
          <ul>
            <li>
              <strong>JSON Completo:</strong> Include tutti i dati audit
              (checklist, NC, evidenze, report)
            </li>
            <li>
              <strong>JSON Summary:</strong> Contiene solo metriche, NC summary
              e informazioni base
            </li>
            <li>
              <strong>CSV Summary:</strong> Formato tabellare per
              Excel/LibreOffice con metriche e NC
            </li>
            <li>
              <strong>Backup Completo:</strong> Tutti gli audit in formato JSON
              per ripristino completo
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;
