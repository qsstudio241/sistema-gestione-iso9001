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
  exportAuditToWorkspace,
} from "../utils/wordExport";
import "./ExportPanel.css";

const ExportPanel = () => {
  const { currentAudit, audits, fsProvider } = useStorage();
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  // Development mode - mostra formati avanzati JSON/CSV
  const isDev = process.env.NODE_ENV === "development";

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

    // Se fsProvider è pronto, usa exportAuditToWorkspace (struttura ISO 9001)
    if (fsProvider?.ready()) {
      try {
        setIsExporting(true);
        const result = await exportAuditToWorkspace(currentAudit, fsProvider);
        showMessage(
          `✅ Report salvato in workspace: ${result.fileName}`,
          "success"
        );
      } catch (error) {
        console.error("Errore salvataggio workspace:", error);
        showMessage(`❌ Errore: ${error.message}`, "error");
      } finally {
        setIsExporting(false);
      }
      return;
    }

    // Fallback: chiedi all'utente di selezionare cartella (vecchio comportamento)
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
      {/* Rimosso export-header duplicato - titolo già nell'accordion */}

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
                  title={
                    fsProvider?.ready()
                      ? "Salva in workspace collegato (Report/)"
                      : "Salva in cartella organizzata (File System Access API)"
                  }
                >
                  {isExporting
                    ? "⏳ Salvataggio..."
                    : fsProvider?.ready()
                    ? "✅ Salva in Workspace"
                    : "💾 Salva in File System"}
                </button>
              </div>
              <p className="export-hint">
                {fsProvider?.ready() ? (
                  <span>
                    <strong>✅ Workspace collegato:</strong> Report salvato in{" "}
                    <code>Report/{currentAudit.metadata.clientName}/</code>
                  </span>
                ) : (
                  <span>
                    <strong>💡 Suggerimento:</strong> Collega workspace in
                    Impostazioni per salvataggio automatico
                  </span>
                )}
              </p>
            </>
          )}
        </div>

        {/* Export JSON/CSV - Solo Development Mode */}
        {isDev && (
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
                    📊 JSON Completo
                  </button>
                  <button
                    onClick={() => handleExportCurrent("json-summary")}
                    className="btn btn-secondary"
                  >
                    📋 JSON Summary
                  </button>
                  <button
                    onClick={() => handleExportCurrent("csv")}
                    className="btn btn-success"
                  >
                    📈 CSV Summary
                  </button>
                </div>
              </>
            )}
          </div>
        )}

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
              <strong>Salva in Workspace:</strong> Organizzazione automatica in
              cartelle strutturate per anno e cliente nella cartella workspace
              collegata
            </li>
            <li>
              <strong>Backup Completo:</strong> Tutti gli audit in formato JSON
              per ripristino completo del sistema
            </li>
            {isDev && (
              <>
                <li>
                  <strong>JSON Completo:</strong> Include tutti i dati audit
                  (checklist, NC, evidenze, report)
                </li>
                <li>
                  <strong>JSON Summary:</strong> Contiene solo metriche, NC
                  summary e informazioni base
                </li>
                <li>
                  <strong>CSV Summary:</strong> Formato tabellare per
                  Excel/LibreOffice con metriche e NC
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;
