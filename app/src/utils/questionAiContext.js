/**
 * Payload e storia UI per «Chiedi all'AI» sulla domanda (Fase 1).
 * Solo norma / clausola / testo / esito / note — niente anagrafica cliente né allegati.
 */
import { getStandardByCode, getStandardByKey } from "../data/standardsRegistry";

export const SUGGEST_QUESTIONS_MODE = "suggest_questions";
export const AI_PANEL_HISTORY_KEY = "sgqQuestionAiPanel";

/**
 * Chiavi che non sono una norma (checklist personalizzata, vuoto).
 * @param {string|null|undefined} code
 */
export function isAbsentStandardCode(code) {
  const s = String(code || "").trim();
  if (!s) return true;
  return s.toLowerCase() === "custom";
}

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
  if (isAbsentStandardCode(checklistKey)) return null;
  const entry = getStandardByKey(checklistKey) || getStandardByCode(checklistKey);
  if (!entry) return String(checklistKey);
  return pickYearQualifiedCode(entry.codes) || entry.codes?.[0] || entry.key || String(checklistKey);
}

/**
 * @param {string|null|undefined} checklistKey
 */
export function resolveStandardLabelForQuestionAi(checklistKey) {
  if (isAbsentStandardCode(checklistKey)) return "";
  const entry = getStandardByKey(checklistKey) || getStandardByCode(checklistKey);
  return entry?.shortLabel || entry?.label || "";
}

/**
 * Norma da mandare al pannello: mai `custom` né inventata.
 * @param {string|null|undefined} standardCode
 * @param {object} [question]
 * @param {string|null|undefined} [checklistKey]
 */
export function pickStandardCodeForQuestionAi(standardCode, question = {}, checklistKey) {
  return resolveStandardCodeForQuestionAi(
    standardCode || question.standardCode || checklistKey || null
  );
}

/**
 * Body per POST /ai/question-assistant (mode suggest_questions).
 * Senza norma dedotta non manda standardCode (il backend tratta "assente").
 * @param {object} question
 * @param {{ standardCode?: string, standardLabel?: string }} [extras]
 */
