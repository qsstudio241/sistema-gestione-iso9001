/**
 * Registro globale dei campi testo in modifica (textarea audit / NC).
 * Evita che hydrate/reconcile o reload lista sovrascrivano il testo mentre l'utente digita.
 */

const activeDrafts = new Map(); // key -> { scopeId, fieldId, touchedAt }
const clearTimers = new Map(); // key -> timeoutId

export function draftFieldKey(scopeId, fieldId) {
  if (!scopeId || fieldId == null) return null;
  return `${scopeId}:${fieldId}`;
}

export function markDraft(scopeId, fieldId) {
  const key = draftFieldKey(scopeId, fieldId);
  if (!key) return;
  if (clearTimers.has(key)) {
    clearTimeout(clearTimers.get(key));
    clearTimers.delete(key);
  }
  activeDrafts.set(key, { scopeId, fieldId, touchedAt: Date.now() });
}

export function clearDraft(scopeId, fieldId) {
  const key = draftFieldKey(scopeId, fieldId);
  if (!key) return;
  activeDrafts.delete(key);
  if (clearTimers.has(key)) {
    clearTimeout(clearTimers.get(key));
    clearTimers.delete(key);
  }
}

/** Rimuove la bozza dopo un delay (blur) — tempo per autosave/sync. */
export function scheduleClearDraft(scopeId, fieldId, delayMs = 1500) {
  const key = draftFieldKey(scopeId, fieldId);
  if (!key) return;
  if (clearTimers.has(key)) clearTimeout(clearTimers.get(key));
  clearTimers.set(
    key,
    setTimeout(() => {
      clearTimers.delete(key);
      activeDrafts.delete(key);
    }, delayMs),
  );
}

export function isDraft(scopeId, fieldId) {
  const key = draftFieldKey(scopeId, fieldId);
  return key ? activeDrafts.has(key) : false;
}

export function hasAnyDraftForScope(scopeId) {
  if (!scopeId) return false;
  for (const { scopeId: sid } of activeDrafts.values()) {
    if (sid === scopeId) return true;
  }
  return false;
}

/** @deprecated alias audit — usare hasAnyDraftForScope */
export function hasAnyDraftForAudit(auditUuid) {
  return hasAnyDraftForScope(auditUuid);
}

/** Solo per test — azzera stato. */
export function _resetDraftRegistryForTests() {
  activeDrafts.clear();
  for (const t of clearTimers.values()) clearTimeout(t);
  clearTimers.clear();
}
