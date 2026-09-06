/**
 * Deep-link Libreria da gap Assistente (LG-2).
 * Pathname = pagina; query = dettaglio (highlight / path / prefill).
 * Contratto: /settings/libreria?highlight=<code>&path=tenant|platform&prefill=1
 */

export const LIBRARY_GAP_PATHS = ["tenant", "platform"];

/**
 * @param {string} [search]
 * @returns {{ highlight: string|null, path: 'tenant'|'platform'|null, prefill: boolean }}
 */
export function parseLibraryGapSearch(search) {
  const params = new URLSearchParams(
    search ?? (typeof window !== "undefined" ? window.location.search : "")
  );
  const highlightRaw = String(params.get("highlight") || "").trim();
  const pathRaw = String(params.get("path") || "").trim().toLowerCase();
  const path = LIBRARY_GAP_PATHS.includes(pathRaw) ? pathRaw : null;
  const prefillRaw = String(params.get("prefill") || "").toLowerCase();
  return {
    highlight: highlightRaw || null,
    path,
    prefill: prefillRaw === "1" || prefillRaw === "true",
  };
}

/**
 * @param {{ code?: string|null, closurePath?: string|null, prefill?: boolean }} opts
 * @returns {string}
 */
export function buildLibraryGapPath({ code, closurePath, prefill = false } = {}) {
  const params = new URLSearchParams();
  const c = String(code || "").trim();
  if (c) params.set("highlight", c);
  const p = String(closurePath || "").trim().toLowerCase();
  if (LIBRARY_GAP_PATHS.includes(p)) params.set("path", p);
  if (prefill && c) params.set("prefill", "1");
  const qs = params.toString();
  return qs ? `/settings/libreria?${qs}` : "/settings/libreria";
}

/**
 * Confronta codice gap con riga backlog (case-insensitive).
 * Accetta uguaglianza o prefisso (es. «ISO 14555:2025» vs «ISO 14555:2025 (arc…)»).
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 */
export function libraryGapCodesMatch(a, b) {
  const x = String(a || "")
    .trim()
    .toLowerCase();
  const y = String(b || "")
    .trim()
    .toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  return x.startsWith(y) || y.startsWith(x);
}
