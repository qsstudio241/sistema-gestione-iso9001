/**
 * Workspace Manager Component
 *
 * Gestisce la connessione alla cartella locale per salvataggio audit
 * Mostra stato, permette selezione/modifica cartella, info struttura
 *
 * Adattato da ESRS PWA per ISO 9001
 */

import React, { useState, useEffect } from "react";
import { useStorage } from "../contexts/StorageContext";
import "./WorkspaceManager.css";

export default function WorkspaceManager({ audit, compact = false }) {
  const storage = useStorage();
  const [storageInfo, setStorageInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Aggiorna stato quando storage cambia
  useEffect(() => {
    const info = storage.fsProvider?.ready();
    setStorageInfo(info);
  }, [storage]);

  // Polling per aggiornare stato (caso permessi scaduti)
  useEffect(() => {
    const interval = setInterval(() => {
      const info = storage.fsProvider?.ready();
      setStorageInfo(info);
    }, 2000); // Controlla ogni 2 secondi

    return () => clearInterval(interval);
  }, [storage]);

  const updateStorageInfo = () => {
    const info = storage.fsProvider?.ready();
    setStorageInfo(info);
  };

  const deriveAuditYear = () => {
    if (!audit?.metadata?.projectYear) return new Date().getFullYear();
    return parseInt(audit.metadata.projectYear, 10) || new Date().getFullYear();
  };

  const getClientName = () => {
    if (!audit?.metadata?.clientName) return "Cliente";
    // Sanitizza nome per file system (rimuovi caratteri speciali)
    return audit.metadata.clientName.replace(/[<>:"/\\|?*]/g, "_");
  };

  const handleInitNewAudit = async () => {
    if (!audit) {
      alert("⚠️ Seleziona prima un audit");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await storage.fsProvider.initNewAudit(getClientName(), {
        year: deriveAuditYear(),
      });

      updateStorageInfo();

      alert(
        `✅ Struttura audit creata!\n\n` +
          `Cartella: ${result.structure}\n` +
          `Anno: ${result.year}`
      );
    } catch (err) {
      setError(err.message);
      console.error("❌ Errore inizializzazione nuovo audit:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeExistingAudit = async () => {
    if (!audit) {
      alert("⚠️ Seleziona prima un audit");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await storage.fsProvider.resumeExistingAudit(
        getClientName(),
        {
          year: deriveAuditYear(),
        }
      );

      updateStorageInfo();

      alert(
        `✅ Audit ripreso!\n\n` +
          `Cartella collegata: ${result.structure}\n` +
          `Modalità: ${result.isNewAudit ? "NUOVO" : "RIPRESA"}`
      );
    } catch (err) {
      setError(err.message);
      console.error("❌ Errore ripresa audit esistente:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (
      window.confirm(
        "⚠️ Disconnettere la cartella di salvataggio?\n\nI file non verranno eliminati, ma dovrai ricollegarla per salvare nuovi allegati."
      )
    ) {
      storage.fsProvider?.resetState();
      updateStorageInfo();
    }
  };

  // Versione compatta per header
  if (compact) {
    return (
      <div
        className={`workspace-status ${
          storageInfo ? "connected" : "disconnected"
        }`}
      >
        <span className="status-label">
          {storageInfo ? (
            <>
              ✅ <strong>Cartella collegata</strong>
            </>
          ) : (
            <>
              ⚠️ <strong>Nessuna cartella selezionata</strong>
            </>
          )}
        </span>
        {!storageInfo && audit && (
          <button
            onClick={handleResumeExistingAudit}
            disabled={isLoading}
            className="btn-resume-compact"
          >
            {isLoading ? "⏳..." : "🔄 Riprendi Audit"}
          </button>
        )}
      </div>
    );
  }

  // Versione completa per settings panel
  return (
    <div className="workspace-manager">
      <h4 className="workspace-title">📁 Gestione Cartella Salvataggio</h4>

      {/* Status - Solo quando connessa */}
      {storageInfo && (
        <div className="status-box connected">
          <div className="status-header">✅ Cartella collegata</div>
          {storage.fsProvider?.rootPath && (
            <div className="status-detail">
              Percorso: {storage.fsProvider.rootPath}
            </div>
          )}
          {storage.fsProvider?.clientName && (
            <div className="status-detail">
              Cliente: {storage.fsProvider.clientName}
            </div>
          )}
          {storage.fsProvider?.auditYear && (
            <div className="status-detail">
              Anno audit: {storage.fsProvider.auditYear}
            </div>
          )}
          <div className="status-hint">
            I report e allegati verranno salvati automaticamente nella struttura
            creata
          </div>
        </div>
      )}

      {/* Errori */}
      {error && <div className="error-box">❌ {error}</div>}

      {/* Info Browser Support */}
      {!window.showDirectoryPicker && (
        <div className="info-box">
          ℹ️ Il tuo browser non supporta il salvataggio su filesystem locale.
          Usa Chrome o Edge versione recente.
        </div>
      )}

      {/* Azioni - Solo se audit selezionato e browser supporta */}
      {audit && window.showDirectoryPicker && (
        <div className="actions-container">
          {!storageInfo ? (
            <>
              <button
                onClick={handleInitNewAudit}
                disabled={isLoading}
                className="btn-action btn-new"
              >
                {isLoading
                  ? "⏳ Attendere..."
                  : "🆕 Crea Nuova Struttura Audit"}
              </button>
              <button
                onClick={handleResumeExistingAudit}
                disabled={isLoading}
                className="btn-action btn-resume"
              >
                {isLoading ? "⏳ Attendere..." : "🔄 Riprendi Audit Esistente"}
              </button>
              <div className="action-hint">
                <strong>Nuovo:</strong> Crea cartella "{getClientName()}" nel
                percorso che scegli
                <br />
                <strong>Riprendi:</strong> Seleziona la cartella esistente "
                {getClientName()}"
              </div>
            </>
          ) : (
            <>
              <button
                onClick={handleDisconnect}
                className="btn-action btn-disconnect"
              >
                📌 Disconnetti Cartella
              </button>
              <button
                onClick={handleResumeExistingAudit}
                disabled={isLoading}
                className="btn-action btn-reconnect"
              >
                🔄 Ricollega/Cambia Cartella
              </button>
            </>
          )}
        </div>
      )}

      {/* Info struttura */}
      {storageInfo && (
        <details className="structure-details">
          <summary>ℹ️ Struttura Cartelle</summary>
          <pre className="structure-tree">
            {`${getClientName()}/
├── ${deriveAuditYear()}_Audit_ISO9001/
    ├── Report/
    │   └── Report_Audit_${audit?.metadata?.auditNumber || "XXX"}.docx
    ├── Allegati/
    │   ├── Foto/
    │   ├── Documenti/
    │   └── Verbali/
    └── Export/
        └── checkpoint_YYYYMMDD.json`}
          </pre>
        </details>
      )}
    </div>
  );
}
