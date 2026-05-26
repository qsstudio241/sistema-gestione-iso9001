/**
 * Logica condivisa vigore/stato documento — Registro Documenti SGQ.
 * "vigente" è alias legacy di "rilasciato" (migration 067).
 * Le cartelle (doc_type folder / is_system_folder) non hanno lifecycle utente:
 * non vanno contate come vigenti né mostrano badge stato in UI.
 */

export const RELEASED_DOC_STATUSES = Object.freeze(["rilasciato", "vigente"]);

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
