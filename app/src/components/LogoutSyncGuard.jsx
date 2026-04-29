/**
 * SYNC-4 — Guard sincronizzazione pre-logout.
 *
 * Mostra un modal quando l'utente tenta il logout con operazioni non ancora
 * sincronizzate con il server. Offre tre opzioni:
 *
 *   1. "Attendi sincronizzazione" — lancia un processQueue() e aspetta il
 *      completamento, poi esegue il logout automaticamente.
 *   2. "Esci comunque" — l'utente accetta consapevolmente il rischio di
 *      perdere le modifiche locali non sincronizzate.
 *   3. "Annulla" (o chiude il modal) — torna all'app senza fare logout.
 *
 * Comunicazione con AuthContext tramite eventi custom:
 *   - Ascolta:  sgq:logoutRequested  { pendingCount, isOnline }
 *   - Emette:   sgq:logoutConfirmed  (procedi con logout)
 *   - Emette:   sgq:logoutCancelled  (annulla logout)
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { syncService } from "../services/syncService";
import "./LogoutSyncGuard.css";

export default function LogoutSyncGuard() {
  const [visible, setVisible] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const syncingRef = useRef(false);

  const confirm = useCallback(() => {
    setVisible(false);
    setSyncing(false);
    setSyncDone(false);
    window.dispatchEvent(new CustomEvent("sgq:logoutConfirmed"));
  }, []);

  const cancel = useCallback(() => {
    if (syncingRef.current) return; // non cancellare durante sync attiva
    setVisible(false);
    setSyncing(false);
    setSyncDone(false);
    window.dispatchEvent(new CustomEvent("sgq:logoutCancelled"));
  }, []);

  const waitAndLogout = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);

    try {
      await syncService.processQueue();
      // Rivaluta la coda dopo il tentativo
      const remaining = await syncService.getActiveQueueSize().catch(() => 0);
      if (remaining === 0) {
        setSyncDone(true);
        // Logout automatico dopo 1.5s per dare feedback visivo
        setTimeout(() => confirm(), 1500);
      } else {
        // Sync non completata (es. errori di rete): mostra opzione esci comunque
        setSyncing(false);
        setPendingCount(remaining);
      }
    } catch {
      setSyncing(false);
    } finally {
      syncingRef.current = false;
    }
  }, [confirm]);

  useEffect(() => {
    function handleLogoutRequested(e) {
      const { pendingCount: count, isOnline: online } = e.detail || {};
      setPendingCount(count || 0);
      setIsOnline(online !== false);
      setSyncing(false);
      setSyncDone(false);
      syncingRef.current = false;
      setVisible(true);
    }
    window.addEventListener("sgq:logoutRequested", handleLogoutRequested);
    return () => window.removeEventListener("sgq:logoutRequested", handleLogoutRequested);
  }, []);

  if (!visible) return null;

  return (
    <div className="logout-sync-guard-overlay" role="dialog" aria-modal="true" aria-labelledby="lsg-title">
      <div className="logout-sync-guard-modal">
        <div className="logout-sync-guard-icon" aria-hidden>
          {syncDone ? "✅" : syncing ? "⏳" : "⚠️"}
        </div>

        <h2 className="logout-sync-guard-title" id="lsg-title">
          {syncDone
            ? "Sincronizzazione completata"
            : syncing
            ? "Sincronizzazione in corso..."
            : "Dati non ancora salvati sul server"}
        </h2>

        {!syncing && !syncDone && (
          <p className="logout-sync-guard-body">
            {isOnline ? (
              <>
                Ci sono ancora <strong>{pendingCount}</strong>{" "}
                {pendingCount === 1 ? "operazione" : "operazioni"} non sincronizzate
                con il server. Se esci ora, le modifiche non ancora inviate potrebbero
                andare perse.
              </>
            ) : (
              <>
                Sei offline. Ci sono <strong>{pendingCount}</strong>{" "}
                {pendingCount === 1 ? "operazione" : "operazioni"} in attesa di essere
                sincronizzate. Verranno inviate automaticamente alla prossima connessione,
                ma se esci ora e il browser libera la memoria locale andranno perse.
              </>
            )}
          </p>
        )}

        {syncing && !syncDone && (
          <p className="logout-sync-guard-body">
            Sto inviando le modifiche al server, attendere...
          </p>
        )}

        {syncDone && (
          <p className="logout-sync-guard-body">
            Tutte le modifiche sono state salvate. Uscita in corso...
          </p>
        )}

        {!syncing && !syncDone && (
          <div className="logout-sync-guard-actions">
            {isOnline && (
              <button
                type="button"
                className="logout-sync-guard-btn primary"
                onClick={waitAndLogout}
              >
                Attendi sincronizzazione
              </button>
            )}
            <button
              type="button"
              className="logout-sync-guard-btn danger"
              onClick={confirm}
            >
              Esci comunque
            </button>
            <button
              type="button"
              className="logout-sync-guard-btn secondary"
              onClick={cancel}
            >
              Annulla
            </button>
          </div>
        )}

        {syncing && !syncDone && (
          <div className="logout-sync-guard-actions">
            <div className="logout-sync-guard-spinner" aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}
