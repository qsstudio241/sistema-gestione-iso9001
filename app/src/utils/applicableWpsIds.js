/**
 * Lettura tollerante di projects.applicable_wps_ids (JSON array di id WPS).
 * Specchio di backend/src/utils/applicableWpsIds.js: gestisce anche i valori già annidati
 * o doppiamente serializzati salvati dal vecchio client (es. `["[1,2]"]` -> [1, 2]).
 */

const MAX_NESTING_DEPTH = 32;
const MAX_SQL_INT = 2147483647;

function toPositiveId(n) {
  return Number.isSafeInteger(n) && n > 0 && n <= MAX_SQL_INT ? [n] : [];
}

function collectIds(value, depth) {
  if (depth > MAX_NESTING_DEPTH || value === null || value === undefined) return [];
  if (typeof value === "number") return toPositiveId(value);
  if (Array.isArray(value)) return value.flatMap((item) => collectIds(item, depth + 1));
  if (typeof value !== "string") return [];

  const text = value.trim();
  if (!text) return [];
  if (/^\d+$/.test(text)) return toPositiveId(Number(text));

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    if (/^[\d\s,;]+$/.test(text)) {
      return text.split(/[\s,;]+/).filter(Boolean).flatMap((token) => toPositiveId(Number(token)));
    }
    return [];
  }
  if (Array.isArray(parsed) || typeof parsed === "string") return collectIds(parsed, depth + 1);
  return [];
}

/** @returns {number[]} interi positivi unici */
export function normalizeApplicableWpsIds(input) {
  return [...new Set(collectIds(input, 0))];
}
