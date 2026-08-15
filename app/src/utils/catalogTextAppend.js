/**
 * Ponte catalogo §4.1/§4.2 → testi della riga di analisi (ROO-8).
 * Accoda una riga, non sovrascrive; non duplica se il testo c'è già.
 */

export function formatContextFactorLine(factor) {
  const desc = String(factor?.description || "").trim();
  if (!desc) return "";
  const cat = String(factor?.category || "").trim();
  return cat ? `${cat}: ${desc}` : desc;
}

export function formatInterestedPartyLine(party) {
  const name = String(party?.name || "").trim();
  if (!name) return "";
  const req = String(party?.requirements || "").trim();
  return req ? `${name} — ${req}` : name;
}

export function appendCatalogLine(existingText, line) {
  const next = String(line || "").trim();
  if (!next) return existingText || "";
  const current = String(existingText || "");
  const parts = current.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.some((p) => p === next || p.includes(next))) return current;
  if (!current.trim()) return next;
  return `${current.replace(/\s+$/, "")}\n${next}`;
}
