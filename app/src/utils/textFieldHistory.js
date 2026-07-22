/**
 * Storico locale versioni testo (ultime N snapshot su blur).
 * Stesso pattern usato per campi audit ricchi — audit_events lato server; qui UI ripristino rapido.
 */

const HISTORY_PREFIX = "sgq_text_field_history_v1";
const DEFAULT_MAX = 12;

export function textHistoryStorageKey(scopeId, fieldId) {
  if (!scopeId || fieldId == null) return null;
  return `${HISTORY_PREFIX}:${scopeId}:${fieldId}`;
}

export function getTextFieldHistory(scopeId, fieldId, max = DEFAULT_MAX) {
  const key = textHistoryStorageKey(scopeId, fieldId);
  if (!key || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.slice(0, max) : [];
  } catch {
    return [];
  }
}

/**
 * Registra una versione se il testo è cambiato rispetto all'ultima entry.
 * @param {string} scopeId — es. audit uuid o `nc:42` o `nc-create`
 */
export function appendTextFieldHistory(scopeId, fieldId, text, max = DEFAULT_MAX) {
  const key = textHistoryStorageKey(scopeId, fieldId);
  if (!key || typeof localStorage === "undefined") return;
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return;
  try {
    const prev = getTextFieldHistory(scopeId, fieldId, max);
    if (prev[0]?.text === trimmed) return;
    const entry = { text: trimmed, savedAt: Date.now() };
    const next = [entry, ...prev.filter((e) => e.text !== trimmed)].slice(0, max);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignorato */
  }
}
