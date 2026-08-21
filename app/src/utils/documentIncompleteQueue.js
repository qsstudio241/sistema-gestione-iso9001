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

/**
 * Filtri catalogo che AND-ano la coda e la fanno divergere dal badge `da_completare`.
 * Import posa in `in_approvazione`: «Rilasciato» / tipo / cerca / norma / scadenza / senza file
 * svuotano la lista mentre il conteggio resta > 0.
 */
export const INCOMPLETE_QUEUE_RESET_FILTERS = Object.freeze({
  search: "",
  doc_type: "",
  status: "",
  standard_id: "",
  expiring_days: null,
  without_file: false,
});

/**
 * Apertura coda: reset filtri incompatibili + incomplete=true.
 * Chiusura: spegne solo incomplete (non ripristina i filtri precedenti).
 * @param {object} filters
 * @param {boolean} nextIncomplete
 */
export function applyIncompleteQueueFilters(filters, nextIncomplete) {
  const base = filters && typeof filters === "object" ? filters : {};
  if (nextIncomplete) {
    return {
      ...base,
      ...INCOMPLETE_QUEUE_RESET_FILTERS,
      incomplete: true,
    };
  }
  return { ...base, incomplete: false };
}

/**
 * Query GET /documents allineata ai filtri catalogo (stessa funzione di load + export).
 * Dopo `applyIncompleteQueueFilters(..., true)` resta solo `incomplete=1` — stesso
 * predicato del badge `da_completare` (lo scope azienda lo aggiunge il caller).
 * @param {object} filters
 */
export function catalogQueryFromFilters(filters) {
  const f = filters && typeof filters === "object" ? filters : {};
  return {
    ...(f.search && { search: f.search }),
    ...(f.doc_type && { doc_type: f.doc_type }),
    ...(f.status && { status: f.status }),
    ...(f.standard_id && { standard_id: f.standard_id }),
    ...(f.expiring_days && { expiring_days: f.expiring_days }),
    ...(f.without_file && { without_file: 1 }),
    ...(f.incomplete && { incomplete: 1 }),
  };
}
