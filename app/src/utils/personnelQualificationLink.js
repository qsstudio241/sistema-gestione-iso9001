/**
 * Utility condivise per deduplica import personale da qualifiche.
 */

export function normalizePersonKey(name, code) {
  const trimmedName = String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
  const trimmedCode = String(code || "").trim().toLowerCase();
  if (trimmedCode) return `code:${trimmedCode}`;
  return `name:${trimmedName}`;
}
