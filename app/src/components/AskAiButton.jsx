/**
 * AskAiButton — pulsante «Chiedi all'AI» riutilizzabile su qualunque modulo.
 *
 * Rendere null se la licenza ai_chat non è attiva: nessun fallback UI,
 * nessun errore. Il chiamante non deve gestire la condizione.
 *
 * Props:
 *   onBeforeNavigate  () => void  — salva il contesto specifico del modulo
 *                                   (clausola checklist, NC, qualifica, …)
 *                                   prima di navigare a /ai-assistant.
 *   label             string      — testo pulsante (default: «Chiedi all'AI»)
 *   className         string      — classe CSS aggiuntiva opzionale
 */

import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "../contexts/RouterContext";
import { hasLicensedModule } from "../utils/licenseUtils";
import "./AskAiButton.css";

export default function AskAiButton({
  onBeforeNavigate,
  label = "Chiedi all\u2019AI",
  className = "",
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!hasLicensedModule(user, "ai_chat")) return null;

  function handleClick() {
    onBeforeNavigate?.();
    navigate("/ai-assistant");
  }

  return (
    <button
      type="button"
      className={`ask-ai-btn${className ? ` ${className}` : ""}`}
      onClick={handleClick}
      title={label}
    >
      <span className="ask-ai-btn__icon" aria-hidden="true">{"\uD83E\uDD16"}</span>
      <span className="ask-ai-btn__label">{label}</span>
    </button>
  );
}
