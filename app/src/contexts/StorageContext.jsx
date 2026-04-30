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
  useRef,
} from "react";
import { MOCK_AUDITS } from "../data/mockAudits";
import { createNewAudit, validateAuditSchema } from "../data/auditDataModel";
import { useAutoSaveMultiple } from "../hooks/useAutoSave";
import { getChecklistTemplate } from "../data/checklistTemplates";
import {
  createStorageProvider,
  getDeviceInfo,
} from "../services/storageAdapter";
import { syncService } from "../services/syncService";
import apiService, { setAuditLockTokensForAudit, clearAllAuditLockTokens } from "../services/apiService";

// Crea Context
const StorageContext = createContext(null);

// Chiavi localStorage
const STORAGE_KEYS = {
  AUDITS: "audits",
  CURRENT_AUDIT_ID: "currentAuditId",
  FS_CONNECTED: "fsConnected",
};

/**
 * Tombstone persistente: UUID degli audit eliminati, sopravvive ai page refresh.
 * Protegge reconcileAuditsFromServer dall'aggiungere di nuovo un audit appena cancellato,
 * anche se il server lo restituisce ancora (es. soft-delete non ancora propagato).
 * TTL: 7 giorni — poi la voce viene rimossa automaticamente.
 */
const TOMBSTONE_KEY = 'sgq_deleted_audit_tombstone';
const TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 giorni

function getTombstone() {
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const now = Date.now();
    // Filtra voci scadute
    const cleaned = Object.fromEntries(
      Object.entries(parsed).filter(([, ts]) => now - ts < TOMBSTONE_TTL_MS)
    );
    if (Object.keys(cleaned).length !== Object.keys(parsed).length) {
      localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch { return {}; }
}

function addToTombstone(auditId) {
  try {
    const tombstone = getTombstone();
    tombstone[auditId] = Date.now();
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(tombstone));
  } catch { /* localStorage non disponibile */ }
}

function isInTombstone(auditId) {
  return Boolean(getTombstone()[auditId]);
}

/**
 * Helper: normalizza status checklist per compatibilità
 * Assicura che tutti gli status siano in formato stringa corretto
 */
function normalizeChecklistStatus(checklist) {
  if (!checklist) return checklist;

  const normalized = {};

  Object.entries(checklist).forEach(([normKey, normData]) => {
    if (!normData || typeof normData !== "object") {
      normalized[normKey] = normData;
      return;
    }

    normalized[normKey] = {};

    Object.entries(normData).forEach(([clauseKey, clause]) => {
      if (!clause || !clause.questions) {
        normalized[normKey][clauseKey] = clause;
        return;
      }

      normalized[normKey][clauseKey] = {
        ...clause,
        questions: clause.questions.map((q) => ({
          ...q,
          // Normalizza status: accetta undefined, null, stringa vuota come NOT_ANSWERED
          status: normalizeStatus(q.status),
        })),
      };
    });
  });

  return normalized;
}

/**
 * Helper: normalizza singolo status
 */
function normalizeStatus(status) {
  if (!status || status === "") return "NOT_ANSWERED";

  // Già in formato corretto (NV incluso)
  if (["C", "NC", "OSS", "OM", "NA", "NV", "NOT_ANSWERED"].includes(status)) {
    return status;
  }

  // Legacy format → new format
  const legacyMap = {
    compliant: "C",
    non_compliant: "NC",
    partial: "OSS",
    not_applicable: "NA",
  };

  return legacyMap[status] || "NOT_ANSWERED";
}

/**
 * Deduplica audit caricati da cache/server.
 * Priorita: audit con id numerico DB, poi audit custom checklist, poi record piu ricco/recente.
 */
function dedupeAudits(audits = []) {
  const scoreAudit = (a) => {
    const hasDbId = a?.metadata?.auditId != null ? 1000 : 0;
    const hasCustom = (a?.metadata?.customChecklistId ?? a?.custom_checklist_id) ? 500 : 0;
    const checklistDepth = Object.keys(a?.checklist || {}).length * 20;
    const attachments = (a?.attachments?.length || 0) * 5;
    const customResponses = Object.keys(a?.customResponses || {}).length * 10;
    const ts = Date.parse(a?.metadata?.lastModified || a?.metadata?.updatedAt || 0) || 0;
    return hasDbId + hasCustom + checklistDepth + attachments + customResponses + ts;
  };

  const keyFor = (a) => {
    const uuid = a?.metadata?.id || a?.id || a?.metadata?.audit_uuid || a?.audit_uuid;
    if (uuid) return `uuid:${String(uuid).trim()}`;

    const serverId = a?.metadata?.auditId ?? a?.audit_id ?? null;
    if (
      serverId != null &&
      serverId !== "" &&
      Number.isFinite(Number(serverId)) &&
      Number(serverId) > 0
    ) {
      return `sid:${Number(serverId)}`;
    }

    const num = a?.metadata?.auditNumber || a?.audit_number;
    if (num) return `num:${String(num).trim().toUpperCase()}`;
    return `anon:${String(a?.metadata?.clientName || a?.client_name || '')}:${String(
      a?.metadata?.createdAt || a?.created_at || ''
    )}`;
  };

  const byKey = new Map();
  for (const audit of audits) {
    const key = keyFor(audit);
    const existing = byKey.get(key);
    if (!existing || scoreAudit(audit) > scoreAudit(existing)) {
      byKey.set(key, audit);
    }
  }
  return Array.from(byKey.values());
}

/**
 * Dopo GET /audits: audit in IndexedDB non inclusi nel merge server.
 * Non reinserire audit gia persistiti (metadata.auditId) se il server non li ha restituiti:
 * altrimenti il menu mostra audit di altri tenant/studio esclusi da RBAC (lista locale obsoleta).
 * Restano solo bozze senza audit_id server (offline-first create non ancora sincronizzato).
 */
function filterLocalAuditsAfterServerFetch(localAudits, mergedFromServer) {
  if (!Array.isArray(localAudits) || !Array.isArray(mergedFromServer)) return [];
  const mergedIds = new Set(
    mergedFromServer
      .map((a) => a.metadata?.id || a.id || a?.metadata?.audit_uuid || a?.audit_uuid)
      .filter(Boolean)
      .map((v) => String(v).trim())
  );
  const mergedServerIds = new Set(
    mergedFromServer
      .map((a) => a?.metadata?.auditId ?? a?.audit_id ?? null)
      .filter((v) => v != null && v !== "" && Number.isFinite(Number(v)) && Number(v) > 0)
      .map((v) => Number(v))
  );
  return localAudits.filter((la) => {
    const localId = la.metadata?.id || la.id || la?.metadata?.audit_uuid || la?.audit_uuid;
    const localServerId = la?.metadata?.auditId ?? la?.audit_id ?? null;
    if (mergedIds.has(localId)) return false;
    if (
      localServerId != null &&
      localServerId !== "" &&
      Number.isFinite(Number(localServerId)) &&
      Number(localServerId) > 0 &&
      mergedServerIds.has(Number(localServerId))
    ) {
      return false;
    }

    const aid = la.metadata?.auditId;
    const hasServerNumericId =
      aid != null &&
      aid !== "" &&
      Number.isFinite(Number(aid)) &&
      Number(aid) > 0;
    if (hasServerNumericId) return false;

    // Bozza solo-locale: conserva SOLO se contrassegnata come intenzionale.
    // Flag isIntentionalDraft=true è aggiunto da createNewAudit da aprile 2026.
    // Bozze/residui da sessioni precedenti senza flag vengono rimossi al reconcile successivo,
    // impedendo che test/LOCK-* tornino a comparire indefinitamente.
    if (la.metadata?.isIntentionalDraft !== true) return false;

    return true;
  });
}

/**
 * Provider per gestione stato audit
 */
