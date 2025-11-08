/**
 * Storage Test Component (STEP 3)
 * Componente temporaneo per testare Storage Layer
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React, { useEffect, useState } from "react";
import { useStorage } from "../contexts/StorageContext";
import { useAuditMetrics } from "../hooks/useAuditMetrics";

function StorageTestComponent() {
  const {
    audits,
    currentAudit,
    currentAuditId,
    isSaving,
    allSaved,
    auditSaveStatus,
    listSaveStatus,
    updateCurrentAudit,
    switchAudit,
    createAudit,
    deleteAudit,
    resetToMockData,
    fsConnected,
    connectFileSystem,
  } = useStorage();

  const metrics = useAuditMetrics(currentAudit);
  const [testLog, setTestLog] = useState([]);

  // Log inizializzazione
  useEffect(() => {
    addLog(`✅ StorageProvider inizializzato con ${audits.length} audit`);
    if (currentAudit) {
      addLog(
        `✅ Audit corrente: ${currentAudit.metadata.auditNumber} - ${currentAudit.metadata.clientName}`
      );
    }
  }, []);

  const addLog = (message) => {
    setTestLog((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  };

  // === TEST HANDLERS ===

  const handleTestMetrics = () => {
    addLog(`📊 Metriche audit corrente:`);
    addLog(`  - Completamento: ${metrics.completionPercentage}%`);
    addLog(
      `  - Domande: ${metrics.answeredQuestions}/${metrics.totalQuestions}`
    );
    addLog(`  - NC totali: ${metrics.ncStats.total}`);
    addLog(`  - Evidenze: ${metrics.evidenceCount}`);
    addLog(`  - Pending: ${metrics.pendingIssuesCount}`);
    addLog(`  - Sync check: ${JSON.stringify(metrics.syncCheck)}`);
  };

  const handleTestAutoSave = () => {
    if (!currentAudit) return;

    addLog("🔄 Modifica audit per test auto-save...");
    updateCurrentAudit((audit) => ({
      ...audit,
      metadata: {
        ...audit.metadata,
        notes:
          (audit.metadata.notes || "") +
          `\n[TEST ${new Date().toLocaleTimeString()}]`,
        lastModified: new Date().toISOString(),
      },
    }));
    addLog("✅ Modifica applicata - attendi 2s per auto-save");
  };

  const handleSwitchAudit = (auditId) => {
    const success = switchAudit(auditId);
    if (success) {
      const audit = audits.find((a) => a.metadata.id === auditId);
      addLog(`✅ Switched to: ${audit.metadata.auditNumber}`);
    } else {
      addLog(`❌ Errore switch audit`);
    }
  };

  const handleCreateAudit = () => {
    const newAudit = createAudit({
      auditNumber: `2025-${String(audits.length + 1).padStart(2, "0")}`,
      clientName: "Test Client SRL",
      auditDate: new Date().toISOString().split("T")[0],
      auditorName: "Test Auditor",
      norms: ["ISO_9001"],
    });

    if (newAudit) {
      addLog(`✅ Creato nuovo audit: ${newAudit.metadata.auditNumber}`);
    } else {
      addLog(`❌ Errore creazione audit`);
    }
  };

  const handleDeleteLast = () => {
    const lastAudit = audits[audits.length - 1];
    if (!lastAudit) return;

    const success = deleteAudit(lastAudit.metadata.id);
    if (success) {
      addLog(`✅ Eliminato audit: ${lastAudit.metadata.auditNumber}`);
    } else {
      addLog(`❌ Errore eliminazione audit`);
    }
  };

  const handleResetMock = () => {
    resetToMockData();
    addLog("✅ Reset a mock data (3 audit)");
  };

  const handleTestFileSystem = async () => {
    addLog("🔌 Test File System Access API...");
    const handle = await connectFileSystem();
    if (handle) {
      addLog(`✅ File System connesso: ${handle.name}`);
    } else {
      addLog(`❌ File System non connesso`);
    }
  };

  const handleInspectLocalStorage = () => {
    addLog("🔍 Inspect localStorage:");
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      const value = localStorage.getItem(key);
      const size = new Blob([value]).size;
      addLog(`  - ${key}: ${(size / 1024).toFixed(2)} KB`);
    });
  };

  // === RENDER ===

  if (!currentAudit) {
    return (
      <div style={styles.container}>
        <h2>⚠️ Nessun audit disponibile</h2>
        <button onClick={handleResetMock} style={styles.button}>
          Reset Mock Data
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2>🧪 Storage Layer Test (STEP 3)</h2>

      {/* Status Bar */}
      <div style={styles.statusBar}>
        <div style={styles.statusItem}>
          <strong>Save Status:</strong>{" "}
          {isSaving ? "💾 Saving..." : allSaved ? "✅ Saved" : "⏳ Idle"}
        </div>
        <div style={styles.statusItem}>
          <strong>Audit:</strong> {auditSaveStatus}
        </div>
        <div style={styles.statusItem}>
          <strong>List:</strong> {listSaveStatus}
        </div>
        <div style={styles.statusItem}>
          <strong>FS:</strong>{" "}
          {fsConnected ? "🔌 Connected" : "❌ Disconnected"}
        </div>
      </div>

      {/* Audit Info */}
      <div style={styles.auditInfo}>
        <h3>Audit Corrente</h3>
        <p>
          <strong>Numero:</strong> {currentAudit.metadata.auditNumber}
        </p>
        <p>
          <strong>Cliente:</strong> {currentAudit.metadata.clientName}
        </p>
        <p>
          <strong>Data:</strong>{" "}
          {new Date(currentAudit.metadata.lastModified).toLocaleDateString(
            "it-IT"
          )}
        </p>
        <p>
          <strong>Norme:</strong>{" "}
          {currentAudit.metadata.selectedStandards?.join(", ") || "N/A"}
        </p>
        <p>
          <strong>Status:</strong> {currentAudit.metadata.status}
        </p>
      </div>

      {/* Metrics */}
      <div style={styles.metrics}>
        <h3>Metriche Real-time</h3>
        <div style={styles.metricsGrid}>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>
              {metrics.completionPercentage}%
            </div>
            <div style={styles.metricLabel}>Completamento</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>{metrics.ncStats.total}</div>
            <div style={styles.metricLabel}>Non Conformità</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>{metrics.evidenceCount}</div>
            <div style={styles.metricLabel}>Evidenze</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>{metrics.pendingIssuesCount}</div>
            <div style={styles.metricLabel}>Pending Issues</div>
          </div>
        </div>
      </div>

      {/* Audit Selector */}
      <div style={styles.section}>
        <h3>Switch Audit ({audits.length} disponibili)</h3>
        <div style={styles.buttonGroup}>
          {audits.map((audit) => (
            <button
              key={audit.metadata.id}
              onClick={() => handleSwitchAudit(audit.metadata.id)}
              style={{
                ...styles.button,
                ...(audit.metadata.id === currentAuditId
                  ? styles.buttonActive
                  : {}),
              }}
            >
              {audit.metadata.auditNumber} - {audit.metadata.clientName}
            </button>
          ))}
        </div>
      </div>

      {/* Test Actions */}
      <div style={styles.section}>
        <h3>Test Actions</h3>
        <div style={styles.buttonGroup}>
          <button onClick={handleTestMetrics} style={styles.button}>
            📊 Test Metriche
          </button>
          <button onClick={handleTestAutoSave} style={styles.button}>
            💾 Test Auto-Save
          </button>
          <button onClick={handleCreateAudit} style={styles.button}>
            ➕ Crea Audit
          </button>
          <button onClick={handleDeleteLast} style={styles.button}>
            🗑️ Elimina Ultimo
          </button>
          <button onClick={handleResetMock} style={styles.button}>
            🔄 Reset Mock
          </button>
          <button onClick={handleTestFileSystem} style={styles.button}>
            🔌 Test File System
          </button>
          <button onClick={handleInspectLocalStorage} style={styles.button}>
            🔍 Inspect localStorage
          </button>
        </div>
      </div>

      {/* Test Log */}
      <div style={styles.logSection}>
        <h3>Test Log</h3>
        <div style={styles.log}>
          {testLog.map((log, index) => (
            <div key={index} style={styles.logEntry}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// === STYLES ===

const styles = {
  container: {
    padding: "20px",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  statusBar: {
    display: "flex",
    gap: "20px",
    padding: "15px",
    background: "#f0f0f0",
    borderRadius: "8px",
    marginBottom: "20px",
  },
  statusItem: {
    fontSize: "14px",
  },
  auditInfo: {
    padding: "15px",
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "8px",
    marginBottom: "20px",
  },
  metrics: {
    marginBottom: "20px",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "15px",
  },
  metricCard: {
    padding: "20px",
    background: "#f8f9fa",
    border: "1px solid #ddd",
    borderRadius: "8px",
    textAlign: "center",
  },
  metricValue: {
    fontSize: "32px",
    fontWeight: "bold",
    color: "#007bff",
    marginBottom: "5px",
  },
  metricLabel: {
    fontSize: "12px",
    color: "#666",
    textTransform: "uppercase",
  },
  section: {
    marginBottom: "20px",
  },
  buttonGroup: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  button: {
    padding: "10px 15px",
    background: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "14px",
  },
  buttonActive: {
    background: "#28a745",
  },
  logSection: {
    marginTop: "30px",
  },
  log: {
    padding: "15px",
    background: "#1e1e1e",
    color: "#d4d4d4",
    fontFamily: "monospace",
    fontSize: "12px",
    borderRadius: "8px",
    maxHeight: "300px",
    overflowY: "auto",
  },
  logEntry: {
    marginBottom: "5px",
  },
};

export default StorageTestComponent;
