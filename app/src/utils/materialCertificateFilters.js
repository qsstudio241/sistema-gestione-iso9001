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
  if (action === "patch") {
    return workflowStatus !== "compliant" && workflowStatus !== "archived";
  }
  return false;
}

export function hitlTitle(action, workflowStatus) {
  if (canHitl(action, workflowStatus)) return "";
  if (action === "approve") return "Approva solo da In revisione o Non conforme";
  if (action === "reject") return "Respingi solo da In revisione";
  if (action === "archive") return "Archivia dopo una decisione (conforme o non conforme)";
  if (action === "evaluate") return "Valutazione non disponibile in questo stato";
  if (action === "extract") return "Estrazione non disponibile in questo stato";
  if (action === "patch") return "I campi non si modificano dopo l'approvazione o l'archivio";
  return "";
}
