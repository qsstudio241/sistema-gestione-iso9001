import React from "react";
import { Link } from "../contexts/RouterContext";
import { buildLibraryGapPath } from "../utils/libraryGapDeepLink";

/**
 * Blocco gap fonti (LG-1 + LG-2) — solo per il tenant che ha chiesto.
 * Evidenzia lacune + note qualità; CTA deep-link Libreria (tenant vs piattaforma).
 */
export default function AiAssistantSourceGaps({ gaps }) {
  const list = Array.isArray(gaps) ? gaps.filter((g) => g && g.code) : [];
  if (!list.length) return null;

  return (
    <div className="ai-source-gaps" role="region" aria-label="Fonti mancanti">
      <p className="ai-source-gaps__title">
        Fonti mancanti per una risposta più affidabile
      </p>
      <p className="ai-source-gaps__confirm" role="status">
        Richiesta registrata per il tuo studio. I dettagli restano solo nella
        tua sessione e in Libreria.
      </p>
      <ul className="ai-source-gaps__list">
        {list.map((g) => {
          const isTenant = g.closurePath === "tenant";
          const href = buildLibraryGapPath({
            code: g.code,
            closurePath: isTenant ? "tenant" : "platform",
            prefill: true,
          });
          const ctaLabel = isTenant
            ? "Vai in Libreria — carica documento"
            : "Vai in Libreria — vedi richiesta";
          return (
            <li key={g.id || g.code} className="ai-source-gaps__item">
              <div className="ai-source-gaps__item-head">
                <strong>{g.code}</strong>
                {g.title ? ` — ${g.title}` : ""}
                <span
                  className={
                    isTenant
                      ? "ai-source-gaps__badge ai-source-gaps__badge--tenant"
                      : "ai-source-gaps__badge ai-source-gaps__badge--platform"
                  }
                >
                  {isTenant ? "Via tenant (ingest)" : "Via piattaforma"}
                </span>
              </div>
              {g.reason ? (
                <div className="ai-source-gaps__reason">{g.reason}</div>
              ) : null}
              {g.qualityNotes ? (
                <div className="ai-source-gaps__quality">
                  Qualità / dubbi: {g.qualityNotes}
                </div>
              ) : null}
              <div className="ai-source-gaps__path">
                {isTenant
                  ? "Puoi colmare caricando il documento nella Libreria del tuo studio (via tenant)."
                  : "Richiesta inviata ai superadmin per digitalizzazione piattaforma (Cursor)."}
              </div>
              <Link to={href} className="ai-source-gaps__cta">
                {ctaLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
