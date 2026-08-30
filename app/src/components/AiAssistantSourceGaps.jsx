import React from "react";
import { Link } from "../contexts/RouterContext";

/**
 * Blocco gap fonti (LG-1) — solo per il tenant che ha chiesto.
 * Evidenzia lacune + note qualità; link a Gestione → Libreria.
 */
export default function AiAssistantSourceGaps({ gaps }) {
  const list = Array.isArray(gaps) ? gaps.filter((g) => g && g.code) : [];
  if (!list.length) return null;

  return (
    <div className="ai-source-gaps" role="region" aria-label="Fonti mancanti">
      <p className="ai-source-gaps__title">
        Fonti mancanti per una risposta più affidabile
      </p>
      <ul className="ai-source-gaps__list">
        {list.map((g) => (
          <li key={g.id || g.code} className="ai-source-gaps__item">
            <strong>{g.code}</strong>
            {g.title ? ` — ${g.title}` : ""}
            {g.reason ? <div className="ai-source-gaps__reason">{g.reason}</div> : null}
            {g.qualityNotes ? (
              <div className="ai-source-gaps__quality">
                Qualità / dubbi: {g.qualityNotes}
              </div>
            ) : null}
            <div className="ai-source-gaps__path">
              {g.closurePath === "tenant"
                ? "Puoi colmare caricando il documento in Libreria (via tenant)."
                : "Richiesta inviata ai superadmin per digitalizzazione piattaforma (Cursor)."}
            </div>
          </li>
        ))}
      </ul>
      <Link to="/settings/libreria" className="ai-source-gaps__cta">
        Apri Libreria
      </Link>
    </div>
  );
}
