/**
 * SYNC-3 — Banner merge dati.
 *
 * Mostra un avviso discreto quando il backend ha applicato un field-level merge
 * (cioè ha rilevato un conflict di timestamp ma ha preservato i dati del client
 * invece di restituire un 409 hard).
 *
 * L'utente vede: "I tuoi dati sono stati salvati. Il server aveva una versione
 * più recente — le tue modifiche sono state integrate automaticamente."
 *
 * Il banner è NON bloccante: scompare dopo 10 secondi o al click su "Chiudi".
 * Non appare se non c'è un audit corrente aperto (non disturba navigazione generale).
 */

import React, { useState, useEffect, useCallback } from "react";
import { useStorage } from "../contexts/StorageContext";
import "./SyncMergeBanner.css";

export default function SyncMergeBanner() {
  const { currentAudit } = useStorage();
  const [visible, setVisible] = useState(false);
  const [mergeInfo, setMergeInfo] = useState(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    setMergeInfo(null);
  }, []);

  useEffect(() => {
    let autoHideTimer = null;

    function handleMerge(e) {
      // Mostra solo se c'è un audit aperto (l'utente è in contesto di lavoro)
      setMergeInfo(e.detail || {});
      setVisible(true);

      // Auto-dismiss dopo 10 secondi
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

  if (!visible || !currentAudit) return null;

  return (
    <div className="sync-merge-banner" role="status" aria-live="polite">
      <div className="sync-merge-banner-inner">
        <span className="sync-merge-banner-icon" aria-hidden>
          ✅
        </span>
        <div className="sync-merge-banner-text">
          <strong>Dati salvati — merge automatico applicato</strong>
          <p>
            Il server aveva una versione più aggiornata dell&apos;audit. Le tue
            modifiche sono state integrate automaticamente. Verifica note e
            conclusioni per confermare che siano corrette.
          </p>
        </div>
        <button
          type="button"
          className="sync-merge-banner-close"
          onClick={dismiss}
          aria-label="Chiudi avviso"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
