/**
 * Indicatore R = P × G (ISO 9001 §6.1, allineato a M03).
 * Scala UI/DB attuale: P e G interi 1–3 → R in 1–9.
 * Soglie colore invariate: 1–3 basso, 4–6 medio, 7–9 alto.
 * Stats API high_priority usa ≥6 (incoerenza nota, non cambiata in ROO-4).
 */

export function riskScore(probability, impact) {
  return Number(probability) * Number(impact);
}

export function riskScoreLevel(score) {
  if (score >= 7) return "alto";
  if (score >= 4) return "medio";
  return "basso";
}

export function scoreColor(score) {
  if (score >= 7) return "risk-high";
  if (score >= 4) return "risk-medium";
  return "risk-low";
}

export function displayFurtherActions(row) {
  const further = row?.further_actions && String(row.further_actions).trim();
  if (further) return further;
  return row?.treatment_desc || "";
}
