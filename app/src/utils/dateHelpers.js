/**
 * dateHelpers.js — Utilità condivise per formattazione date
 * Sostituisce le copie locali di formatDate presenti in vari componenti/pagine.
 */

/**
 * Formatta una data ISO (YYYY-MM-DD...) in formato italiano (DD/MM/YYYY).
 * Gestisce: stringhe ISO, Date objects, null/undefined.
 * @param {string|Date|null|undefined} d
 * @returns {string} Data formattata o "—"
 */
export function formatDate(d) {
  if (!d) return "—";
  const s = typeof d === "string" ? d : String(d);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const dt = new Date(d);
  if (!isNaN(dt.getTime())) {
    return dt.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return "—";
}