export function buildSuggestQuestionsPayload(question = {}, extras = {}) {
  const rawCode =
    extras.standardCode || question.standardCode || question.checklistKey || null;
  const standardCode = resolveStandardCodeForQuestionAi(rawCode);
  const standardLabel =
    extras.standardLabel ||
    question.standardLabel ||
    resolveStandardLabelForQuestionAi(rawCode || standardCode) ||
    "";

  const questionOut = {
    id: question.id != null ? String(question.id).slice(0, 80) : undefined,
    text: String(question.text || "").slice(0, 2000),
    clauseRef: String(question.clauseRef || "").slice(0, 80),
    currentStatus: String(question.status || question.currentStatus || "").slice(0, 20),
    notes: String(question.notes || "").slice(0, 2000),
  };
  if (standardCode) questionOut.standardCode = String(standardCode).slice(0, 80);
  if (standardLabel) questionOut.standardLabel = String(standardLabel).slice(0, 80);

  return {
    mode: SUGGEST_QUESTIONS_MODE,
    question: questionOut,
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
 * Cronologia del pannello: una sola voce, condivisa tra le istanze.
 * Indietro chiude; unmount / cambio domanda / navigazione non lasciano residui.
 */
const historyListeners = new Set();
const historySession = {
  key: null,
  href: null,
  pushed: false,
  popping: false,
  orphaned: false,
};
let historyPopListener = null;

function readHistoryMarker(state) {
  return state && typeof state === "object" ? state[AI_PANEL_HISTORY_KEY] || null : null;
}

function notifyQuestionAiHistory(result, event) {
  historyListeners.forEach((fn) => {
    try {
      fn(result, event);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function historyStateHasQuestionAi(state, questionKey) {
  if (!questionKey) return !!readHistoryMarker(state);
  return readHistoryMarker(state) === questionKey;
}

/**
 * Apre o riusa l'unica voce. Se un altro pannello era aperto, ne prende il posto.
 * @returns {boolean} true se è stata creata una voce nuova
 */
export function claimQuestionAiHistory(questionKey) {
  if (typeof window === "undefined" || !window.history || !questionKey) return false;
  ensureQuestionAiHistoryListener();
  historySession.orphaned = false;
  const href = window.location.href;
  const prev = window.history.state;
  const existing = readHistoryMarker(prev);
  const nextState = {
    ...(prev && typeof prev === "object" ? prev : {}),
    [AI_PANEL_HISTORY_KEY]: questionKey,
  };

  if (existing) {
    if (existing !== questionKey) {
      window.history.replaceState(nextState, "", href);
    }
    historySession.key = questionKey;
    historySession.href = href;
    historySession.pushed = true;
    notifyQuestionAiHistory({ type: "claimed", key: questionKey });
    return false;
  }

  window.history.pushState(nextState, "", href);
  historySession.key = questionKey;
  historySession.href = href;
  historySession.pushed = true;
  notifyQuestionAiHistory({ type: "claimed", key: questionKey });
  return true;
}

/** Compat: alias di claim (una sola voce). */
export function pushQuestionAiHistory(questionKey) {
  return claimQuestionAiHistory(questionKey);
}

/**
 * Toglie la voce se siamo ancora sull'URL del pannello.
 * @returns {boolean} true se ha chiamato history.back()
 */
export function releaseQuestionAiHistory(questionKey) {
  if (typeof window === "undefined" || !window.history) return false;
  if (!historySession.pushed) return false;
  if (questionKey && historySession.key && historySession.key !== questionKey) return false;

  const marker = readHistoryMarker(window.history.state);
  const sameUrl = !historySession.href || window.location.href === historySession.href;

  if (marker && sameUrl && (!questionKey || marker === questionKey)) {
    historySession.popping = true;
    historySession.pushed = false;
    historySession.key = null;
    historySession.href = null;
    window.history.back();
    // jsdom / stack vuoto: back() può non togliere il marker — pulizia in-place.
    const still = readHistoryMarker(window.history.state);
    if (still && (!questionKey || still === questionKey)) {
      const prevState = window.history.state;
      const cleaned = { ...(prevState && typeof prevState === "object" ? prevState : {}) };
      delete cleaned[AI_PANEL_HISTORY_KEY];
      window.history.replaceState(cleaned, "", window.location.href);
      historySession.popping = false;
      notifyQuestionAiHistory({ type: "self-close" });
    }
    return true;
  }

  if (marker && !sameUrl) {
    historySession.orphaned = true;
  } else if (marker) {
    const prev = window.history.state;
    const next = { ...(prev && typeof prev === "object" ? prev : {}) };
    delete next[AI_PANEL_HISTORY_KEY];
    window.history.replaceState(next, "", window.location.href);
  }

  historySession.pushed = false;
  historySession.key = null;
  historySession.href = null;
  return false;
}

/**
 * Cleanup all'unmount: se nessun altro pannello reclama la voce nello stesso tick, la toglie.
 */
export function abandonQuestionAiHistory(questionKey) {
  if (typeof window === "undefined") return;
  const key = questionKey;
  queueMicrotask(() => {
    if (historySession.key && key && historySession.key !== key) return;
    if (!historySession.pushed) return;
    releaseQuestionAiHistory(key);
  });
}

export function consumeQuestionAiPop(event) {
  if (historySession.popping) {
    historySession.popping = false;
    return { type: "self-close" };
  }
  const marker = readHistoryMarker(event?.state);
  if (historySession.orphaned && marker) {
    historySession.orphaned = false;
    historySession.pushed = false;
    historySession.key = null;
    historySession.href = null;
    window.history.back();
    return { type: "orphan-consume" };
  }
  if (!marker) {
    const wasOpen = historySession.pushed;
    historySession.pushed = false;
    historySession.key = null;
    historySession.href = null;
    return { type: wasOpen ? "user-back" : "none" };
  }
  return { type: "still-open", key: marker };
}

export function subscribeQuestionAiHistory(fn) {
  if (typeof fn !== "function") return () => {};
  ensureQuestionAiHistoryListener();
  historyListeners.add(fn);
  return () => historyListeners.delete(fn);
}

export function ensureQuestionAiHistoryListener() {
  if (typeof window === "undefined" || historyPopListener) return;
  historyPopListener = (event) => {
    const result = consumeQuestionAiPop(event);
    notifyQuestionAiHistory(result, event);
  };
  window.addEventListener("popstate", historyPopListener);
}

/** Solo test: azzera sessione e listener. */
export function resetQuestionAiHistoryForTests() {
  historySession.key = null;
  historySession.href = null;
  historySession.pushed = false;
  historySession.popping = false;
  historySession.orphaned = false;
  historyListeners.clear();
  if (historyPopListener && typeof window !== "undefined") {
    window.removeEventListener("popstate", historyPopListener);
  }
  historyPopListener = null;
}
