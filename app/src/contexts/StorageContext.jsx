/**
 * Storage Context
 * Gestione stato globale audit con persistenza localStorage
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { MOCK_AUDITS } from "../data/mockAudits";
import { createNewAudit, validateAuditSchema } from "../data/auditDataModel";
import { useAutoSaveMultiple } from "../hooks/useAutoSave";

// Crea Context
const StorageContext = createContext(null);

// Chiavi localStorage
const STORAGE_KEYS = {
  AUDITS: "audits",
  CURRENT_AUDIT_ID: "currentAuditId",
  FS_CONNECTED: "fsConnected",
};

/**
 * Provider per gestione stato audit
 */
export function StorageProvider({ children, useMockData = true }) {
  // Stato
  const [audits, setAudits] = useState([]);
  const [currentAuditId, setCurrentAuditId] = useState(null);
  const [fsConnected, setFsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Audit corrente (computed)
  const currentAudit = audits.find((a) => a.id === currentAuditId) || null;

  // DEBUG: Log per capire il problema
  useEffect(() => {
    console.log("🔍 DEBUG StorageContext:", {
      auditsCount: audits.length,
      currentAuditId,
      currentAudit: currentAudit ? "FOUND" : "NULL",
      firstAuditId: audits[0]?.id,
      auditsIds: audits.map((a) => a.id),
    });
  }, [audits, currentAuditId, currentAudit]);

  // Auto-save multiplo
  const { auditSaveStatus, listSaveStatus, isSaving, allSaved } =
    useAutoSaveMultiple(currentAudit, audits);

  // === INIZIALIZZAZIONE ===
  useEffect(() => {
    try {
      // Carica da localStorage
      const storedAudits = localStorage.getItem(STORAGE_KEYS.AUDITS);
      const storedCurrentId = localStorage.getItem(
        STORAGE_KEYS.CURRENT_AUDIT_ID
      );
      const storedFsConnected =
        localStorage.getItem(STORAGE_KEYS.FS_CONNECTED) === "true";

      if (storedAudits) {
        // Usa dati salvati
        const parsedAudits = JSON.parse(storedAudits);
        setAudits(parsedAudits);
        setCurrentAuditId(storedCurrentId);
        console.log(`✅ Caricati ${parsedAudits.length} audit da localStorage`);
      } else if (useMockData) {
        // Prima inizializzazione: usa mock data
        setAudits(MOCK_AUDITS);
        setCurrentAuditId(MOCK_AUDITS[0]?.id || null);
        console.log(`✅ Inizializzato con ${MOCK_AUDITS.length} mock audit`);
      } else {
        // Nessun dato
        setAudits([]);
        setCurrentAuditId(null);
        console.log("ℹ️ Nessun audit disponibile");
      }

      setFsConnected(storedFsConnected);
      setIsLoading(false);
    } catch (err) {
      console.error("Errore caricamento audit:", err);
      setError("Errore caricamento dati");
      setIsLoading(false);
    }
  }, [useMockData]);

  // === SALVA CURRENT AUDIT ID ===
  useEffect(() => {
    if (currentAuditId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_AUDIT_ID, currentAuditId);
    }
  }, [currentAuditId]);

  // === CRUD OPERATIONS ===

  /**
   * Aggiorna audit corrente
   */
  const updateCurrentAudit = useCallback(
    (updater) => {
      setAudits((prevAudits) => {
        return prevAudits.map((audit) => {
          if (audit.metadata.id === currentAuditId) {
            const updated =
              typeof updater === "function" ? updater(audit) : updater;

            // Valida schema
            const validation = validateAuditSchema(updated);
            if (!validation.valid) {
              console.warn("⚠️ Schema validation errors:", validation.errors);
            }

            return updated;
          }
          return audit;
        });
      });
    },
    [currentAuditId]
  );

  /**
   * Cambia audit corrente
   */
  const switchAudit = useCallback(
    (auditId) => {
      const audit = audits.find((a) => a.metadata.id === auditId);
      if (audit) {
        setCurrentAuditId(auditId);
        console.log(`✅ Switched to audit: ${audit.metadata.auditNumber}`);
        return true;
      }
      console.warn(`⚠️ Audit not found: ${auditId}`);
      return false;
    },
    [audits]
  );

  /**
   * Crea nuovo audit
   */
  const createAudit = useCallback((metadata) => {
    try {
      const newAudit = createNewAudit(metadata);

      setAudits((prevAudits) => [...prevAudits, newAudit]);
      setCurrentAuditId(newAudit.metadata.id);

      console.log(`✅ Created audit: ${newAudit.metadata.auditNumber}`);
      return newAudit;
    } catch (err) {
      console.error("Errore creazione audit:", err);
      setError("Errore creazione audit");
      return null;
    }
  }, []);

  /**
   * Duplica audit esistente
   */
  const duplicateAudit = useCallback(
    (auditId, newMetadata) => {
      const sourcAudit = audits.find((a) => a.metadata.id === auditId);
      if (!sourcAudit) {
        console.warn(`⚠️ Audit not found for duplication: ${auditId}`);
        return null;
      }

      try {
        const duplicated = {
          ...JSON.parse(JSON.stringify(sourcAudit)), // Deep clone
          metadata: {
            ...sourcAudit.metadata,
            ...newMetadata,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
          },
        };

        setAudits((prevAudits) => [...prevAudits, duplicated]);
        setCurrentAuditId(duplicated.metadata.id);

        console.log(`✅ Duplicated audit: ${duplicated.metadata.auditNumber}`);
        return duplicated;
      } catch (err) {
        console.error("Errore duplicazione audit:", err);
        setError("Errore duplicazione audit");
        return null;
      }
    },
    [audits]
  );

  /**
   * Elimina audit
   */
  const deleteAudit = useCallback(
    (auditId) => {
      const audit = audits.find((a) => a.metadata.id === auditId);
      if (!audit) {
        console.warn(`⚠️ Audit not found for deletion: ${auditId}`);
        return false;
      }

      setAudits((prevAudits) =>
        prevAudits.filter((a) => a.metadata.id !== auditId)
      );

      // Se elimino audit corrente, switcha al primo disponibile
      if (auditId === currentAuditId) {
        const remaining = audits.filter((a) => a.metadata.id !== auditId);
        setCurrentAuditId(remaining[0]?.metadata.id || null);
      }

      // Rimuovi anche localStorage singolo audit
      localStorage.removeItem(`audit_${auditId}`);

      console.log(`✅ Deleted audit: ${audit.metadata.auditNumber}`);
      return true;
    },
    [audits, currentAuditId]
  );

  /**
   * Reset a mock data (per testing)
   */
  const resetToMockData = useCallback(() => {
    setAudits(MOCK_AUDITS);
    setCurrentAuditId(MOCK_AUDITS[0]?.id || null);
    localStorage.removeItem(STORAGE_KEYS.AUDITS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_AUDIT_ID);
    console.log("✅ Reset to mock data");
  }, []);

  /**
   * Cancella tutto (per testing)
   */
  const clearAllData = useCallback(() => {
    setAudits([]);
    setCurrentAuditId(null);
    setFsConnected(false);
    localStorage.clear();
    console.log("✅ All data cleared");
  }, []);

  // === FILE SYSTEM ACCESS API ===

  /**
   * Connetti File System Access API
   */
  const connectFileSystem = useCallback(async () => {
    try {
      if (!window.showDirectoryPicker) {
        throw new Error("File System Access API non supportata");
      }

      // Request directory handle
      const dirHandle = await window.showDirectoryPicker({
        mode: "readwrite",
        startIn: "documents",
      });

      // TODO: Implementare LocalFsProvider (STEP 13)
      console.log("✅ File System connected:", dirHandle.name);

      setFsConnected(true);
      localStorage.setItem(STORAGE_KEYS.FS_CONNECTED, "true");

      return dirHandle;
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Errore connessione File System:", err);
        setError("Errore connessione File System");
      }
      return null;
    }
  }, []);

  /**
   * Disconnetti File System
   */
  const disconnectFileSystem = useCallback(() => {
    setFsConnected(false);
    localStorage.setItem(STORAGE_KEYS.FS_CONNECTED, "false");
    console.log("✅ File System disconnected");
  }, []);

  // Context value
  const value = {
    // State
    audits,
    currentAudit,
    currentAuditId,
    fsConnected,
    isLoading,
    error,

    // Save status
    isSaving,
    allSaved,
    auditSaveStatus,
    listSaveStatus,

    // CRUD operations
    updateCurrentAudit,
    switchAudit,
    createAudit,
    duplicateAudit,
    deleteAudit,

    // File System
    connectFileSystem,
    disconnectFileSystem,

    // Utilities
    resetToMockData,
    clearAllData,
  };

  return (
    <StorageContext.Provider value={value}>{children}</StorageContext.Provider>
  );
}

/**
 * Hook per consumare Storage Context
 */
export function useStorage() {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error("useStorage must be used within StorageProvider");
  }
  return context;
}

export default StorageContext;
