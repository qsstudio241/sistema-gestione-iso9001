/**
 * Banner lock audit: avvisa quando un altro utente ha il lock o in attesa server.
 * CONS-2: in offline integra l'avviso di non aprire lo stesso audit dal PC.
 */

import React from "react";
import { useStorage } from "../contexts/StorageContext";
import "./AuditLockBanner.css";

/** Avviso CONS-2: il lavoro resta su questo dispositivo finché la sync non è fatta. */
export const OFFLINE_PC_WARNING =
  "Il lavoro resta su QUESTO telefono. NON aprire lo stesso audit dal PC finché non torna la rete e la sincronizzazione è completata.";

export function buildOfflineBannerMessage(serverMessage) {
  const base = typeof serverMessage === "string" ? serverMessage.trim() : "";
  if (base.includes("stesso audit dal PC")) {
    return base;
  }
  return [base, OFFLINE_PC_WARNING].filter(Boolean).join(" ");
}

export default function AuditLockBanner() {
  const { auditLock, refreshAuditLock, currentAudit } = useStorage();

  if (!currentAudit) return null;
  if (auditLock.mode === "none" || auditLock.mode === "owner") return null;

  const lockIcon =
    auditLock.mode === "foreign" ? "\uD83D\uDD12" : "\u23F3";

  return (
    <div
      className={`audit-lock-banner mode-${auditLock.mode}`}
      role="alert"
      aria-live="polite"
    >
      <div className="audit-lock-banner-inner">
        <span className="audit-lock-banner-icon" aria-hidden>
          {lockIcon}
        </span>
        <div className="audit-lock-banner-text">
          {auditLock.mode === "foreign" && (
            <>
              <strong>Sola lettura</strong>
              <p>
                L&apos;audit è in modifica da{" "}
                <strong>{auditLock.lockedByName || "un altro utente"}</strong>.
                Le modifiche non verranno salvate sul server.
              </p>
            </>
          )}
          {auditLock.mode === "pending_server" && (
            <>
              <strong>Sincronizzazione in corso</strong>
              <p>{auditLock.message}</p>
            </>
          )}
          {auditLock.mode === "offline" && (
            <>
              <strong>Offline</strong>
              <p>{buildOfflineBannerMessage(auditLock.message)}</p>
            </>
          )}
          {auditLock.mode === "error" && (
            <>
              <strong>Lock non disponibile</strong>
              <p>{auditLock.message}</p>
            </>
          )}
        </div>
        {(auditLock.mode === "foreign" || auditLock.mode === "error") && (
          <button
            type="button"
            className="audit-lock-banner-retry"
            onClick={() => refreshAuditLock()}
          >
            Riprova lock
          </button>
        )}
      </div>
    </div>
  );
}
