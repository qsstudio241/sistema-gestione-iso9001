import React, { useEffect } from "react";
import { StorageProvider, useStorage } from "./contexts/StorageContext";
import { ErrorBoundary } from "./components/SharedComponents";
import Dashboard from "./components/Dashboard";
import WorkspaceManager from "./components/WorkspaceManager";
import { useCheckpointSaver } from "./hooks/useCheckpointSaver";
import { checkAndMigrateStorage } from "./utils/storageVersion";
import "./App.css";

/**
 * AppContent - Componente interno con accesso a StorageContext
 */
function AppContent() {
  const { currentAudit, fsProvider, audits } = useStorage();
  const [settingsExpanded, setSettingsExpanded] = React.useState(false);

  // Auto-save checkpoint ogni 30 secondi quando workspace collegato
  const checkpoint = useCheckpointSaver(currentAudit, fsProvider, {
    intervalMs: 30000,
    enabled: true,
  });

  // Se nessun audit selezionato E ci sono audit disponibili → mostra selector full-screen
  if (!currentAudit && audits.length > 0) {
    return (
      <div className="app app-selector-mode">
        <header className="app-header">
          <div className="container">
            <h1>Sistema di Gestione (ISO 9001 / ISO 14001 / ISO 45001)</h1>
          </div>
        </header>
        <main className="container">
          <Dashboard />
        </main>
        <footer className="app-footer">
          <div className="container">
            <p>
              © {new Date().getFullYear()} - Sistema Gestione ISO
              9001/14001/45001 - Tutti i diritti riservati
            </p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="container">
          <h1>Sistema di Gestione (ISO 9001 / ISO 14001 / ISO 45001)</h1>

          {/* Workspace Manager - Compact mode (status banner) solo quando audit selezionato */}
          {currentAudit && (
            <WorkspaceManager compact={true} audit={currentAudit} />
          )}

          {/* Checkpoint indicator */}
          {checkpoint.lastCheckpointTime && (
            <div className="checkpoint-indicator">
              ✅ Auto-salvato alle{" "}
              {checkpoint.lastCheckpointTime.toLocaleTimeString("it-IT")}
            </div>
          )}
        </div>
      </header>

      <main className="container">
        <Dashboard />
      </main>

      <footer className="app-footer">
        <div className="container">
          <p>
            © {new Date().getFullYear()} - Sistema Gestione ISO 9001/14001/45001
            - Tutti i diritti riservati
          </p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  // Controlla versione storage all'avvio
  useEffect(() => {
    checkAndMigrateStorage();
  }, []);

  return (
    <ErrorBoundary>
      <StorageProvider useMockData={true}>
        <AppContent />
      </StorageProvider>
    </ErrorBoundary>
  );
}

export default App;
