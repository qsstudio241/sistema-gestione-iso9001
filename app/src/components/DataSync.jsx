import React, { useState } from "react";
import { useData } from "../contexts/DataContext";
import {
  saveToExportFolder,
  restoreFromExportFolder,
  isFileSystemAccessSupported,
} from "../utils/fileSystemService";
import "./DataSync.css";

const DataSync = () => {
  const { getAllData, importData } = useData();
  const [message, setMessage] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const showMessage = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSaveToFileSystem = async () => {
    setSyncing(true);
    const data = getAllData();
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .split("T")[0];
    const filename = `sgq_master_${timestamp}.json`;

    const result = await saveToExportFolder(data, filename);
    showMessage(result.message, result.success ? "success" : "error");
    setSyncing(false);
  };

  const handleLoadFromFileSystem = async () => {
    setSyncing(true);
    const result = await restoreFromExportFolder();

    if (result.success) {
      importData(result.data);
      showMessage("✓ Dati caricati e sincronizzati con successo", "success");
    } else {
      showMessage(result.message, "error");
    }

    setSyncing(false);
  };

  const handleClearLocalStorage = () => {
    if (
      window.confirm(
        "⚠️ ATTENZIONE: Questa operazione cancellerà tutti i dati in localStorage (backup). I dati nel file system non saranno modificati.\n\nContinuare?"
      )
    ) {
      localStorage.clear();
      showMessage("✓ localStorage svuotato", "success");
    }
  };

  const getLocalStorageSize = () => {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return (total / 1024).toFixed(2); // KB
  };

  const apiSupported = isFileSystemAccessSupported();

  return (
    <div className="data-sync">
      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      {/* Architettura Dati */}
      <div className="card sync-card">
        <h3>🔄 Architettura Gestione Dati</h3>
        <div className="architecture-flow">
          <div className="flow-item">
            <div className="flow-icon">👤</div>
            <div className="flow-label">User Input</div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-item highlight">
            <div className="flow-icon">⚙️</div>
            <div className="flow-label">Context API</div>
            <small>(Stato applicazione)</small>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-item">
            <div className="flow-icon">💾</div>
            <div className="flow-label">localStorage</div>
            <small>(Backup)</small>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-item master">
            <div className="flow-icon">📁</div>
            <div className="flow-label">File System</div>
            <small>(Master)</small>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-item">
            <div className="flow-icon">📤</div>
            <div className="flow-label">Export Helper</div>
            <small>(JSON/Word/PDF)</small>
          </div>
        </div>
      </div>

      {/* Stato Sincronizzazione */}
      <div className="card sync-card">
        <h3>📊 Stato Sincronizzazione</h3>
        <div className="sync-status">
          <div className="status-item">
            <div className="status-label">Context API</div>
            <div className="status-value">🟢 Attivo</div>
            <small>Stato in memoria</small>
          </div>
          <div className="status-item">
            <div className="status-label">localStorage</div>
            <div className="status-value">🟢 Sincronizzato</div>
            <small>Dimensione: {getLocalStorageSize()} KB</small>
          </div>
          <div className="status-item">
            <div className="status-label">File System API</div>
            <div className="status-value">
              {apiSupported ? "🟢 Supportata" : "🟡 Limitata"}
            </div>
            <small>
              {apiSupported
                ? "Salvataggio diretto disponibile"
                : "Usa cartella Download"}
            </small>
          </div>
        </div>
      </div>

      {/* Azioni Sincronizzazione */}
      <div className="card sync-card">
        <h3>⚡ Azioni di Sincronizzazione</h3>

        <div className="sync-action">
          <div className="action-info">
            <h4>💾 Salva su File System (Master)</h4>
            <p>
              Salva tutti i dati correnti nella cartella Export come file JSON
              master. Questo diventa il riferimento autoritativo dei dati.
            </p>
          </div>
          <button
            onClick={handleSaveToFileSystem}
            className="btn-sync"
            disabled={syncing}
          >
            {syncing ? "⏳ Salvataggio..." : "💾 Salva Master"}
          </button>
        </div>

        <div className="sync-action">
          <div className="action-info">
            <h4>📥 Carica da File System (Master)</h4>
            <p>
              Carica i dati dal file system master e sincronizza Context API e
              localStorage. Sovrascrive i dati correnti.
            </p>
          </div>
          <button
            onClick={handleLoadFromFileSystem}
            className="btn-sync btn-secondary"
            disabled={syncing}
          >
            {syncing ? "⏳ Caricamento..." : "📥 Carica Master"}
          </button>
        </div>

        <div className="sync-action">
          <div className="action-info">
            <h4>🗑️ Svuota localStorage</h4>
            <p>
              Rimuove tutti i dati di backup da localStorage. Il file system
              master non viene modificato.
            </p>
          </div>
          <button
            onClick={handleClearLocalStorage}
            className="btn-sync btn-danger"
            disabled={syncing}
          >
            🗑️ Svuota Backup
          </button>
        </div>
      </div>

      {/* Informazioni Tecniche */}
      <div className="card info-card">
        <h4>ℹ️ Informazioni Tecniche</h4>
        <ul className="info-list">
          <li>
            <strong>Context API:</strong> Gestisce lo stato dell'applicazione in
            memoria. Tutti i componenti accedono ai dati tramite il Context.
          </li>
          <li>
            <strong>localStorage:</strong> Backup automatico locale nel browser.
            Sincronizzato automaticamente ad ogni modifica del Context.
          </li>
          <li>
            <strong>File System (Master):</strong> Fonte autoritativa dei dati.
            I file JSON nella cartella Export sono il riferimento ufficiale del
            SGQ.
          </li>
          <li>
            <strong>Export Helper:</strong> Sistema centralizzato per
            esportazione in formati multipli (JSON, Word, PDF) conforme ISO
            9001:2015.
          </li>
        </ul>

        {!apiSupported && (
          <div className="warning-box">
            <strong>⚠️ Nota Browser:</strong> Il tuo browser non supporta
            completamente la File System Access API. I file verranno salvati
            nella cartella Download anziché nella cartella Export specificata.
            Per supporto completo, usa Chrome/Edge 86+.
          </div>
        )}
      </div>
    </div>
  );
};

export default DataSync;
