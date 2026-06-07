/**
 * Logica condivisa vigore/stato documento — Registro Documenti SGQ.
 * "vigente" è alias legacy di "rilasciato" (migration 067).
 * Le cartelle (doc_type folder / is_system_folder) non hanno lifecycle utente:
 * non vanno contate come vigenti né mostrano badge stato in UI.
 */

export const RELEASED_DOC_STATUSES = Object.freeze(["rilasciato", "vigente"]);

/** Stati ciclo di vita ammessi in API (colonna document_registry.status). */
export const REGISTRY_DOC_STATUSES = Object.freeze([
  "rilasciato",
  "bozza",
  "in_revisione",
  "obsoleto",
  "in_approvazione",
]);

/**
 * Normalizza status registro per POST/PUT documenti.
 * "vigente" (legacy UI) ? "rilasciato". Non tocca validity_status (norme/leggi).
 */
export function normalizeRegistryDocStatusForApi(raw) {
  if (raw == null || String(raw).trim() === "") return "rilasciato";
  const s = String(raw).trim().toLowerCase();
  if (s === "vigente") return "rilasciato";
  return s;
}

/** Stato iniziale form: legacy vigente mostrato come rilasciato. */
export function registryDocStatusForForm(raw) {
  return normalizeRegistryDocStatusForApi(raw);
}

export function isDocumentFolder(doc) {
  if (!doc) return false;
  return (
    doc.doc_type === "folder" ||
    doc.is_system_folder === true ||
    doc.is_folder === true
  );
}

export function isReleasedDocStatus(status) {
  return RELEASED_DOC_STATUSES.includes(status);
}

/** Documento singolo in stato rilasciato/vigente (esclude cartelle). */
export function isDocumentVigente(doc) {
  if (!doc || isDocumentFolder(doc)) return false;
  return isReleasedDocStatus(doc.status);
}

/** Badge stato ciclo di vita solo sui documenti, mai sulle cartelle. */
export function shouldShowDocumentStatusBadge(doc) {
  return !isDocumentFolder(doc) && Boolean(doc?.status);
}
