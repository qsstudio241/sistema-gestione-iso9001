/**
 * Payload e storia UI per «Chiedi all'AI» sulla domanda (Fase 1).
 * Solo norma / clausola / testo / esito / note — niente anagrafica cliente né allegati.
 */
import { getStandardByCode, getStandardByKey } from "../data/standardsRegistry";

export const SUGGEST_QUESTIONS_MODE = "suggest_questions";
export const AI_PANEL_HISTORY_KEY = "sgqQuestionAiPanel";

/**
 * Codice norma utile al RAG (preferisce la variante con anno).
 * @param {string|null|undefined} checklistKey
 */
function pickYearQualifiedCode(codes) {
  if (!Array.isArray(codes)) return null;
  for (const raw of codes) {
    const s = String(raw);
    const last = s.split("_").pop();
    const year = Number(last);
    if (last && last.length === 4 && year >= 1990 && year <= 2100) return s;
  }
  return null;
}

export function resolveStandardCodeForQuestionAi(checklistKey) {
  if (!checklistKey || checklistKey === "custom") return null;
  const entry = getStandardByKey(checklistKey) || getStandardByCode(checklistKey);
  if (!entry) return String(checklistKey);
  return pickYearQualifiedCode(entry.codes) || entry.codes?.[0] || entry.key || String(checklistKey);
}

/**
 * @param {string|null|undefined} checklistKey
 */
export function resolveStandardLabelForQuestionAi(checklistKey) {
  if (!checklistKey || checklistKey === "custom") return "";
  const entry = getStandardByKey(checklistKey) || getStandardByCode(checklistKey);
  return entry?.shortLabel || entry?.label || "";
}

/**
 * Body per POST /ai/question-assistant (mode suggest_questions).
 * @param {object} question
 * @param {{ standardCode?: string, standardLabel?: string }} [extras]
 */
export function buildSuggestQuestionsPayload(question = {}, extras = {}) {
  const rawCode =
    extras.standardCode || question.standardCode || question.checklistKey || null;
  const standardCode =
    resolveStandardCodeForQuestionAi(rawCode) || rawCode || "ISO_9001_2015";
  const standardLabel =
    extras.standardLabel ||
    question.standardLabel ||
    resolveStandardLabelForQuestionAi(rawCode || standardCode);

  return {
    mode: SUGGEST_QUESTIONS_MODE,
    question: {
      id: question.id != null ? String(question.id).slice(0, 80) : undefined,
      text: String(question.text || "").slice(0, 2000),
      clauseRef: String(question.clauseRef || "").slice(0, 80),
      standardCode: String(standardCode).slice(0, 80),
      standardLabel: String(standardLabel || "").slice(0, 80),
      currentStatus: String(question.status || question.currentStatus || "").slice(0, 20),
      notes: String(question.notes || "").slice(0, 2000),
    },
  };
}

/**
 * Messaggio utente per errori AI / rete.
 * @param {object|Error|null} err
 */
export function formatQuestionAiError(err) {
  const code = err?.code || err?.data?.code || "";
  const status = err?.status;
  if (code === "LICENSE_AI_CHAT_REQUIRED" || status === 403) {
    return "L'assistente AI non è attivo per questo studio.";
  }
  if (code === "AI_NOT_CONFIGURED" || code === "AI_QUOTA_EXHAUSTED" || status === 503) {
    return "Assistente non disponibile in questo momento. Riprova più tardi.";
  }
  if (code === "RATE_LIMIT_AI" || status === 429) {
    return "Troppe richieste all'assistente. Riprova tra qualche minuto.";
  }
  if (code === "OFFLINE" || code === "NETWORK_ERROR" || code === "TIMEOUT") {
    return "Non riesco a raggiungere l'assistente. Controlla la connessione e riprova.";
  }
  return "L'assistente non è riuscito a rispondere. Riprova.";
}

/**
 * @param {string} questionKey
 * @returns {boolean} true se è stata creata una voce di history
 */
export function pushQuestionAiHistory(questionKey) {
  if (typeof window === "undefined" || !window.history || !questionKey) return false;
  const prev = window.history.state;
  if (prev && prev[AI_PANEL_HISTORY_KEY] === questionKey) return false;
  const nextState = {
    ...(prev && typeof prev === "object" ? prev : {}),
    [AI_PANEL_HISTORY_KEY]: questionKey,
  };
  window.history.pushState(nextState, "", window.location.href);
  return true;
}

export function historyStateHasQuestionAi(state, questionKey) {
  return !!(state && state[AI_PANEL_HISTORY_KEY] === questionKey);
}
