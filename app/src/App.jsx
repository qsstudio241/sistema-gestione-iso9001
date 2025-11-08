import React, { useEffect } from "react";
import { StorageProvider } from "./contexts/StorageContext";
import { ErrorBoundary } from "./components/SharedComponents";
import Dashboard from "./components/Dashboard";
import { checkAndMigrateStorage } from "./utils/storageVersion";
import "./App.css";

function App() {
  // Controlla versione storage all'avvio
  useEffect(() => {
    checkAndMigrateStorage();
  }, []);

  return (
    <ErrorBoundary>
      <StorageProvider useMockData={true}>
        <div className="app">
          <header className="app-header">
            <div className="container">
              <h1>Sistema di Gestione per la Qualità</h1>
              <p className="subtitle">
                UNI EN ISO 9001:2015 / ISO 14001:2015 / ISO 45001:2018
              </p>
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
      </StorageProvider>
    </ErrorBoundary>
  );
}

export default App;
