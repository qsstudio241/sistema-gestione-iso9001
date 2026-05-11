/**
 * Banner lock audit: avvisa quando un altro utente ha il lock o in attesa server.
 */

import React from "react";
import { useStorage } from "../contexts/StorageContext";
import "./AuditLockBanner.css";

export default function AuditLockBanner() {
  const { auditLock, refreshAuditLock, currentAudit } = useStorage();

  if (!currentAudit) return null;
  if (auditLock.mode === "none" || auditLock.mode === "owner") return null;

  return (
    <div
      className={`audit-lock-banner mode-${auditLock.mode}`}
      role="alert"
      aria-live="polite"
    >
      <div className="audit-lock-banner-inner">
        <span className="audit-lock-banner-icon" aria-hidden>
          {auditLock.mode === "foreign" ? "🔒" : "⏳"}
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
              <p>{auditLock.message}</p>
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
