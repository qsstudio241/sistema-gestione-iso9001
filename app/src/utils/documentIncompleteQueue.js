/**
 * Coda registro «da completare» (IA-5b).
 * Allineato al filtro GET /documents?incomplete=1 (document.controller).
 * Non è un cancello sullo screening Import.
 */

import { isDocumentFolder } from "./documentValidity";

export const INCOMPLETE_REASONS = Object.freeze({
  tipo: { key: "tipo", label: "Tipo incerto", priority: "high", badgeStatus: "inactive" },
  cartella: { key: "cartella", label: "Cartella mancante", priority: "high", badgeStatus: "inactive" },
  campi: { key: "campi", label: "Campi vuoti", priority: "high", badgeStatus: "inactive" },
  bozza: { key: "bozza", label: "Bozza AI", priority: "low", badgeStatus: "bozza" },
});

function isEmptyTipo(doc) {
  const tipo = String(doc?.doc_type || "").trim().toLowerCase();
  return !tipo || tipo === "altro";
}

function isMissingFolder(doc) {
  const parent = doc?.parent_id;
  return parent == null || parent === "" || Number(parent) === 0;
}

function isEmptyTitle(doc) {
  return !String(doc?.title || "").trim();
}

function isAiDraft(doc) {
  return String(doc?.import_status || "").trim().toLowerCase() === "ai_draft";
}

/**
 * Motivi per cui un documento dello scaffale resta in coda admin.
 * @returns {Array<{ key: string, label: string, priority: string, badgeStatus: string }>}
 */
export function getIncompleteReasons(doc) {
  if (!doc || isDocumentFolder(doc) || doc.status === "obsoleto") return [];
  const reasons = [];
  if (isEmptyTipo(doc)) reasons.push(INCOMPLETE_REASONS.tipo);
  if (isMissingFolder(doc)) reasons.push(INCOMPLETE_REASONS.cartella);
  if (isEmptyTitle(doc)) reasons.push(INCOMPLETE_REASONS.campi);
  if (isAiDraft(doc)) reasons.push(INCOMPLETE_REASONS.bozza);
  return reasons;
}

export function isIncompleteRegistryDoc(doc) {
  return getIncompleteReasons(doc).length > 0;
}

export function isHighPriorityIncomplete(doc) {
  return getIncompleteReasons(doc).some((r) => r.priority === "high");
}
