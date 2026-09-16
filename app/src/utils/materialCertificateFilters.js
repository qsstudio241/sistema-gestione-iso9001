/**
 * Filtri KPI Material Compliance — una fonte per dimensione (esito, ruolo).
 * Stessa funzione per conteggio card e colore riga.
 */

export const IN_PROGRESS_STATUSES = [
  "received",
  "text_ready",
  "extracted",
  "ocr_running",
  "pending_review",
];

export const OUTCOME_LABELS = {
  in_review: "In revisione",
  compliant: "Conformi",
  non_compliant: "Non conformi",
  archived: "Archiviati",
};

export const ROLE_LABELS = {
  base: "Base",
  filler: "Apporto",
};

export const STATUS_LABELS = {
  received: "Ricevuto",
  text_ready: "Testo pronto",
  extracted: "Estratto",
  ocr_running: "OCR in corso",
  pending_review: "In revisione",
  compliant: "Conforme",
  non_compliant: "Non conforme",
  archived: "Archiviato",
};

export function outcomeBucket(workflowStatus) {
  if (workflowStatus === "compliant") return "compliant";
  if (workflowStatus === "non_compliant") return "non_compliant";
  if (workflowStatus === "archived") return "archived";
  return "in_review";
}

export function outcomeRowClass(workflowStatus) {
  const bucket = outcomeBucket(workflowStatus);
  if (bucket === "compliant") return "sq-row-verde";
  if (bucket === "non_compliant") return "sq-row-rosso";
  if (bucket === "archived") return "sq-row-grigio";
  return "sq-row-giallo";
}

export function countByOutcome(rows) {
  const c = { in_review: 0, compliant: 0, non_compliant: 0, archived: 0 };
  for (const row of rows || []) {
    c[outcomeBucket(row.workflow_status)] += 1;
  }
  return c;
}

export function countByRole(rows) {
  const c = { base: 0, filler: 0 };
  for (const row of rows || []) {
    if (row.material_role === "filler") c.filler += 1;
    else c.base += 1;
  }
  return c;
}

export function filterCertificates(rows, { outcome, role } = {}) {
  return (rows || []).filter((row) => {
    if (outcome && outcomeBucket(row.workflow_status) !== outcome) return false;
    if (role && (row.material_role || "base") !== role) return false;
    return true;
  });
}

export function canHitl(action, workflowStatus) {
  if (action === "approve") {
    return workflowStatus === "pending_review" || workflowStatus === "non_compliant";
  }
  if (action === "reject") return workflowStatus === "pending_review";
  if (action === "archive") {
    return workflowStatus === "compliant" || workflowStatus === "non_compliant";
  }
  if (action === "evaluate") {
    return [
      "received",
      "text_ready",
      "extracted",
      "pending_review",
      "non_compliant",
    ].includes(workflowStatus);
  }
  if (action === "extract") {
    return ["received", "text_ready", "extracted", "ocr_running"].includes(workflowStatus);
  }
  if (action === "split") {
    return [
      "received",
      "text_ready",
      "extracted",
      "pending_review",
      "non_compliant",
      "ocr_running",
    ].includes(workflowStatus);
  }
  if (action === "patch") {
    return workflowStatus !== "compliant" && workflowStatus !== "archived";
  }
  return false;
}

/** MC-I3: bolla, non mill. Corretto_json vince su extracted. */
export function isDeliveryNote(row) {
  const corrected = row?.corrected_json && typeof row.corrected_json === "object"
    ? row.corrected_json
    : {};
  const extracted = row?.extracted_json && typeof row.extracted_json === "object"
    ? row.extracted_json
    : {};
  const kind = String(corrected.document_kind || extracted.document_kind || "").toLowerCase();
  return kind === "delivery_note" || kind === "ddt" || kind === "bolla";
}

/** MC-I4: candidati split per colata (≥2). */
export function splitCandidatesFromRow(row) {
  if (isDeliveryNote(row)) return [];
  const corrected = row?.corrected_json && typeof row.corrected_json === "object"
    ? row.corrected_json
    : {};
  const extracted = row?.extracted_json && typeof row.extracted_json === "object"
    ? row.extracted_json
    : {};
  const raw = Array.isArray(corrected.split_candidates)
    ? corrected.split_candidates
    : Array.isArray(extracted.split_candidates)
      ? extracted.split_candidates
      : [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const heat = String(
      item && typeof item === "object" ? (item.heat_or_lot_no || "") : (item || "")
    ).trim();
    if (heat.length < 3 || heat.length > 40) continue;
    const key = heat.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ heat_or_lot_no: heat });
  }
  return out.length >= 2 ? out : [];
}

export function hitlTitle(action, workflowStatus, extras = {}) {
  if (action === "evaluate" && extras.deliveryNote) {
    return "Valutazione non applicabile: questo è un DDT, non un certificato 3.1";
  }
  if (action === "split") {
    if (extras.deliveryNote) return "Divisione non applicabile: questo è un DDT";
    if ((extras.splitCount || 0) < 2) {
      return "Dopo Estrai, se compaiono almeno due colate puoi dividere la busta";
    }
    return "";
  }
  if (canHitl(action, workflowStatus)) return "";
  if (action === "approve") return "Approva solo da In revisione o Non conforme";
  if (action === "reject") return "Respingi solo da In revisione";
  if (action === "archive") return "Archivia dopo una decisione (conforme o non conforme)";
  if (action === "evaluate") return "Valutazione non disponibile in questo stato";
  if (action === "extract") return "Estrazione non disponibile in questo stato";
  if (action === "patch") return "I campi non si modificano dopo l'approvazione o l'archivio";
  return "";
}
