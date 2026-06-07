/**
 * Bozze locali campi testo NC (localStorage) - sopravvivono a refresh e disconnessione.
 * Chiave per org + nc + campo; non sostituisce il salvataggio server su submit.
 */

const STORAGE_PREFIX = "sgq_nc_field_draft_v1";

export function ncFieldDraftStorageKey(orgId, scopeId, fieldId) {
  if (orgId == null || !scopeId || fieldId == null) return null;
  return `${STORAGE_PREFIX}:${orgId}:${scopeId}:${fieldId}`;
}

export function loadNcFieldDraft(orgId, scopeId, fieldId) {
  const key = ncFieldDraftStorageKey(orgId, scopeId, fieldId);
  if (!key || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.value !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveNcFieldDraft(orgId, scopeId, fieldId, value) {
  const key = ncFieldDraftStorageKey(orgId, scopeId, fieldId);
  if (!key || typeof localStorage === "undefined") return;
  try {
    if (!String(value ?? "").trim()) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(
      key,
      JSON.stringify({ value: String(value), savedAt: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearNcFieldDraft(orgId, scopeId, fieldId) {
  const key = ncFieldDraftStorageKey(orgId, scopeId, fieldId);
  if (!key || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignorato */
  }
}

/** Preferisce bozza locale se pi\u00F9 ricca del valore server (offline / reload). */
export function pickNcFieldValue(serverValue, draftEntry) {
  const server = String(serverValue ?? "").trim();
  const draft = String(draftEntry?.value ?? "").trim();
  if (!draft) return serverValue ?? "";
  if (!server) return draftEntry.value;
  if (draft.length > server.length) return draftEntry.value;
  return serverValue ?? "";
}
