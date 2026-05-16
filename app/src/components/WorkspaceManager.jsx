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
  const [storageStats, setStorageStats] = useState(null);

  const isMobile = storage.deviceInfo?.isMobile;
  const storageType = storage.deviceInfo?.recommendedStorage;

  // Aggiorna stato quando fsProvider cambia (stabile dopo init, non su ogni re-render context)
  useEffect(() => {
    const info = storage.fsProvider?.ready();
    setStorageInfo(info);

    // Se IndexedDB, carica statistiche una volta al mount
    if (storageType === "indexeddb" && storage.fsProvider?.getStorageStats) {
      storage.fsProvider.getStorageStats().then(setStorageStats);
    }
  }, [storage.fsProvider, storageType]);

  // Polling per aggiornare stato (solo LocalFS: verifica permessi scaduti)
  // IndexedDB non ha permessi da verificare → intervallo lungo (30s)
  useEffect(() => {
    const pollInterval = storageType === "indexeddb" ? 30000 : 2000;
    const interval = setInterval(() => {
      const info = storage.fsProvider?.ready();
      setStorageInfo(info);

      // Statistiche IndexedDB: aggiorna ogni 30s (non ogni 2s)
      if (storageType === "indexeddb" && storage.fsProvider?.getStorageStats) {
        storage.fsProvider.getStorageStats().then(setStorageStats);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [storage.fsProvider, storageType]);

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
    // Mobile: Mostra info IndexedDB invece di connessione File System
    if (isMobile) {
      return (
        <div className="workspace-status mobile">
          <span className="status-label">
            📱 <strong>Storage Locale</strong>
            {storageStats && (
              <span className="stats-mini">
                {" "}
                ({storageStats.auditsCount} audit,{" "}
                {storageStats.totalSizeMB.toFixed(1)} MB)
              </span>
            )}
          </span>
        </div>
      );
    }

    // Desktop: UI normale con File System
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
      <h4 className="workspace-title">
        {isMobile
          ? "\uD83D\uDCF1 Storage Dispositivo Mobile"
          : "\uD83D\uDCC1 Gestione Cartella Salvataggio"}
      </h4>

      {/* Mobile: Info e guida */}
      {isMobile && (
        <>
          <div className="info-box mobile-info">
            <div className="info-header">📱 Modalità Mobile Attiva</div>
            <p>
              I dati degli audit sono salvati{" "}
              <strong>localmente nel browser</strong> di questo dispositivo.
            </p>
            <p className="info-highlight">
              💡 <strong>Importante:</strong> Effettua regolarmente il{" "}
              <strong>Backup Completo</strong>
              (vedi pannello "Export Report") per salvare i tuoi dati in modo
              permanente.
            </p>
          </div>

          {storageStats && (
            <div className="status-box mobile-stats">
              <div className="status-header">📊 Statistiche Storage</div>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Audit salvati:</span>
                  <span className="stat-value">{storageStats.auditsCount}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Allegati:</span>
                  <span className="stat-value">
                    {storageStats.attachmentsCount}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Spazio usato:</span>
                  <span className="stat-value">
                    {storageStats.totalSizeMB.toFixed(2)} MB
                  </span>
                </div>
                {storageStats.lastUpdate && (
                  <div className="stat-item">
                    <span className="stat-label">Ultimo salvataggio:</span>
                    <span className="stat-value">
                      {new Date(storageStats.lastUpdate).toLocaleString(
                        "it-IT"
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="info-box mobile-backup-reminder">
            <strong>🔐 Backup Periodico Consigliato</strong>
            <p>
              Su dispositivi mobili i dati sono legati a questo browser. Se
              cancelli la cache o disinstalli l'app, i dati verranno persi.
            </p>
            <p>
              Vai a <strong>Export Report</strong> →{" "}
              <strong>Backup Completo</strong>
              per salvare tutti gli audit in formato JSON.
            </p>
          </div>
        </>
      )}

      {/* Desktop: Status connessione - Solo quando connessa */}
      {!isMobile && storageInfo && (
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

      {/* Info Browser Support - Solo desktop senza File System API */}
      {!isMobile && !window.showDirectoryPicker && (
        <div className="info-box">
          ℹ️ Il tuo browser non supporta il salvataggio su filesystem locale.
          Usa Chrome o Edge versione recente.
        </div>
      )}

      {/* Azioni - Solo desktop con audit selezionato e browser supporta */}
      {!isMobile && audit && window.showDirectoryPicker && (
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

      {/* Info struttura - Solo desktop */}
      {!isMobile && storageInfo && (
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
