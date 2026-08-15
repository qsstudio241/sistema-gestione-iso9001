/**
 * Indicatore R = P × G (ISO 9001 §6.1).
 * Scala UI: 1–N con N = risk_pg_max azienda (3|4|5, default 3).
 */

export const DEFAULT_PG_MAX = 3;
export const PG_ABS_MAX = 5;

export function normalizePgMax(value) {
  const n = Number(value);
  if (n === 4 || n === 5) return n;
  return DEFAULT_PG_MAX;
}

export function maxScore(pgMax) {
  const m = normalizePgMax(pgMax);
  return m * m;
}

export function highPriorityThreshold(pgMax) {
  return Math.floor(maxScore(pgMax) * 2 / 3);
}

export function riskScore(probability, impact) {
  return Number(probability) * Number(impact);
}

export function riskScoreLevel(score, pgMax) {
  const mid = highPriorityThreshold(pgMax);
  const low = Math.floor(maxScore(pgMax) / 3);
  if (score > mid) return "alto";
  if (score > low) return "medio";
  return "basso";
}

export function scoreColor(score, pgMax) {
  const level = riskScoreLevel(score, pgMax);
  if (level === "alto") return "risk-high";
  if (level === "medio") return "risk-medium";
  return "risk-low";
}

export function displayFurtherActions(row) {
  const further = row?.further_actions && String(row.further_actions).trim();
  if (further) return further;
  return row?.treatment_desc || "";
}

export function residualScoreFromRisk(risk) {
  const p = risk?.residual_probability;
  const g = risk?.residual_impact;
  if (p == null || p === "" || g == null || g === "") return null;
  const nP = Number(p);
  const nG = Number(g);
  if (!Number.isInteger(nP) || !Number.isInteger(nG)) return null;
  return riskScore(nP, nG);
}

export const ANALYSIS_METHODS = ["pxg", "swot_signed", "fmea_gpr"];

export function normalizeMethod(value) {
  const v = String(value || "").trim();
  return ANALYSIS_METHODS.includes(v) ? v : "pxg";
}

export function normalizeSwotQuadrant(value) {
  const v = String(value || "").trim().toUpperCase();
  return ["S", "W", "O", "T"].includes(v) ? v : null;
}

export function normalizeImpactSign(value) {
  return Number(value) === -1 ? -1 : 1;
}

export function pgOptions(pgMax) {
  const max = normalizePgMax(pgMax);
  const labels = {
    1: "Bassa",
    2: "Media",
    3: "Alta",
    4: "Molto alta",
    5: "Quasi certa",
  };
  const impactLabels = {
    1: "Basso",
    2: "Medio",
    3: "Alto",
    4: "Molto alto",
    5: "Estremo",
  };
  return { max, labels, impactLabels };
}
