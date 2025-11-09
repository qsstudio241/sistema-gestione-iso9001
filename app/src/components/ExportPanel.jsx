import React, { useState } from "react";
import { useStorage } from "../contexts/StorageContext";
import {
  downloadAuditJSON,
  downloadAllAuditsJSON,
  downloadAuditSummaryJSON,
  downloadAuditSummaryCSV,
} from "../utils/exportManager";
import {
  exportAuditToWord,
  exportAuditToFileSystem,
} from "../utils/wordExport";
import "./ExportPanel.css";

const ExportPanel = () => {
  const { currentAudit, audits } = useStorage();
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  console.log(
    "ExportPanel - currentAudit:",
    currentAudit ? "presente" : "null"
  );

  const showMessage = (message, type = "success") => {
    setExportMessage({ text: message, type });
    setTimeout(() => setExportMessage(null), 5000);
  };

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

  const handleExportWord = async () => {
    if (!currentAudit) return;

    try {
      setIsExporting(true);
      const fileName = await exportAuditToWord(currentAudit);
      showMessage(`✅ Report Word generato: ${fileName}`, "success");
    } catch (error) {
      console.error("Errore export Word:", error);
      showMessage(`❌ Errore: ${error.message}`, "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportToFileSystem = async () => {
    if (!currentAudit) return;

    try {
      setIsExporting(true);
      const result = await exportAuditToFileSystem(currentAudit);
      showMessage(`✅ File salvato in: ${result.path}`, "success");
    } catch (error) {
      console.error("Errore salvataggio file system:", error);
      if (error.message.includes("annullato")) {
        showMessage("ℹ️ Salvataggio annullato", "info");
      } else {
        showMessage(`❌ Errore: ${error.message}`, "error");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = () => {
    downloadAllAuditsJSON(audits);
  };

  return (
    <div className="export-panel">
      <div className="export-header">
        <h3>📤 Export Dati</h3>
        <p>Esporta audit corrente o backup completo del database</p>
      </div>

      {/* Export Message Notification */}
      {exportMessage && (
        <div className={`export-notification ${exportMessage.type}`}>
          {exportMessage.text}
        </div>
      )}

      <div className="export-sections">
        {/* Export Audit Corrente - WORD */}
        <div className="export-section export-word-section">
          <h4>📄 Report Word (ISO 9001)</h4>
          {!currentAudit ? (
            <p className="export-info">
              Seleziona un audit per abilitare export
            </p>
          ) : (
            <>
              <p className="export-info">
                Genera report professionale per{" "}
                <strong>{currentAudit.metadata.auditNumber}</strong> -{" "}
                {currentAudit.metadata.clientName}
              </p>
              <div className="export-buttons">
                <button
                  onClick={handleExportWord}
                  disabled={isExporting}
                  className="btn btn-word"
                  title="Scarica report Word (browser download)"
                >
                  {isExporting ? "⏳ Generazione..." : "📄 Genera Report Word"}
                </button>
                <button
                  onClick={handleExportToFileSystem}
                  disabled={isExporting}
                  className="btn btn-filesystem"
                  title="Salva in cartella organizzata (File System Access API)"
                >
                  {isExporting
                    ? "⏳ Salvataggio..."
                    : "💾 Salva in File System"}
                </button>
              </div>
              <p className="export-hint">
                <strong>💡 Suggerimento:</strong> "File System" organizza
                automaticamente in{" "}
                <code>
                  /Audit/{"{"}anno{"}"}-{"{"}cliente{"}"}/
                </code>
              </p>
            </>
          )}
        </div>

        {/* Export JSON/CSV */}
        <div className="export-section">
          <h4>Formato Dati (JSON/CSV)</h4>
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
              <strong>Report Word:</strong> Documento professionale conforme ISO
              9001:2015 con intestazione, dati generali, checklist completa e
              rilievi emergenti
            </li>
            <li>
              <strong>File System:</strong> Organizzazione automatica in
              cartelle strutturate per anno e cliente (richiede permessi
              browser)
            </li>
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
