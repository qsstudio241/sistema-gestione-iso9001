/**
 * SYNC-3 — Banner merge dati + notifica recovery storage automatica.
 *
 * Gestisce due eventi:
 * - sgq:auditMerged: mostra avviso merge field-level (solo con audit aperto)
 * - sgq:storageRecovered: mostra avviso pulizia automatica cache (sempre visibile)
 */

import React, { useState, useEffect, useCallback } from "react";
import { useStorage } from "../contexts/StorageContext";
import "./SyncMergeBanner.css";

export default function SyncMergeBanner() {
  const { currentAudit } = useStorage();
  const [visible, setVisible] = useState(false);
  const [mergeInfo, setMergeInfo] = useState(null);
  const [storageRecovery, setStorageRecovery] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    setMergeInfo(null);
  }, []);

  const dismissRecovery = useCallback(() => {
    setStorageRecovery(false);
  }, []);

  useEffect(() => {
    let autoHideTimer = null;

    function handleMerge(e) {
      setMergeInfo(e.detail || {});
      setVisible(true);
      clearTimeout(autoHideTimer);
      autoHideTimer = setTimeout(() => {
        setVisible(false);
        setMergeInfo(null);
      }, 10000);
    }

    window.addEventListener("sgq:auditMerged", handleMerge);
    return () => {
      window.removeEventListener("sgq:auditMerged", handleMerge);
      clearTimeout(autoHideTimer);
    };
  }, []);

  useEffect(() => {
    let recoveryTimer = null;

    function handleStorageRecovered() {
      setStorageRecovery(true);
      recoveryTimer = setTimeout(() => setStorageRecovery(false), 8000);
    }

    window.addEventListener("sgq:storageRecovered", handleStorageRecovered);
    return () => {
      window.removeEventListener("sgq:storageRecovered", handleStorageRecovered);
      clearTimeout(recoveryTimer);
    };
  }, []);

  return (
    <>
      {storageRecovery && (
        <div className="sync-merge-banner sync-merge-banner--info" role="status" aria-live="polite">
          <div className="sync-merge-banner-inner">
            <span className="sync-merge-banner-icon" aria-hidden>🔄</span>
            <div className="sync-merge-banner-text">
              <strong>Cache locale ripristinata automaticamente</strong>
              <p>Lo spazio sul dispositivo era quasi pieno. I dati degli audit vengono ricaricati dal server.</p>
            </div>
            <button type="button" className="sync-merge-banner-close" onClick={dismissRecovery} aria-label="Chiudi">✕</button>
          </div>
        </div>
      )}

      {visible && currentAudit && (
        <div className="sync-merge-banner" role="status" aria-live="polite">
          <div className="sync-merge-banner-inner">
            <span className="sync-merge-banner-icon" aria-hidden>✅</span>
            <div className="sync-merge-banner-text">
              <strong>Dati salvati — merge automatico applicato</strong>
              <p>
                Il server aveva una versione più aggiornata dell&apos;audit. Le tue
                modifiche sono state integrate automaticamente. Verifica note e
                conclusioni per confermare che siano corrette.
              </p>
            </div>
            <button type="button" className="sync-merge-banner-close" onClick={dismiss} aria-label="Chiudi avviso">✕</button>
          </div>
        </div>
      )}
    </>
  );
}
