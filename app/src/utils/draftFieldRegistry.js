/**
 * Registro globale dei campi testo in modifica (textarea audit).
 * Evita che hydrate/reconcile sovrascrivano il testo mentre l'utente digita.
 */

const activeDrafts = new Map(); // key -> { auditUuid, clearedAt }
const clearTimers = new Map(); // key -> timeoutId

export function draftFieldKey(auditUuid, fieldId) {
  if (!auditUuid || fieldId == null) return null;
  return `${auditUuid}:${fieldId}`;
}

export function markDraft(auditUuid, fieldId) {
  const key = draftFieldKey(auditUuid, fieldId);
  if (!key) return;
  if (clearTimers.has(key)) {
    clearTimeout(clearTimers.get(key));
    clearTimers.delete(key);
  }
  activeDrafts.set(key, { auditUuid, fieldId, touchedAt: Date.now() });
}

export function clearDraft(auditUuid, fieldId) {
  const key = draftFieldKey(auditUuid, fieldId);
  if (!key) return;
  activeDrafts.delete(key);
  if (clearTimers.has(key)) {
    clearTimeout(clearTimers.get(key));
    clearTimers.delete(key);
  }
}

/** Rimuove la bozza dopo un delay (blur) — tempo per autosave/sync. */
export function scheduleClearDraft(auditUuid, fieldId, delayMs = 1500) {
  const key = draftFieldKey(auditUuid, fieldId);
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

export function isDraft(auditUuid, fieldId) {
  const key = draftFieldKey(auditUuid, fieldId);
  return key ? activeDrafts.has(key) : false;
}

export function hasAnyDraftForAudit(auditUuid) {
  if (!auditUuid) return false;
  for (const { auditUuid: uuid } of activeDrafts.values()) {
    if (uuid === auditUuid) return true;
  }
  return false;
}

/** Solo per test — azzera stato. */
export function _resetDraftRegistryForTests() {
  activeDrafts.clear();
  for (const t of clearTimers.values()) clearTimeout(t);
  clearTimers.clear();
}
