/**
 * Sync Status Indicator Component
 * Mostra stato sincronizzazione e conflict dialog
 */

import React, { useState } from "react";
import { useStorage } from "../contexts/StorageContext";

export function SyncStatusIndicator() {
  const { syncStatus, triggerManualSync, forceClearLocalCache, resolveConflict } = useStorage();
  const [isClearing, setIsClearing] = useState(false);

  const handleManualSync = async () => {
    const result = await triggerManualSync();
    if (result.success) {
      alert(`Sincronizzazione completata! Queue: ${result.queueSize} items`);
    } else {
      alert(`Errore sincronizzazione: ${result.error}`);
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm(
      'Questa operazione svuota la cache locale e riscarica i dati dal server.\n' +
      'Usa questa funzione se vedi audit cancellati o duplicati nel menu.\n\n' +
      'Continuare?'
    )) return;
    setIsClearing(true);
    const result = await forceClearLocalCache();
    setIsClearing(false);
    if (result.success) {
      alert('Cache locale ripulita. Il menu ora mostra solo i dati aggiornati dal server.');
    } else {
      alert(`Errore durante la pulizia: ${result.error}`);
    }
  };

  return (
    <div className="sync-status-indicator">
      {/* Indicator badge */}
      <div className="sync-badge">
        {syncStatus.isSyncing || isClearing ? (
          <span className="syncing">🔄 {isClearing ? 'Pulizia in corso...' : 'Sincronizzazione...'}</span>
        ) : syncStatus.queueSize > 0 ? (
          <span
            className="pending"
            title={`${syncStatus.queueSize} operazioni in coda`}
          >
            📤 {syncStatus.queueSize}
          </span>
        ) : (
          <span className="synced">✅ Sincronizzato</span>
        )}
      </div>

      {/* Last sync time */}
      {syncStatus.lastSync && (
        <small className="last-sync">
          Ultimo: {new Date(syncStatus.lastSync).toLocaleTimeString("it-IT")}
        </small>
      )}

      {/* Manual sync button */}
      <button
        onClick={handleManualSync}
        disabled={syncStatus.isSyncing || isClearing || !navigator.onLine}
        className="btn-sync-manual"
        title="Forza sincronizzazione manuale"
      >
        🔄 Sync
      </button>

      {/* Clear local cache button */}
      <button
        onClick={handleClearCache}
        disabled={syncStatus.isSyncing || isClearing || !navigator.onLine}
        className="btn-sync-manual"
        style={{ marginLeft: '4px', background: '#e74c3c' }}
        title="Svuota cache locale e riscarica dal server (usa se vedi audit cancellati o duplicati)"
      >
        🧹 Pulisci cache
      </button>

      {/* Conflict dialog */}
      {syncStatus.hasConflict && syncStatus.conflictData && (
        <div className="conflict-dialog-overlay">
          <div className="conflict-dialog">
            <h3>⚠️ Conflitto rilevato</h3>
            <p>
              L'audit <strong>{syncStatus.conflictData.auditNumber}</strong> è
              stato modificato sia localmente che sul server.
            </p>

            <div className="conflict-details">
              <div className="version">
                <h4>📱 Versione locale</h4>
                <p>
                  Modificato:{" "}
                  {new Date(
                    syncStatus.conflictData.localModified
                  ).toLocaleString("it-IT")}
                </p>
              </div>
              <div className="version">
                <h4>☁️ Versione server</h4>
                <p>
                  Modificato:{" "}
                  {new Date(
                    syncStatus.conflictData.serverModified
                  ).toLocaleString("it-IT")}
                </p>
              </div>
            </div>

            <div className="conflict-actions">
              <button
                onClick={() => resolveConflict("keep_local")}
                className="btn btn-primary"
              >
                Mantieni versione locale
              </button>
              <button
                onClick={() => resolveConflict("use_server")}
                className="btn btn-secondary"
              >
                Usa versione server
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SyncStatusIndicator;