export function StorageProvider({ children, useMockData = false }) {
  // Storage Provider dinamico (LocalFs o IndexedDB)
  const [fsProvider, setFsProvider] = useState(null);
  const [deviceInfo] = useState(() => getDeviceInfo());
  const [, forceUpdate] = useState({});

  // Inizializza storage provider appropriato
  useEffect(() => {
    async function initStorage() {
      const provider = await createStorageProvider();
      setFsProvider(provider);

      // Trigger update per componenti dipendenti
      provider._triggerUpdate = () => forceUpdate({});

      console.log(
        `✅ Storage provider inizializzato: ${deviceInfo.recommendedStorage}`,
      );
    }
    initStorage();
  }, [deviceInfo.recommendedStorage]);

  // Stato
  const [audits, setAudits] = useState([]);
  const [currentAuditId, setCurrentAuditId] = useState(null);
  const [fsConnected, setFsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync state
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    queueSize: 0,
    lastSync: null,
    hasConflict: false,
    conflictData: null,
  });

  /**
   * Stato caricamento risposte dal server per l'audit corrente.
   * idle → loading → ready | error
   * Usato dal banner di caricamento in AuditAccordionLayout.
   */
  const [serverDataStatus, setServerDataStatus] = useState('idle');

  /** Lock pessimistico audit (server): owner | foreign | pending_server | offline | error */
  const [auditLock, setAuditLock] = useState({
    mode: "none",
    lockedByName: null,
    message: null,
  });
  const auditLockRef = useRef(auditLock);
  useEffect(() => {
    auditLockRef.current = auditLock;
  }, [auditLock]);

  const auditsRef = useRef(audits);
  useEffect(() => {
    auditsRef.current = audits;
  }, [audits]);

  const lockTokenRef = useRef(null);
  const lockUuidRef = useRef(null);
  const lockNumericAuditIdRef = useRef(null);
  const lockHeartbeatRef = useRef(null);
  const lockWriteWarnTsRef = useRef(0);
  const lockSyncWarnTsRef = useRef(0);

  const demoteOwnerLockOnHeartbeatFailure = useCallback((reason = "") => {
    if (lockHeartbeatRef.current) {
      clearInterval(lockHeartbeatRef.current);
      lockHeartbeatRef.current = null;
    }
    const u = lockUuidRef.current;
    const numericId = lockNumericAuditIdRef.current;
    if (u) {
      setAuditLockTokensForAudit(u, numericId, null);
    }
    lockTokenRef.current = null;
    lockUuidRef.current = null;
    lockNumericAuditIdRef.current = null;

    if (!navigator.onLine) {
      setAuditLock({
        mode: "offline",
        lockedByName: null,
        message:
          "Connessione assente: lock server non rinnovabile. Riapri l'audit quando torni online.",
      });
      return;
    }
    setAuditLock({
      mode: "pending_server",
      lockedByName: null,
      message:
        reason ||
        "Sessione lock non più valida. Riapri l'audit o attendi la riacquisizione automatica del lock.",
    });
  }, []);

  // Bug 5: ref stabile per currentAuditId (accessibile da callback senza stale closure)
  const currentAuditIdRef = useRef(null);
  useEffect(() => {
    currentAuditIdRef.current = currentAuditId;
    // Reset stato caricamento dati server ad ogni cambio audit
    setServerDataStatus(currentAuditId ? 'idle' : 'idle');
  }, [currentAuditId]);
  // Bug 2: debounce per fetchAndApplyServerResponses (evita riesecuzione entro 60s per stesso audit)
  const fetchAndApplyLastRunRef = useRef({});
  // Guard idratazione: true mentre fetchAndApplyServerResponses è in corso.
  // Blocca save_responses durante il fetch iniziale per evitare sovrascrittura dati server.
  const isHydratingRef = useRef(false);
  // Fix delete: Set degli audit appena eliminati — il reconcile NON deve ripristinarli dalla cache locale.
  const recentlyDeletedRef = useRef(new Set());
  // Guard per-sessione: evita di ri-accodare update_audit per rich-data migration
  // sullo stesso UUID più di una volta nella stessa sessione browser.
  const richDataMigrationDoneRef = useRef(new Set());

  // Audit corrente (computed) - supporta sia metadata.id che id top-level
  const currentAudit =
    audits.find((a) => {
      const auditId = a.metadata?.id || a.id;
      return auditId === currentAuditId;
    }) || null;

  // --- Lock audit server (multi-utente): acquisizione, heartbeat, rilascio ---
  useEffect(() => {
    let cancelled = false;

    function clearHeartbeat() {
      if (lockHeartbeatRef.current) {
        clearInterval(lockHeartbeatRef.current);
        lockHeartbeatRef.current = null;
      }
    }

    async function releaseHeldLock() {
      clearHeartbeat();
      const u = lockUuidRef.current;
      const t = lockTokenRef.current;
      if (u && t) {
        setAuditLockTokensForAudit(u, lockNumericAuditIdRef.current, null);
        lockTokenRef.current = null;
        lockUuidRef.current = null;
        lockNumericAuditIdRef.current = null;
        try {
          await apiService.releaseAuditLock(u);
        } catch {
          /* ignore */
        }
      }
    }

    (async () => {
      await releaseHeldLock();
      if (cancelled) return;

      if (!currentAuditId) {
        setAuditLock({ mode: "none", lockedByName: null, message: null });
        return;
      }

      const audit = auditsRef.current.find(
        (a) => (a.metadata?.id || a.id) === currentAuditId,
      );
      const uuid = audit?.metadata?.id || audit?.id;
      if (!uuid) {
        setAuditLock({ mode: "none", lockedByName: null, message: null });
        return;
      }

      if (!navigator.onLine) {
        setAuditLock({
          mode: "offline",
          lockedByName: null,
          message:
            "Sei offline: lock non attivo sul server. Evita modifiche concorrenti sullo stesso audit con altri utenti.",
        });
        return;
      }

      try {
        const res = await apiService.acquireAuditLock(uuid);
        if (cancelled) return;
        const tok = res?.data?.lock_token;
        if (tok) {
          const numericId =
            res?.data?.audit_id ??
            audit?.metadata?.auditId ??
            audit?.audit_id ??
            null;
          setAuditLockTokensForAudit(uuid, numericId, tok);
          lockTokenRef.current = tok;
          lockUuidRef.current = uuid;
          lockNumericAuditIdRef.current = numericId;
          setAuditLock({ mode: "owner", lockedByName: null, message: null });
          const hb = setInterval(() => {
            apiService.renewAuditLock(uuid).catch((e) => {
              console.warn("[AUDIT_LOCK] heartbeat fallito:", e?.message || e);
              // 401 = sessione scaduta: ferma heartbeat, non ha senso riprovare.
              if (e?.status === 401) {
                clearInterval(lockHeartbeatRef.current);
                lockHeartbeatRef.current = null;
                setAuditLock({ mode: "none", lockedByName: null, message: null });
                return;
              }
              demoteOwnerLockOnHeartbeatFailure(e?.message);
            });
          }, 60 * 1000);
          lockHeartbeatRef.current = hb;
          // Sblocca subito la sync in coda che aveva fallito per lock non ancora pronto
          syncService.processQueue().catch(() => {});
        }
      } catch (e) {
        if (cancelled) return;
        const status = e?.status;
        const code = e?.code;
        if (status === 423 || code === "AUDIT_LOCKED") {
          const numClear =
            audit?.metadata?.auditId ??
            audit?.audit_id ??
            lockNumericAuditIdRef.current;
          setAuditLockTokensForAudit(uuid, numClear, null);
          lockNumericAuditIdRef.current = null;
          setAuditLock({
            mode: "foreign",
            lockedByName: e?.data?.locked_by_name || "Altro utente",
            message:
              e?.message ||
              "Questo audit è in modifica da un altro utente. Le modifiche non verranno salvate sul server.",
          });
        } else if (status === 404) {
          setAuditLock({
            mode: "pending_server",
            lockedByName: null,
            message:
              "Audit non ancora sul server: il lock si attiverà dopo la prima sincronizzazione.",
          });
        } else {
          setAuditLock({
            mode: "error",
            lockedByName: null,
            message: e?.message || "Impossibile acquisire il lock",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      clearHeartbeat();
      const u = lockUuidRef.current;
      const t = lockTokenRef.current;
      if (u && t) {
        setAuditLockTokensForAudit(u, lockNumericAuditIdRef.current, null);
        lockTokenRef.current = null;
        lockUuidRef.current = null;
        lockNumericAuditIdRef.current = null;
        apiService.releaseAuditLock(u).catch(() => {});
      }
    };
  }, [currentAuditId]);

  // Ritenta lock quando l'audit compare sul server (stesso audit selezionato)
  useEffect(() => {
    if (auditLock.mode !== "pending_server" || !currentAuditId || !navigator.onLine) {
      return undefined;
    }
    const timer = setInterval(async () => {
      const audit = auditsRef.current.find(
        (a) => (a.metadata?.id || a.id) === currentAuditId,
      );
      const uuid = audit?.metadata?.id || audit?.id;
      if (!uuid) return;
      try {
        const res = await apiService.acquireAuditLock(uuid);
        const tok = res?.data?.lock_token;
        if (tok) {
          if (lockHeartbeatRef.current) {
            clearInterval(lockHeartbeatRef.current);
            lockHeartbeatRef.current = null;
          }
          const numericId =
            res?.data?.audit_id ??
            audit?.metadata?.auditId ??
            audit?.audit_id ??
            null;
          setAuditLockTokensForAudit(uuid, numericId, tok);
          lockTokenRef.current = tok;
          lockUuidRef.current = uuid;
          lockNumericAuditIdRef.current = numericId;
          setAuditLock({ mode: "owner", lockedByName: null, message: null });
          lockHeartbeatRef.current = setInterval(() => {
            apiService.renewAuditLock(uuid).catch((e) => {
              console.warn("[AUDIT_LOCK] heartbeat fallito:", e?.message || e);
              if (e?.status === 401) {
                clearInterval(lockHeartbeatRef.current);
                lockHeartbeatRef.current = null;
                setAuditLock({ mode: "none", lockedByName: null, message: null });
                return;
              }
              demoteOwnerLockOnHeartbeatFailure(e?.message);
            });
          }, 60 * 1000);
          clearInterval(timer);
          syncService.processQueue().catch(() => {});
        }
      } catch (err) {
        // 401 = sessione scaduta: ferma il retry, il 401 interceptor gestirà il logout.
        // Continuare a riprovare bombarderebbe il server con richieste inutili.
        if (err?.status === 401) {
          clearInterval(timer);
          setAuditLock({ mode: "none", lockedByName: null, message: null });
        }
        // altri errori (404, 423, rete): resta in pending_server e riprova al prossimo tick
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [auditLock.mode, currentAuditId]);

  // Rilascio lock server al logout + pulizia cache locale (IndexedDB audit + sync DB)
  useEffect(() => {
    let logoutInProgress = false;
    const onUserLoggedOut = () => {
      // Guard: evita doppia esecuzione se sgq:userLoggedOut arriva più volte
      // (AuthContext emette da logout() e handleForceLogout, o StorageContext rimontato).
      if (logoutInProgress) return;
      logoutInProgress = true;

      if (lockHeartbeatRef.current) {
        clearInterval(lockHeartbeatRef.current);
        lockHeartbeatRef.current = null;
      }
      const u = lockUuidRef.current;
      const t = lockTokenRef.current;
      if (u && t) {
        setAuditLockTokensForAudit(u, lockNumericAuditIdRef.current, null);
        lockTokenRef.current = null;
        lockUuidRef.current = null;
        lockNumericAuditIdRef.current = null;
        apiService.releaseAuditLock(u).catch(() => {});
      }
      setAuditLock({ mode: "none", lockedByName: null, message: null });

      void (async () => {
        sessionResetInProgressRef.current = true;
        try {
          const deadline = Date.now() + 25000;
          while (isReconcilingRef.current && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 40));
          }
          if (isReconcilingRef.current) {
            console.warn("⚠️ [LOGOUT] reconcile ancora attivo dopo timeout — si procede con pulizia cache");
          }
          try {
            if (fsProvider && typeof fsProvider.clearAuditsStore === "function") {
              await fsProvider.clearAuditsStore();
            }
          } catch (e) {
            console.warn("⚠️ [LOGOUT] clearAuditsStore:", e?.message || e);
          }
          try {
            await syncService.clearSessionStoresOnLogout();
          } catch (e) {
            console.warn("⚠️ [LOGOUT] clearSessionStoresOnLogout:", e?.message || e);
          }
          setAudits([]);
          setCurrentAuditId(null);
          // Reset flag di inizializzazione: garantisce che al prossimo login
          // (stesso browser, senza page-refresh) loadAuditsFromIndexedDB
          // venga rieseguito per il nuovo utente invece di usare la cache vuota.
          setHasInitialized(false);
          console.warn("[LOGOUT] Cache locale audit + sync sessione azzerate");
        } finally {
          sessionResetInProgressRef.current = false;
        }
      })();
    };
    window.addEventListener("sgq:userLoggedOut", onUserLoggedOut);
    return () => window.removeEventListener("sgq:userLoggedOut", onUserLoggedOut);
  }, [fsProvider]);

  const refreshAuditLock = useCallback(async () => {
    const uuid =
      currentAudit?.metadata?.id ||
      currentAudit?.id ||
      lockUuidRef.current;
    if (!uuid || !navigator.onLine) return { ok: false };
    if (lockHeartbeatRef.current) {
      clearInterval(lockHeartbeatRef.current);
      lockHeartbeatRef.current = null;
    }
    if (lockUuidRef.current && lockTokenRef.current) {
      setAuditLockTokensForAudit(
        lockUuidRef.current,
        lockNumericAuditIdRef.current,
        null,
      );
      try {
        await apiService.releaseAuditLock(lockUuidRef.current);
      } catch {
        /* ignore */
      }
    }
    lockTokenRef.current = null;
    lockUuidRef.current = null;
    lockNumericAuditIdRef.current = null;
    try {
      const res = await apiService.acquireAuditLock(uuid);
      const tok = res?.data?.lock_token;
      if (tok) {
        const numericId =
          res?.data?.audit_id ??
          currentAudit?.metadata?.auditId ??
          currentAudit?.audit_id ??
          null;
        setAuditLockTokensForAudit(uuid, numericId, tok);
        lockTokenRef.current = tok;
        lockUuidRef.current = uuid;
        lockNumericAuditIdRef.current = numericId;
        setAuditLock({ mode: "owner", lockedByName: null, message: null });
        lockHeartbeatRef.current = setInterval(() => {
          apiService.renewAuditLock(uuid).catch((e) => {
            console.warn("[AUDIT_LOCK] heartbeat fallito:", e?.message || e);
            if (e?.status === 401) {
              clearInterval(lockHeartbeatRef.current);
              lockHeartbeatRef.current = null;
              setAuditLock({ mode: "none", lockedByName: null, message: null });
              return;
            }
            demoteOwnerLockOnHeartbeatFailure(e?.message);
          });
        }, 60 * 1000);
        syncService.processQueue().catch(() => {});
        return { ok: true };
      }
    } catch (e) {
      if (e?.status === 423) {
        setAuditLock({
          mode: "foreign",
          lockedByName: e?.data?.locked_by_name || "Altro utente",
          message: e?.message,
        });
      }
    }
    return { ok: false };
  }, [currentAudit]);

  // Auto-save multiplo con IndexedDB
  const { auditSaveStatus, listSaveStatus, isSaving, allSaved } =
    useAutoSaveMultiple(currentAudit, audits, fsProvider);

  // === SYNC INIZIALE ALL'AVVIO + AUTO-SYNC POLLING ===
  useEffect(() => {
    async function initSyncAndPolling() {
      console.log("🚀 [INIT] Avvio sync iniziale...");

      try {
        // Avvia auto-sync polling (30s)
        syncService.startAutoSync();

        if (!navigator.onLine) {
          console.log("📴 [INIT] Offline - carico solo dati locali");
          setSyncStatus((prev) => ({
            ...prev,
            lastSync: null,
            isSyncing: false,
          }));
          return;
        }

        // Verifica server raggiungibile
        const serverReachable = await syncService.isServerReachable();
        if (!serverReachable) {
          console.warn("⚠️ [INIT] Server non raggiungibile - fallback locale");
          return;
        }

        setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

        // Processa queue esistente
        await syncService.processQueue();

        // Aggiorna queue size
        const queueSize = await syncService.getActiveQueueSize();
        setSyncStatus((prev) => ({
          ...prev,
          isSyncing: false,
          queueSize,
          lastSync: new Date().toISOString(),
        }));

        console.log(
          "✅ [INIT] Sync iniziale completata, queue size:",
          queueSize,
        );
      } catch (error) {
        console.error("❌ [INIT] Errore sync iniziale:", error);
        setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
      }
    }

    initSyncAndPolling();

    // Cleanup: ferma auto-sync al unmount
    return () => {
      syncService.stopAutoSync();
    };
  }, []); // Solo al mount

  // === INIZIALIZZAZIONE: MIGRAZIONE localStorage → IndexedDB + CARICAMENTO ===
  const [hasInitialized, setHasInitialized] = useState(false);
  /** Incrementato dopo login: forza a ripetere loadAuditsFromIndexedDB (l'effect non si riattiva solo con hasInitialized=false). */
  const [authReloadNonce, setAuthReloadNonce] = useState(0);
  const lastLoadedAuthNonceRef = useRef(null);
  const isReconcilingRef = useRef(false);
  /** True mentre logout sta svuotando IDB: reconcile deve attendere (evita race login→lettura 11 audit vecchi). */
  const sessionResetInProgressRef = useRef(false);

  /**
   * Scarica TUTTI gli audit server (paginazione completa).
   * Evita menu incompleti quando il totale supera il limit default API.
   */
  const fetchAllServerAudits = useCallback(async () => {
    const converter = await import('../utils/auditConverter');
    const first = await apiService.getAudits({ page: 1, limit: 200 });
    const rawFirst = first?.data ?? first?.audits ?? first?.items ?? [];
    const firstData = Array.isArray(rawFirst) ? rawFirst : [];
    const totalPages = Number(first?.pagination?.totalPages || 1);

    if (totalPages <= 1) {
      return converter.convertAuditsFromBackend(firstData);
    }

    const allBackendAudits = [...firstData];
    for (let page = 2; page <= totalPages; page++) {
      const next = await apiService.getAudits({ page, limit: 200 });
      const raw = next?.data ?? next?.audits ?? next?.items ?? [];
      allBackendAudits.push(...(Array.isArray(raw) ? raw : []));
    }

    return converter.convertAuditsFromBackend(allBackendAudits);
  }, []);

  /**
   * Riconciliazione robusta multi-device:
   * processQueue -> download server -> merge deterministico -> replace cache.
   */
  const reconcileAuditsFromServer = useCallback(async ({ processQueueFirst = true } = {}) => {
    if (!fsProvider || !navigator.onLine) return { success: false, reason: "offline_or_no_provider" };
    if (isReconcilingRef.current) return { success: false, reason: "already_running" };

    const waitUntil = Date.now() + 30000;
    while (sessionResetInProgressRef.current && Date.now() < waitUntil) {
      await new Promise((r) => setTimeout(r, 40));
    }
    if (sessionResetInProgressRef.current) {
      console.warn("⚠️ [RECONCILE] sessionReset ancora attivo dopo timeout — si prosegue");
    }

    isReconcilingRef.current = true;
    try {
      if (processQueueFirst) {
        await syncService.processQueue();
      }

      const localAudits = await fsProvider.loadAllAudits();
      const serverAudits = await fetchAllServerAudits();

      // Bug 5 Fix A: se il server restituisce 0 audit (probabile errore API o RBAC temporaneo),
      // non azzerare la lista locale — mantieni stato corrente e audit selezionato.
      if (serverAudits.length === 0) {
        console.warn("⚠️ [RECONCILE] Server ha restituito 0 audit — skip riconciliazione per evitare perdita audit corrente");
        return { success: false, reason: "server_returned_empty_list" };
      }

      if (serverAudits.length > 0) {
        const serverUuids = serverAudits.map((a) => a.metadata?.id || a.id).filter(Boolean);
        syncService.clearQueueForServerAudits(serverUuids).catch(() => {});
      }

      const mergedAudits = serverAudits.map((serverAudit) => {
        const sid = serverAudit.metadata?.id || serverAudit.id;
        const localAudit = localAudits.find((la) => (la.metadata?.id || la.id) === sid);
        let merged = { ...serverAudit };

        // Preserva contenuti ricchi locali se il server non li ha ancora
        const localGD = localAudit?.metadata?.generalData ?? localAudit?.generalData;
        const localAO = localAudit?.metadata?.auditObjective ?? localAudit?.auditObjective;
        const localAOut = localAudit?.metadata?.auditOutcome ?? localAudit?.auditOutcome;
        const hasRichDataLocal = localGD || localAO || localAOut;
        const hasRichDataServer = serverAudit?.generalData || serverAudit?.auditObjective || serverAudit?.auditOutcome;
        if (hasRichDataLocal && !hasRichDataServer) {
          merged.metadata = {
            ...merged.metadata,
            generalData: localGD,
            auditObjective: localAO,
            auditOutcome: localAOut,
          };
        }

        // Preserva custom checklist locale in caso di payload server incompleto
        const localCustomId = localAudit?.metadata?.customChecklistId ?? localAudit?.custom_checklist_id;
        const serverCustomId = serverAudit?.metadata?.customChecklistId ?? serverAudit?.custom_checklist_id;
        if (localCustomId != null && localCustomId !== '' && (serverCustomId == null || serverCustomId === '')) {
          merged.metadata = {
            ...merged.metadata,
            customChecklistId: localCustomId,
            selectedStandards: localAudit?.metadata?.selectedStandards ?? [],
          };
          merged.checklist = localAudit?.checklist ?? {};
        }

        // Preserva selectedStandards locale se più completo
        const localStds = localAudit?.metadata?.selectedStandards;
        const serverStds = serverAudit?.metadata?.selectedStandards || [];
        if (localStds && localStds.length > serverStds.length) {
          merged.metadata = { ...merged.metadata, selectedStandards: localStds };
        }

        // Preserva checklist locale se server non contiene struttura utile
        const localChecklist = localAudit?.checklist;
        const serverChecklistKeys = Object.keys(serverAudit?.checklist || {});
        const localChecklistKeys = Object.keys(localChecklist || {});
        if (
          localChecklistKeys.length > 0 &&
          (serverChecklistKeys.length === 0 ||
            (serverChecklistKeys.length === 1 &&
              serverChecklistKeys[0] === 'ISO_9001' &&
              Object.keys(serverAudit?.checklist?.ISO_9001 || {}).length === 0))
        ) {
          merged.checklist = localChecklist;
        }

        if (localAudit?.attachments?.length > 0 && !(serverAudit?.attachments?.length > 0)) {
          merged.attachments = localAudit.attachments;
        }

        const localCustomResponses = localAudit?.customResponses;
        const hasLocalCustomResponses = localCustomResponses && Object.keys(localCustomResponses).length > 0;
        const serverHasCustomResponses = merged?.customResponses && Object.keys(merged.customResponses).length > 0;
        if (hasLocalCustomResponses && !serverHasCustomResponses) {
          merged.customResponses = localCustomResponses;
        }

        return merged;
      });

      const localOnly = filterLocalAuditsAfterServerFetch(localAudits, mergedAudits);

      let finalAudits = dedupeAudits(localOnly.length > 0 ? [...mergedAudits, ...localOnly] : mergedAudits);

      // Filtro 1 — Race condition in-sessione: rimuove audit appena eliminati
      // (recentlyDeletedRef è in memoria, protegge solo nella sessione corrente).
      if (recentlyDeletedRef.current.size > 0) {
        finalAudits = finalAudits.filter((a) => {
          const id = a.metadata?.id || a.id;
          return !recentlyDeletedRef.current.has(id);
        });
      }

      // Filtro 2 — Tombstone persistente: sopravvive ai page refresh.
      // Garantisce che un audit eliminato non ricompaia anche dopo ricarica della pagina,
      // indipendentemente da cosa restituisce il server (soft-delete non ancora propagato, ecc.).
      const tombstone = getTombstone();
      if (Object.keys(tombstone).length > 0) {
        finalAudits = finalAudits.filter((a) => {
          const id = a.metadata?.id || a.id;
          return !tombstone[id];
        });
      }

      // Bug 5 Fix B: se l'audit attualmente selezionato è stato escluso da finalAudits
      // (il server non lo ha restituito, es. bug RBAC o paginazione incompleta),
      // ripristinarlo dalla cache locale per evitare che scompaia dal menu.
      // ECCEZIONE: se l'audit è stato appena eliminato (recentlyDeletedRef), NON ripristinarlo.
      const protectedId = currentAuditIdRef.current;
      if (protectedId && !recentlyDeletedRef.current.has(protectedId)) {
        const inFinal = finalAudits.some((a) => (a.metadata?.id || a.id) === protectedId);
        if (!inFinal) {
          const inLocal = localAudits.find((a) => (a.metadata?.id || a.id) === protectedId);
          if (inLocal) {
            console.warn(`⚠️ [RECONCILE] Audit corrente ${protectedId} non nel server response — ripristino dalla cache locale`);
            finalAudits = dedupeAudits([...finalAudits, inLocal]);
          }
        }
      }

      // Ripristina metadata.auditId da sync_metadata se disponibile
      for (let i = 0; i < finalAudits.length; i++) {
        const a = finalAudits[i];
        if (a.metadata?.auditId != null) continue;
        const uuid = a.metadata?.id || a.id;
        const serverId = await syncService.getAuditIdForUuid(uuid);
        if (serverId != null) {
          finalAudits[i] = { ...a, metadata: { ...a.metadata, auditId: serverId } };
        }
      }

      if (typeof fsProvider.clearAuditsStore === "function") {
        await fsProvider.clearAuditsStore();
      }
      for (const audit of finalAudits) {
        await fsProvider.saveAudit(audit);
      }

      setAudits(finalAudits);
      setCurrentAuditId((prev) => {
        if (!prev) return prev;
        // Audit eliminato (in-sessione o tombstone persistente): azzera currentAuditId.
        if (recentlyDeletedRef.current.has(prev) || isInTombstone(prev)) return null;
        const exists = finalAudits.some((a) => (a.metadata?.id || a.id) === prev);
        return exists ? prev : null;
      });

      return { success: true, count: finalAudits.length };
    } catch (error) {
      console.error("❌ [RECONCILE] Errore riconciliazione audit:", error);
      return { success: false, reason: error?.message || "unknown_error" };
    } finally {
      isReconcilingRef.current = false;
    }
  }, [fetchAllServerAudits, fsProvider]);

  useEffect(() => {
    async function loadAuditsFromIndexedDB() {
      try {
        if (!fsProvider) {
          console.log("⏳ [LOAD] Storage provider non ancora pronto");
          return; // Non procedere se fsProvider non è inizializzato
        }

        if (hasInitialized && lastLoadedAuthNonceRef.current === authReloadNonce) {
          console.log("⏭️ [LOAD] Già inizializzato per questo authReloadNonce, skip");
          return;
        }

        // Reset token di lock al primo caricamento: evita che token di sessioni precedenti
        // (sopravvissuti in sessionStorage) permettano a update_audit stantii di tentare
        // richieste che tornerebbero 409 in loop. I token vengono ri-settati quando
        // il lock viene acquisito (openAudit → acquireAuditLock → setAuditLockTokensForAudit).
        clearAllAuditLockTokens();

        setIsLoading(true);

        // MIGRAZIONE UNA TANTUM: localStorage → IndexedDB
        const storedAudits = localStorage.getItem(STORAGE_KEYS.AUDITS);
        if (storedAudits) {
          console.log(
            "🔄 [MIGRATION] Rilevati audit in localStorage, migrazione in corso...",
          );
          try {
            const parsedAudits = JSON.parse(storedAudits);

            for (const audit of parsedAudits) {
              const normalizedAudit = {
                ...audit,
                checklist: normalizeChecklistStatus(audit.checklist),
              };
              await fsProvider.saveAudit(normalizedAudit);

              // Enqueue per sync server
              await syncService.enqueue("create_audit", normalizedAudit);
            }

            console.log(
              `✅ [MIGRATION] Migrati ${parsedAudits.length} audit in IndexedDB + sync queue`,
            );

            // Rimuovi da localStorage dopo migrazione
            localStorage.removeItem(STORAGE_KEYS.AUDITS);
            localStorage.removeItem(STORAGE_KEYS.CURRENT_AUDIT_ID);
          } catch (migrationError) {
            console.error("❌ [MIGRATION] Errore migrazione:", migrationError);
          }
        }

        // CARICAMENTO: Leggi da IndexedDB (cache locale)
        const localAudits = await fsProvider.loadAllAudits();
        
        // DOWNLOAD DAL SERVER: stessa pipeline della riconciliazione (tutte le pagine).
        // Il backend default limit=50 su GET /audits senza query: senza paginazione il menu
        // risultava troncato fino al prossimo reconcile/login (ambiguità desktop vs mobile).
        let serverAudits = [];
        if (navigator.onLine && apiService.getToken()) {
          try {
            console.log("🌐 [DOWNLOAD] Scarico tutti gli audit dal server (paginato)...");
            serverAudits = await fetchAllServerAudits();
            console.log(`✅ [DOWNLOAD] Scaricati ${serverAudits.length} audit dal server`);

            // SEED sgq_srv_ts: salva il timestamp server per ogni audit scaricato.
            // Garantisce che la migrazione dati ricchi (update_audit) usi sempre
            // updated_at >= server → nessun 409 da clock skew o da primo accesso.
            for (const sa of serverAudits) {
              const saUuid = sa.metadata?.id || sa.id;
              const saUpdatedAt = sa.metadata?.updatedAt;
              if (saUuid && saUpdatedAt) {
                const stored = localStorage.getItem(`sgq_srv_ts_${saUuid}`);
                const storedTs = stored ? new Date(stored).getTime() : 0;
                const serverTs = new Date(saUpdatedAt).getTime();
                if (serverTs > storedTs) {
                  localStorage.setItem(`sgq_srv_ts_${saUuid}`, saUpdatedAt);
                }
              }
            }

            // PULIZIA QUEUE STANTIA: rimuove dalla sync_queue le operazioni
            // create_audit / update_audit per audit già presenti sul server.
            // Impedisce che dati in cache di altri dispositivi sovrascrivano
            // i dati freschi appena scaricati (server-wins enforcement).
            if (serverAudits.length > 0) {
              const serverUuids = serverAudits.map(a => a.metadata?.id || a.id).filter(Boolean);
              syncService.clearQueueForServerAudits(serverUuids).catch(() => {});
            }
          } catch (err) {
            console.warn("⚠️ [DOWNLOAD] Errore download server, uso cache locale:", err.message);
          }
        }

        // MERGE: Server-wins per metadata/checklist, preserva attachments e campi ricchi locali
        const auditsToUploadRichData = []; // audit locali con dati ricchi che il server non ha ancora
        const mergedAudits = serverAudits.length > 0
          ? serverAudits.map(serverAudit => {
              const sid = serverAudit.metadata?.id || serverAudit.id;
              const localAudit = localAudits.find(la => (la.metadata?.id || la.id) === sid);
              
              // Se il server non ha ancora generalData ma il locale sì, preserva il locale
              // e marca per upload immediato verso il server
              // Nota: i campi ricchi possono essere sia nel top-level che dentro metadata
              const localGD = localAudit?.metadata?.generalData ?? localAudit?.generalData;
              const localAO = localAudit?.metadata?.auditObjective ?? localAudit?.auditObjective;
              const localAOut = localAudit?.metadata?.auditOutcome ?? localAudit?.auditOutcome;
              const hasRichDataLocal = localGD || localAO || localAOut;
              const hasRichDataServer = serverAudit?.generalData || serverAudit?.auditObjective || serverAudit?.auditOutcome;
              
              let merged = { ...serverAudit };
              
              if (hasRichDataLocal && !hasRichDataServer) {
                // Server non ha ancora i dati: usa locale e pianifica sync verso server
                // Ripristina dentro metadata (dove Dashboard si aspetta di trovarli)
                merged.metadata = {
                  ...merged.metadata,
                  generalData: localGD,
                  auditObjective: localAO,
                  auditOutcome: localAOut,
                };
                auditsToUploadRichData.push(merged);
              }
              
              // Preserva customChecklistId e selectedStandards dalla versione locale se l'audit
              // è "solo checklist custom" (evita che server con standard_id default sovrascriva e perda dati)
              const localCustomId = localAudit?.metadata?.customChecklistId ?? localAudit?.custom_checklist_id;
              const serverCustomId = serverAudit?.metadata?.customChecklistId ?? serverAudit?.custom_checklist_id;
              if (localCustomId != null && localCustomId !== '' && (serverCustomId == null || serverCustomId === '')) {
                merged.metadata = {
                  ...merged.metadata,
                  customChecklistId: localCustomId,
                  selectedStandards: localAudit?.metadata?.selectedStandards ?? [],
                };
                merged.checklist = localAudit?.checklist ?? {};
              }

              // Preserva selectedStandards dalla versione locale se è più completa di quella server
              // (es: sync precedente incompleta, oppure standard aggiunti offline)
              const localStds = localAudit?.metadata?.selectedStandards;
              const serverStds = serverAudit?.metadata?.selectedStandards || [];
              if (localStds && localStds.length > serverStds.length) {
                merged.metadata = { ...merged.metadata, selectedStandards: localStds };
              }

              // Preserva checklist dalla versione locale se il server ha solo ISO_9001 vuoto
              // (il server non salva la checklist, quindi quella locale è sempre più completa)
              const localChecklist = localAudit?.checklist;
              const serverChecklistKeys = Object.keys(serverAudit?.checklist || {});
              const localChecklistKeys = Object.keys(localChecklist || {});
              if (localChecklistKeys.length > 0 &&
                  (serverChecklistKeys.length === 0 ||
                   (serverChecklistKeys.length === 1 && serverChecklistKeys[0] === 'ISO_9001' &&
                    Object.keys(serverAudit?.checklist?.ISO_9001 || {}).length === 0))) {
                merged.checklist = localChecklist;
              }

              // Preserva allegati locali se il server non li include
              if (localAudit?.attachments?.length > 0 && !(serverAudit?.attachments?.length > 0)) {
                merged.attachments = localAudit.attachments;
              }

              // Preserva evidenze checklist custom se il server non le include
              // (server->frontend via getAudits non carica customResponses; quindi se esistono in locale vanno mantenute)
              const localCustomResponses = localAudit?.customResponses;
              const hasLocalCustomResponses = localCustomResponses && Object.keys(localCustomResponses).length > 0;
              const serverHasCustomResponses = merged?.customResponses && Object.keys(merged.customResponses).length > 0;
              if (hasLocalCustomResponses && !serverHasCustomResponses) {
                merged.customResponses = localCustomResponses;
              }
              
              return merged;
            })
          : localAudits;

        // Includi audit solo locali (non ancora sul server) nella lista finale.
        // Gli audit locali NON inclusi nel merge (stale, senza isIntentionalDraft, o tombstoned)
        // vengono eliminati da IndexedDB per evitare che riemergano al prossimo reload.
        let finalAudits = mergedAudits;
        if (serverAudits.length > 0) {
          const localOnly = filterLocalAuditsAfterServerFetch(localAudits, mergedAudits);
          if (localOnly.length > 0) {
            finalAudits = [...mergedAudits, ...localOnly];
            console.log(`📋 [MERGE] Aggiunti ${localOnly.length} audit solo locali (bozze senza auditId server) alla lista`);
          }

          // Pulizia bozze stale da IndexedDB: audit locali che il server non ha restituito
          // E non sono stati inclusi nel merge come draft intentionali.
          // Impedisce che LOCK-*, ZZ_TEST_* e residui di sessioni precedenti ricompaiano.
          const finalIds = new Set(
            finalAudits.map((a) => String(a.metadata?.id || a.id)).filter(Boolean)
          );
          const staleLocals = localAudits.filter((la) => {
            const lid = String(la.metadata?.id || la.id || "");
            return lid && !finalIds.has(lid);
          });
          if (staleLocals.length > 0) {
            console.log(`🧹 [CLEANUP] Rimozione ${staleLocals.length} audit stale da IndexedDB (non nel server né draft correnti)`);
            const staleUuids = staleLocals
              .map((a) => String(a.metadata?.id || a.id || "").trim())
              .filter(Boolean);
            const staleServerIds = staleLocals
              .map((a) => Number(a?.metadata?.auditId))
              .filter((n) => Number.isFinite(n) && n > 0);
            // Pulisce anche la sync queue legata a questi audit, altrimenti il popup logout
            // continua a mostrare operazioni "non sincronizzate" anche dopo la rimozione lista.
            await syncService
              .clearQueueForStaleAudits({ auditUuids: staleUuids, auditIds: staleServerIds })
              .catch(() => {});
            for (const stale of staleLocals) {
              const sid = stale.metadata?.id || stale.id;
              if (sid && typeof fsProvider.deleteAudit === "function") {
                fsProvider.deleteAudit(sid).catch(() => {});
              }
            }
          }
        }

        // Deduplica difensiva finale per evitare doppioni nel menu selector.
        finalAudits = dedupeAudits(finalAudits);

        // Tombstone persistente: esclude audit eliminati anche dopo page refresh.
        const initTombstone = getTombstone();
        if (Object.keys(initTombstone).length > 0) {
          const before = finalAudits.length;
          finalAudits = finalAudits.filter((a) => {
            const id = a.metadata?.id || a.id;
            return !initTombstone[id];
          });
          if (finalAudits.length < before) {
            console.log(`🪦 [TOMBSTONE] Filtrati ${before - finalAudits.length} audit eliminati dalla lista iniziale`);
          }
        }

        // Ripristina metadata.auditId da sync_metadata per audit che non ce l'hanno
        // (così il banner "non sincronizzato" scompare dopo una sync riuscita, anche dopo ricarica)
        for (let i = 0; i < finalAudits.length; i++) {
          const a = finalAudits[i];
          if (a.metadata?.auditId != null) continue;
          const uuid = a.metadata?.id || a.id;
          const serverId = await syncService.getAuditIdForUuid(uuid);
          if (serverId != null) {
            finalAudits[i] = {
              ...a,
              metadata: { ...a.metadata, auditId: serverId },
            };
          }
        }
        
        // Migrazione campi ricchi verso server: tentata UNA volta per UUID per sessione.
        // Il list endpoint /audits non restituisce generalData/auditObjective/auditOutcome,
        // quindi senza guard la condizione hasRichDataLocal && !hasRichDataServer è sempre vera
        // e provoca loop infiniti (enqueue → 409 conflict → ri-enqueue al prossimo load).
        if (auditsToUploadRichData.length > 0) {
          const newMigrations = auditsToUploadRichData.filter((a) => {
            const uuid = a.metadata?.id || a.id;
            return uuid && !richDataMigrationDoneRef.current.has(uuid);
          });
          if (newMigrations.length > 0) {
            console.log(`📤 [MIGRATE] Sincronizzazione campi ricchi verso server per ${newMigrations.length} audit...`);
            for (const a of newMigrations) {
              const uuid = a.metadata?.id || a.id;
              richDataMigrationDoneRef.current.add(uuid);
              // Usa sempre un timestamp >= server per evitare 409 da "conflict" ciclici.
              const storedServerTs = localStorage.getItem(`sgq_srv_ts_${uuid}`);
              const serverTsMs = storedServerTs ? new Date(storedServerTs).getTime() : 0;
              const migrationUpdatedAt = new Date(Math.max(Date.now(), serverTsMs + 1)).toISOString();
              syncService.enqueue("update_audit", {
                audit_uuid: uuid,
                audit_number: a.metadata?.auditNumber,
                client_name: a.metadata?.clientName,
                company_id: a.metadata?.companyId ?? null,
                audit_party_type: a.metadata?.auditPartyType ?? 'first_party',
                fornitore_name: a.metadata?.fornitoreName ?? '',
                project_year: a.metadata?.projectYear,
                audit_date: a.metadata?.auditDate,
                auditor_name: a.metadata?.auditorName,
                audit_type: a.metadata?.auditType,
                status: a.metadata?.status,
                updated_at: migrationUpdatedAt,
                generalData: a.metadata?.generalData ?? a.generalData,
                auditObjective: a.metadata?.auditObjective ?? a.auditObjective,
                auditOutcome: a.metadata?.auditOutcome ?? a.auditOutcome,
              }).catch(() => {});
            }
          }
        }

        if (finalAudits && finalAudits.length > 0) {
          // Server come fonte di verità: sostituisci completamente la cache locale
          // (evita dati obsoleti quando si cambia device o dopo problemi di rete)
          if (serverAudits.length > 0) {
            if (typeof fsProvider.clearAuditsStore === "function") {
              await fsProvider.clearAuditsStore();
            }
            console.log("💾 [MERGE] Aggiorno IndexedDB con dati mergiati (server + preserva locale)...");
            for (const frontendAudit of finalAudits) {
              await fsProvider.saveAudit(frontendAudit);
            }
            console.log(`✅ [MERGE] ${finalAudits.length} audit mergiati salvati in IndexedDB`);
          }

          setAudits(finalAudits);
          setCurrentAuditId(null); // Mostra sempre selector all'avvio
          console.log(
            `✅ Caricati ${finalAudits.length} audit (${serverAudits.length} server, ${localAudits.length} cache)`,
          );
        } else if (useMockData) {
          // Prima inizializzazione: salva mock data in IndexedDB + ENQUEUE SYNC
          console.log(
            "🆕 [INIT] Prima inizializzazione, salvo mock data in IndexedDB...",
          );
          for (const audit of MOCK_AUDITS) {
            await fsProvider.saveAudit(audit);

            // ENQUEUE per sync al server (ADR-002: offline-first)
            await syncService.enqueue("create_audit", {
              audit_uuid: audit.id || audit.metadata?.id,
              audit_number: audit.metadata?.auditNumber,
              client_name: audit.metadata?.clientName,
              project_year: audit.metadata?.projectYear,
              audit_date: audit.metadata?.auditDate,
              auditor_name: audit.metadata?.auditorName,
              audit_type: audit.metadata?.auditType,
              status: audit.metadata?.status,
              notes: audit.metadata?.notes,
              total_questions: audit.metadata?.totalQuestions,
              answered_questions: audit.metadata?.answeredQuestions,
              conformities_count: audit.metadata?.conformitiesCount,
              non_conformities_count: audit.metadata?.nonConformitiesCount,
              completion_percentage: audit.metadata?.completionPercentage,
              standard_id: 1, // ISO 9001
              updated_at: new Date().toISOString(),
            });
          }
          setAudits(MOCK_AUDITS);
          setCurrentAuditId(null);
          console.log(
            `✅ Inizializzato con ${MOCK_AUDITS.length} mock audit in IndexedDB + ${MOCK_AUDITS.length} enqueued per sync`,
          );
        } else {
          setAudits([]);
          setCurrentAuditId(null);
          console.log("ℹ️ Nessun audit disponibile");
        }

        // FS Connected status (backward compatibility)
        const storedFsConnected =
          localStorage.getItem(STORAGE_KEYS.FS_CONNECTED) === "true";
        setFsConnected(storedFsConnected);

        setIsLoading(false);
        setHasInitialized(true); // Marca come inizializzato
        lastLoadedAuthNonceRef.current = authReloadNonce;
      } catch (err) {
        console.error("❌ Errore caricamento audit da IndexedDB:", err);
        setError("Errore caricamento dati");
        setIsLoading(false);
      }
    }

    loadAuditsFromIndexedDB();
  }, [fsProvider, useMockData, fetchAllServerAudits, authReloadNonce]); // authReloadNonce: dopo login forza reload lista

  // === RELOAD AUDIT DOPO LOGIN ===
  useEffect(() => {
    const handleLoginSuccess = async () => {
      console.log("🔄 [LOGIN] Avvio riconciliazione server/cache...");
      if (fsProvider) {
        await reconcileAuditsFromServer({ processQueueFirst: true });
      }
      // Sempre: dopo logout hasInitialized=false ma l'effect di load non riparte da solo;
      // incrementando authReloadNonce si rifà il download/merge come al primo avvio.
      setAuthReloadNonce((n) => n + 1);
    };

    window.addEventListener('auth:login', handleLoginSuccess);
    return () => window.removeEventListener('auth:login', handleLoginSuccess);
  }, [fsProvider, reconcileAuditsFromServer]);

  // Pull periodico dal server per allineare menu audit su multi-device senza reload pagina.
  useEffect(() => {
    if (!fsProvider || !hasInitialized) return;

    const intervalId = setInterval(async () => {
      if (!navigator.onLine) return;
      // Se non c'è token (sessione scaduta o logout) ferma il timer immediatamente.
      // Evita loop di 401 mentre il componente è ancora montato ma la sessione è già finita.
      if (!apiService.getToken()) {
        clearInterval(intervalId);
        return;
      }
      await reconcileAuditsFromServer({ processQueueFirst: true });
    }, 45000);

    return () => clearInterval(intervalId);
  }, [fsProvider, hasInitialized, reconcileAuditsFromServer]);

  // Riconciliazione immediata quando torna online.
  useEffect(() => {
    const onOnline = async () => {
      if (!apiService.getToken()) return;
      await reconcileAuditsFromServer({ processQueueFirst: true });
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [reconcileAuditsFromServer]);

  // === SALVATAGGIO AUTOMATICO IN INDEXEDDB (depreca localStorage) ===
  useEffect(() => {
    if (audits.length === 0 || !fsProvider) return;

    // NO più localStorage.setItem! IndexedDB è il Single Source of Truth
    // Salvataggio gestito da useAutoSaveMultiple → fsProvider.saveAudit()
    console.log(
      `📊 [STATE] ${audits.length} audit in memoria (IndexedDB è il primary storage)`,
    );
  }, [audits, fsProvider]);

  // === SALVA CURRENT AUDIT ID ===
  // RIMOSSO: Non salvare più currentAuditId - mostra sempre selector all'avvio
  // useEffect(() => {
  //   if (currentAuditId) {
  //     localStorage.setItem(STORAGE_KEYS.CURRENT_AUDIT_ID, currentAuditId);
  //   }
  // }, [currentAuditId]);

  // === CRUD OPERATIONS ===

  /**
   * Estrae risposte checklist da audit per sync
   * @param {Object} audit - Audit con checklist compilata
   * @returns {Array} Array di risposte nel formato backend
   */
  function extractChecklistResponses(audit) {
    const responses = [];
    const checklist = audit.checklist;

    if (!checklist) return responses;

    // Itera su ogni norma (ISO_9001, ISO_14001, ecc.)
    Object.entries(checklist).forEach(([normKey, normData]) => {
      // Itera su ogni clausola
      Object.entries(normData).forEach(([clauseKey, clauseData]) => {
        if (!clauseData.questions || !Array.isArray(clauseData.questions))
          return;

        // Itera su ogni domanda
        clauseData.questions.forEach((question) => {
          // Includi solo domande con risposta (status diverso da NOT_ANSWERED)
          if (question.status && question.status !== "NOT_ANSWERED") {
            responses.push({
              // question_id (intero) prioritario → lookup diretto sul server
              // clause_ref come fallback per lookup via section_code
              question_id: question.questionId || null,
              clause_ref: question.clauseRef || question.id,
              conformity_status: question.status, // 'C', 'NC', 'OSS', 'OM', 'NA'
              notes: question.notes || null,
              evidence: question.evidenceRef || null,
              client_updated_at: new Date().toISOString(),
            });
          }
        });
      });
    });

    return responses;
  }

  /**
   * Calcola metriche checklist da struttura audit
   * @param {Object} checklist - Struttura checklist audit
   * @returns {Object} Metriche: {total, answered, conformities, nonConformities}
   */
  function calculateChecklistMetrics(checklist) {
    let total = 0;
    let answered = 0;
    let conformities = 0;
    let nonConformities = 0;

    if (!checklist) return { total, answered, conformities, nonConformities };

    // Itera su ogni norma (ISO_9001, ISO_14001, ecc.)
    Object.values(checklist).forEach((normData) => {
      // Itera su ogni clausola
      Object.values(normData).forEach((clauseData) => {
        if (!clauseData.questions || !Array.isArray(clauseData.questions))
          return;

        // Conta domande
        clauseData.questions.forEach((q) => {
          total++;
          if (q.status && q.status !== "NOT_ANSWERED") {
            answered++;
            if (q.status === "C") conformities++;
            if (q.status === "NC") nonConformities++;
          }
        });
      });
    });

    return { total, answered, conformities, nonConformities };
  }

  /**
   * Aggiorna audit corrente.
   * @param {Function|Object} updater
   * @param {{ skipSync?: boolean }} opts — skipSync=true inibisce l'enqueue save_responses/update_audit.
   *   Usare quando si aggiorna la struttura locale (es. init template) senza voler sovrascrivere
   *   dati già presenti sul server.
   */
  const updateCurrentAudit = useCallback(
    (updater, { skipSync = false } = {}) => {
      setAudits((prevAudits) => {
        if (auditLockRef.current.mode === "foreign") {
          const now = Date.now();
          if (now - lockWriteWarnTsRef.current > 5000) {
            lockWriteWarnTsRef.current = now;
            window.dispatchEvent(
              new CustomEvent("sgq:auditWriteBlocked", {
                detail: {
                  lockedBy: auditLockRef.current.lockedByName,
                  message: auditLockRef.current.message,
                },
              }),
            );
          }
          return prevAudits;
        }
        return prevAudits.map((audit) => {
          const auditId = audit.metadata?.id || audit.id;
          if (auditId === currentAuditId) {
            let updated =
              typeof updater === "function" ? updater(audit) : updater;

            // Transizione automatica draft → in_progress al primo salvataggio reale.
            // Non avviene per aggiornamenti interni (es. hydrate questionIds, seeding timestamp).
            if (
              updated?.metadata?.status === "draft" &&
              typeof updater === "function"
            ) {
              updated = {
                ...updated,
                metadata: { ...updated.metadata, status: "in_progress" },
              };
            }

            // Valida schema
            const validation = validateAuditSchema(updated);
            if (!validation.valid) {
              console.warn("⚠️ Schema validation errors:", validation.errors);
            }

            // Calcola metriche da checklist per sync accurato
            const metrics = calculateChecklistMetrics(updated.checklist);
            const calculatedMetrics = {
              total_questions: metrics.total,
              answered_questions: metrics.answered,
              conformities_count: metrics.conformities,
              non_conformities_count: metrics.nonConformities,
              completion_percentage:
                metrics.total > 0
                  ? Math.round((metrics.answered / metrics.total) * 100 * 100) /
                    100
                  : 0,
            };

            const auditUuid = updated.id || updated.metadata?.id;

            // skipSync=true o idratazione in corso → non accodare save_responses.
            // Usato da initializeChecklist (template vuoto) e durante fetchAndApplyServerResponses
            // per evitare di sovrascrivere con NOT_ANSWERED dati già presenti sul server.
            if (navigator.onLine && !skipSync && !isHydratingRef.current) {
              const responses = extractChecklistResponses(updated);
              if (responses.length > 0) {
                syncService
                  .enqueue("save_responses", {
                    auditId: auditUuid,
                    responses,
                  })
                  .then(() => {
                    console.log(
                      `📤 [SYNC] ${responses.length} risposte enqueued per sync`,
                    );
                  })
                  .catch((err) => {
                    console.error("❌ [SYNC] Errore enqueue risposte:", err);
                  });
              }
            }

            // Enqueue sync audit metadata se online, lock NON foreign, skipSync=false e non in hydrating.
            if (navigator.onLine && !skipSync && !isHydratingRef.current) {
              const storedServerTs = localStorage.getItem(`sgq_srv_ts_${auditUuid}`);
              const serverTsMs = storedServerTs ? new Date(storedServerTs).getTime() : 0;
              const clientTsMs = Date.now();
              // +1ms garantisce client >= server per evitare conflict non necessari
              const syncUpdatedAt = new Date(Math.max(clientTsMs, serverTsMs + 1)).toISOString();

              syncService
                .enqueue("update_audit", {
                  audit_uuid: auditUuid,
                  audit_number: updated.metadata?.auditNumber,
                  client_name: updated.metadata?.clientName,
                  company_id: updated.metadata?.companyId ?? null,
                  audit_party_type: updated.metadata?.auditPartyType ?? 'first_party',
                  fornitore_name: updated.metadata?.fornitoreName ?? '',
                  project_year: updated.metadata?.projectYear,
                  audit_date: updated.metadata?.auditDate,
                  auditor_name: updated.metadata?.auditorName,
                  audit_type: updated.metadata?.auditType,
                  status: updated.metadata?.status,
                  notes: updated.metadata?.notes,
                  ...calculatedMetrics,
                  selectedStandards: updated.metadata?.selectedStandards || [],
                  custom_checklist_id:
                    updated.metadata?.customChecklistId ??
                    updated.custom_checklist_id ??
                    null,
                  updated_at: syncUpdatedAt,
                  generalData: updated.metadata?.generalData ?? updated.generalData,
                  auditObjective: updated.metadata?.auditObjective ?? updated.auditObjective,
                  auditOutcome: updated.metadata?.auditOutcome ?? updated.auditOutcome,
                })
                .catch((err) => {
                  console.error("❌ [SYNC] Errore enqueue update:", err);
                });

              if (auditLockRef.current.mode !== "owner" && auditLockRef.current.mode !== "none") {
                // Lock "foreign": write bloccato da altro utente — log visibile una volta ogni 5s.
                // Lock "none" (transitorio, acquisizione in corso): nessun warning,
                // l'item è già in coda e verrà inviato dal syncService appena il token arriva.
                const now = Date.now();
                if (now - lockSyncWarnTsRef.current > 5000) {
                  lockSyncWarnTsRef.current = now;
                  console.warn(
                    "⏸️ [SYNC] update_audit sospeso: lock non owner",
                    auditLockRef.current.mode,
                  );
                }
              }
            }

            return updated;
          }
          return audit;
        });
      });
    },
    [currentAuditId],
  );

  /**
   * Cambia audit corrente
   */
  const switchAudit = useCallback(
    (auditId) => {
      const audit = audits.find((a) => {
        const id = a.metadata?.id || a.id;
        return id === auditId;
      });
      if (audit) {
        setCurrentAuditId(auditId);
        console.log(`✅ Switched to audit: ${audit.metadata.auditNumber}`);
        return true;
      }
      console.warn(`⚠️ Audit not found: ${auditId}`);
      return false;
    },
    [audits],
  );

  /**
   * Crea nuovo audit
   */
  const createAudit = useCallback((metadata) => {
    try {
      const newAudit = createNewAudit(metadata);

      setAudits((prevAudits) => [...prevAudits, newAudit]);
      setCurrentAuditId(newAudit.metadata.id);

      // Enqueue sync se online — payload PIATTO (validateAuditPayload richiede audit_uuid, audit_number, client_name al root)
      if (navigator.onLine) {
        const m = newAudit.metadata;
        syncService.enqueue("create_audit", {
          audit_uuid:       m.id,
          audit_number:     m.auditNumber,
          client_name:      m.clientName,
          company_id:       m.companyId ?? null,
          audit_party_type: m.auditPartyType || 'first_party',
          fornitore_name:   m.fornitoreName || null,
          project_year:     m.projectYear,
          audit_date:       m.auditDate,
          auditor_name:     m.auditorName,
          audit_type:       m.auditType,
          status:           m.status || 'draft',
          selectedStandards: m.selectedStandards || [],
          custom_checklist_id: m.customChecklistId ?? null,
          generalData:      m.generalData,
          auditObjective:   m.auditObjective,
          auditOutcome:     m.auditOutcome,
        }).catch((err) => {
          console.error("❌ [SYNC] Errore enqueue create:", err);
        });
      }

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
      const sourcAudit = audits.find((a) => {
        const id = a.metadata?.id || a.id;
        return id === auditId;
      });
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
    [audits],
  );

  /**
   * Importa backup JSON (ripristina audit da file)
   */
  const importBackup = useCallback(
    async (backupData) => {
      try {
        console.log("📥 Import backup iniziato...");

        // Valida struttura backup
        if (!backupData.audits || !Array.isArray(backupData.audits)) {
          throw new Error("Formato backup non valido");
        }

        // Importa ogni audit
        for (const audit of backupData.audits) {
          if (!validateAuditSchema(audit)) {
            console.warn(
              `⚠️ Audit ${audit.metadata?.auditNumber} non valido, saltato`,
            );
            continue;
          }

          // Salva audit nel provider corrente (IndexedDB o LocalFs)
          if (fsProvider?.saveAudit) {
            await fsProvider.saveAudit(audit);
          }

          // Aggiungi a stato se non esiste già
          setAudits((prev) => {
            const exists = prev.some(
              (a) => a.metadata?.id === audit.metadata?.id,
            );
            if (exists) {
              console.log(
                `ℹ️ Audit ${audit.metadata?.auditNumber} già esistente, aggiornato`,
              );
              return prev.map((a) =>
                a.metadata?.id === audit.metadata?.id ? audit : a,
              );
            }
            return [...prev, audit];
          });
        }

        console.log(
          `✅ Import completato: ${backupData.audits.length} audit ripristinati`,
        );
        return { success: true, count: backupData.audits.length };
      } catch (err) {
        console.error("❌ Errore import backup:", err);
        setError(err.message);
        return { success: false, error: err.message };
      }
    },
    [fsProvider],
  );

  /**
   * Elimina audit — async, bloccante: prima elimina dal server, poi dall'IndexedDB, poi dallo stato.
   * Non usa la sync queue per il delete: troppo fire-and-forget, il server non veniva raggiunto
   * in modo affidabile prima di eventuali page refresh.
   */
  const deleteAudit = useCallback(
    async (auditId) => {
      const audit = audits.find((a) => {
        const id = a.metadata?.id || a.id;
        return id === auditId;
      });
      if (!audit) {
        console.warn(`⚠️ Audit not found for deletion: ${auditId}`);
        return false;
      }

      // Segna come appena eliminato: il reconcile NON dovrà ripristinarlo.
      recentlyDeletedRef.current.add(auditId);

      // 1. Elimina dal server direttamente (bloccante) per garantire la persistenza.
      //    Se offline, accoda per retry futuro.
      if (navigator.onLine) {
        try {
          await apiService.deleteAudit(auditId);
          console.log(`✅ [DELETE] Server: audit ${auditId} eliminato`);
        } catch (err) {
          if (err?.status === 404) {
            // Già eliminato lato server — procediamo comunque a pulire locale.
            console.warn(`⚠️ [DELETE] Server: audit ${auditId} non trovato (già eliminato)`);
          } else {
            // Errore reale: rollback del flag e propagazione.
            recentlyDeletedRef.current.delete(auditId);
            console.error("❌ [DELETE] Errore eliminazione server:", err);
            throw err;
          }
        }
      } else {
        // Offline: accoda per sync alla riconnessione.
        syncService.enqueue("delete_audit", { auditId }).catch((err) => {
          console.error("❌ [SYNC] Errore enqueue delete offline:", err);
        });
      }

      // Tombstone persistente: sopravvive ai page refresh e protegge reconcile.
      addToTombstone(auditId);

      // 1b. Rimuovi dalla sync queue tutte le operazioni ancora pendenti per questo audit
      // (save_responses usa payload.auditId = UUID — prima non matchava clearQueueForStaleAudits).
      try {
        const serverNum = audit?.metadata?.auditId ?? audit?.audit_id;
        const n = Number(serverNum);
        const auditIds =
          Number.isFinite(n) && n > 0 ? [n] : [];
        await syncService.clearQueueForStaleAudits({
          auditUuids: [String(auditId)],
          auditIds,
        });
      } catch {
        /* non bloccante */
      }

      // 2. Rimuovi da IndexedDB (atteso: elimina fisicamente dal browser).
      if (fsProvider && typeof fsProvider.deleteAudit === "function") {
        await fsProvider.deleteAudit(auditId).catch((err) => {
          console.error("❌ [DELETE] Errore rimozione da IndexedDB:", err);
        });
      }

      // 3. Rimuovi da React state.
      setAudits((prevAudits) =>
        prevAudits.filter((a) => {
          const id = a.metadata?.id || a.id;
          return id !== auditId;
        }),
      );

      // 4. Dopo la cancellazione torna sempre allo stato vuoto per conferma visiva.
      if (auditId === currentAuditId) {
        setCurrentAuditId(null);
      }

      // 5. Pulisci localStorage.
      localStorage.removeItem(`audit_${auditId}`);

      console.log(`✅ Deleted audit: ${audit.metadata?.auditNumber || auditId}`);
      return true;
    },
    [audits, currentAuditId, fsProvider],
  );

  /**
   * Inizializza checklist per una norma specifica (SYNC - template copy)
   * @param {string} standard - ISO_9001, ISO_14001, ISO_45001
   * @returns {boolean} true se inizializzata con successo
   */
  const initializeChecklist = useCallback(
    (standard = "ISO_9001") => {
      if (!currentAudit) {
        console.warn("⚠️ No current audit to initialize checklist");
        return false;
      }

      // Mappa standard code → standard_id (allineata con tabella DB standards)
      const standardIdMap = {
        ISO_9001:        1,
        ISO_9001_2015:   1,
        ISO_14001:       2,
        ISO_14001_2015:  2,
        ISO_45001:       3,
        ISO_45001_2018:  3,
        ISO_3834:        6,
        ISO_3834_2:      6,
        ISO_3834_2_2021: 6,
        RDP_MSN:         7,
      };

      const standardId = standardIdMap[standard];
      if (!standardId) {
        console.warn(`⚠️ Standard ${standard} not recognized`);
        return false;
      }

      // Verifica se checklist già inizializzata
      if (
        currentAudit.checklist?.[standard] &&
        Object.keys(currentAudit.checklist[standard]).length > 0
      ) {
        console.log(`ℹ️ Checklist ${standard} già inizializzata`);
        return true;
      }

      // STRATEGIA: Copia sincrona del template (no fetch, no race conditions)
      const template = getChecklistTemplate(standardId);
      
      if (!template || !template.sections || template.sections.length === 0) {
        console.error(`❌ Template ${standard} non disponibile`);
        return false;
      }

      console.log(`[StorageContext] Copiando template ${standard} (${template.sections.reduce((sum, s) => sum + s.questions.length, 0)} domande)...`);

      // Deep copy del template (importante!)
      const templateCopy = JSON.parse(JSON.stringify(template.sections));

      // Converti struttura sections[].questions[] → clauseObj{} per retrocompatibilità
      const checklistObj = {};
      let totalQuestions = 0;

      templateCopy.forEach((section) => {
        const clauseId = section.sectionCode; // Es: "clause4"
        
        checklistObj[clauseId] = {
          id: clauseId,
          title: section.sectionTitle,
          questions: section.questions.map((q, idx) => ({
            id: `q${section.sectionCode}_${idx + 1}`,
            title: q.questionText,
            text: q.questionText,
            questionId: q.questionId,
            displayOrder: q.displayOrder ?? idx + 1,
            // clauseRef: usa il valore esplicito dal template (norma ISO), altrimenti auto-generato
            clauseRef: q.clauseRef || (q.displayOrder ? String(q.displayOrder) : `${section.sectionCode}.${idx + 1}`),
            // Inizializza risposta vuota
            status: "NOT_ANSWERED",
            score: null,
            notes: "",
            evidence: [],
            evidenceUrls: []
          }))
        };
        
        totalQuestions += section.questions.length;
      });

      // Aggiorna audit con checklist copiata.
      // skipSync=true SEMPRE: initializeChecklist crea solo la struttura locale (template vuoto).
      // Le risposte reali arrivano da fetchAndApplyServerResponses (chiamata subito dopo in
      // AuditAccordionLayout) oppure dalle modifiche esplicite dell'utente.
      // Non accodare MAI save_responses con NOT_ANSWERED — sovrascriverebbero i dati sul server.
      updateCurrentAudit((audit) => {
        const updatedAudit = { ...audit };

        if (!updatedAudit.checklist) {
          updatedAudit.checklist = {};
        }

        updatedAudit.checklist[standard] = checklistObj;
        updatedAudit.metadata.lastModified = new Date().toISOString();
        updatedAudit.metrics.totalQuestions = totalQuestions;

        return updatedAudit;
      }, { skipSync: true });

      console.log(
        `✅ Checklist ${standard} inizializzata da template (${totalQuestions} domande)`,
      );
      return true;
    },
    [currentAudit, updateCurrentAudit],
  );

  /**
   * Idrata questionId nelle domande della checklist da backend (per standard 6, 7).
   * Necessario per allegati e risposte: il backend richiede question_id INTEGER.
   * Chiamata dopo initializeChecklist quando le domande hanno questionId: null.
   */
  const hydrateQuestionIds = useCallback(
    async (standardKey) => {
      const STANDARD_ID_MAP = { ISO_3834_2: 6, RDP_MSN: 7 };
      const standardId = STANDARD_ID_MAP[standardKey];
      if (!standardId || !navigator.onLine) return;
      try {
        const res = await apiService.get(`/checklist/questions/all?standard_id=${standardId}`);
        const questions = res?.questions || res?.data?.questions || [];
        if (questions.length === 0) return;
        const bySection = {};
        questions.forEach((q) => {
          const key = q.section_code;
          if (!bySection[key]) bySection[key] = [];
          bySection[key].push({ question_id: q.question_id, order: q.question_order });
        });
        Object.keys(bySection).forEach((k) =>
          bySection[k].sort((a, b) => (a.order || 0) - (b.order || 0))
        );
        updateCurrentAudit((audit) => {
          const checklist = audit.checklist?.[standardKey];
          if (!checklist) return audit;
          const updated = JSON.parse(JSON.stringify(audit));
          const oldIdToNewId = {};
          Object.entries(updated.checklist[standardKey]).forEach(([clauseKey, clause]) => {
            if (!clause?.questions) return;
            const arr = bySection[clauseKey] || [];
            clause.questions = clause.questions.map((q, qIdx) => {
              const oldId = q.id || `q${clauseKey}_${qIdx + 1}`;
              if (q.questionId != null) return q;
              const match = arr[qIdx];
              if (!match) return q;
              oldIdToNewId[oldId] = match.question_id;
              return { ...q, questionId: match.question_id };
            });
          });
          // Migra allegati con vecchio questionId stringa → numerico
          if (updated.attachments?.length && Object.keys(oldIdToNewId).length) {
            updated.attachments = updated.attachments.map((att) => {
              const newId = oldIdToNewId[att.questionId] ?? oldIdToNewId[att.questionRef];
              if (newId != null) {
                return { ...att, questionId: newId, questionRef: att.questionId };
              }
              return att;
            });
          }
          return updated;
        });
        console.log(`✅ [HYDRATE] questionIds idratati per ${standardKey} (${questions.length} domande)`);
      } catch (e) {
        console.warn(`[HYDRATE] questionIds per ${standardKey}:`, e.message);
      }
    },
    [updateCurrentAudit]
  );

  /**
   * Carica le risposte salvate sul server e le applica alla checklist corrente.
   * Chiamata da ChecklistModule dopo initializeChecklist.
   * @param {number} numericAuditId - audit_id INTEGER dal server (metadata.auditId)
   */
  const fetchAndApplyServerResponses = useCallback(
    async (numericAuditId) => {
      if (!numericAuditId) return;
      if (!navigator.onLine) {
        console.log("📴 [HYDRATE] Offline — risposte non scaricate dal server");
        setServerDataStatus('error');
        return;
      }

      // Bug 2: debounce — non rieseguire se già eseguita nell'ultimo minuto per lo stesso audit
      const lastRun = fetchAndApplyLastRunRef.current[numericAuditId];
      if (lastRun && Date.now() - lastRun < 60000) {
        console.log(`⏭️ [HYDRATE] Già eseguita per audit ${numericAuditId} nell'ultimo minuto — skip`);
        // I dati erano già stati caricati: porta il banner a 'ready' invece di lasciarlo in 'loading'
        setServerDataStatus('ready');
        return;
      }
      fetchAndApplyLastRunRef.current[numericAuditId] = Date.now();

      try {
        isHydratingRef.current = true;
        setServerDataStatus('loading');
        console.log(`🔄 [HYDRATE] Carico risposte server per audit ${numericAuditId}...`);
        const result = await apiService.getAuditResponses(numericAuditId);
        const rows = result?.data;
        if (!rows || rows.length === 0) {
          console.log(`ℹ️ [HYDRATE] Nessuna risposta trovata per audit ${numericAuditId}`);
          return;
        }

        // Map question_id → {status, notes}
        const responseMap = {};
        rows.forEach((r) => {
          if (r.question_id) {
            responseMap[r.question_id] = {
              status: r.conformity_status || "NOT_ANSWERED",
              notes: r.notes || "",
            };
          }
        });

        console.log(`✅ [HYDRATE] Applico ${Object.keys(responseMap).length} risposte alla checklist`);

        updateCurrentAudit((audit) => {
          const updatedAudit = JSON.parse(JSON.stringify(audit));
          const checklist = updatedAudit.checklist;
          if (!checklist) return audit;

          let applied = 0;
          Object.values(checklist).forEach((normData) => {
            if (!normData || typeof normData !== "object") return;
            Object.values(normData).forEach((clauseData) => {
              if (!clauseData.questions) return;
              clauseData.questions = clauseData.questions.map((q) => {
                if (q.questionId && responseMap[q.questionId]) {
                  applied++;
                  const serverData = responseMap[q.questionId];
                  // Bug 2: non sovrascrivere note già digitate dall'utente con quelle server.
                  // Applica le note del server solo se il campo locale è vuoto/assente.
                  const mergedNotes =
                    q.notes && q.notes.trim() !== ""
                      ? q.notes
                      : serverData.notes || "";
                  return { ...q, status: serverData.status, notes: mergedNotes };
                }
                return q;
              });
            });
          });

          console.log(`✅ [HYDRATE] Applicate ${applied}/${rows.length} risposte`);
          return updatedAudit;
        });
        setServerDataStatus('ready');
      } catch (err) {
        console.warn("⚠️ [HYDRATE] Errore caricamento risposte server:", err.message);
        setServerDataStatus('error');
      } finally {
        isHydratingRef.current = false;
      }
    },
    [updateCurrentAudit],
  );

  // Registra reference globale per useEffect
  useEffect(() => {
    window.__initializeChecklistRef = initializeChecklist;
    return () => {
      delete window.__initializeChecklistRef;
    };
  }, [initializeChecklist]);

  // Ascolta evento di assegnazione auditId numerico DB post-sync
  // Emesso da syncService.js dopo il primo upsert riuscito
  useEffect(() => {
    const handleAuditIdAssigned = (e) => {
      const { uuid, auditId } = e.detail || {};
      if (!uuid || !auditId) return;
      setAudits((prev) =>
        prev.map((a) => {
          const id = a.metadata?.id || a.id;
          if (id !== uuid) return a;
          if (a.metadata?.auditId === auditId) return a; // già aggiornato
          console.log(`[StorageContext] auditId numerico assegnato: ${uuid} → ${auditId}`);
          return { ...a, metadata: { ...a.metadata, auditId } };
        })
      );
    };
    window.addEventListener('sgq:auditIdAssigned', handleAuditIdAssigned);
    return () => window.removeEventListener('sgq:auditIdAssigned', handleAuditIdAssigned);
  }, []);

  /**
   * Reset a mock data (per testing)
   */
  const resetToMockData = useCallback(() => {
    setAudits(MOCK_AUDITS);
    const firstAuditId =
      MOCK_AUDITS[0]?.metadata?.id || MOCK_AUDITS[0]?.id || null;
    setCurrentAuditId(firstAuditId);
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

  /**
   * Forza sync manuale
   */
  const triggerManualSync = useCallback(async () => {
    if (!navigator.onLine) {
      console.warn("⚠️ [SYNC] Impossibile sincronizzare: offline");
      return { success: false, error: "Offline" };
    }

    try {
      setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
      await syncService.processQueue();
      await reconcileAuditsFromServer({ processQueueFirst: false });
      const queueSize = await syncService.getActiveQueueSize();
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        queueSize,
        lastSync: new Date().toISOString(),
      }));
      console.log("✅ [SYNC] Sync manuale completata");
      return { success: true, queueSize };
    } catch (error) {
      console.error("❌ [SYNC] Errore sync manuale:", error);
      setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
      return { success: false, error: error.message };
    }
  }, [reconcileAuditsFromServer]);

  /**
   * Svuota la cache locale (IndexedDB) e risincronizza dal server.
   * Utile quando il menu a tendina mostra audit obsoleti o duplicati
   * che non esistono più sul server.
   */
  const forceClearLocalCache = useCallback(async () => {
    if (!navigator.onLine) {
      return { success: false, error: 'Offline: impossibile risincronizzare' };
    }
    try {
      setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
      if (fsProvider && typeof fsProvider.clearAuditsStore === 'function') {
        await fsProvider.clearAuditsStore();
        console.log('🧹 [CACHE] IndexedDB svuotato');
      }
      // Rimuovi tombstone stantio per ripartire da zero
      try { localStorage.removeItem(TOMBSTONE_KEY); } catch {}
      // Ricarica solo da server
      await reconcileAuditsFromServer({ processQueueFirst: false });
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastSync: new Date().toISOString(),
      }));
      console.log('✅ [CACHE] Cache locale ripulita e risincronizzata');
      return { success: true };
    } catch (error) {
      console.error('❌ [CACHE] Errore durante pulizia cache:', error);
      setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
      return { success: false, error: error.message };
    }
  }, [fsProvider, reconcileAuditsFromServer]);

  /**
   * Risolvi conflitto manualmente (scelta utente)
   */
  const resolveConflict = useCallback((choice) => {
    if (choice === "keep_local") {
      // Mantieni versione locale, forza upload
      console.log("🔧 [CONFLICT] Utente sceglie: mantieni locale");
      // TODO: Implementare force push
    } else if (choice === "use_server") {
      // Scarica versione server, sovrascrivi locale
      console.log("🔧 [CONFLICT] Utente sceglie: usa server");
      // TODO: Implementare download + overwrite locale
    }

    // Chiudi dialog
    setSyncStatus((prev) => ({
      ...prev,
      hasConflict: false,
      conflictData: null,
    }));
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
    setFsConnected,

    // Provider
    fsProvider,
    deviceInfo,

    // Save status
    isSaving,
    allSaved,
    auditSaveStatus,
    listSaveStatus,

    // Sync status
    syncStatus,
    triggerManualSync,
    forceClearLocalCache,
    resolveConflict,

    // Stato caricamento dati server per audit corrente: 'idle' | 'loading' | 'ready' | 'error'
    serverDataStatus,
    setServerDataStatus,

    // Lock audit (server)
    auditLock,
    isAuditReadOnly: auditLock.mode === "foreign",
    refreshAuditLock,

    // CRUD operations
    updateCurrentAudit,
    switchAudit,
    deselectAudit: () => setCurrentAuditId(null),
    createAudit,
    duplicateAudit,
    deleteAudit,
    initializeChecklist,
    hydrateQuestionIds,
    fetchAndApplyServerResponses,
    importBackup,

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
