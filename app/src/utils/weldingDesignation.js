/**
 * weldingDesignation.js — Designazione qualifica saldatore ISO 9606-1 (anteprima FE).
 *
 * Speculare a backend/src/utils/weldingDesignation.js: genera la stringa sintetica
 * del campo di validita', es. "141 P BW FM1 t10 D60 PA ss nb".
 * Il valore autorevole viene comunque ricalcolato/salvato dal backend.
 */

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtNum(n) {
  return String(n).replace(/\.0+$/, "");
}

function normalizePositions(positions) {
  if (positions == null) return [];
  let arr = positions;
  if (typeof positions === "string") arr = positions.split(/[,;/]+/);
  if (!Array.isArray(arr)) return [];
  return arr.map((p) => String(p).trim()).filter(Boolean);
}

export function buildWelderDesignation(f = {}) {
  const tokens = [];

  if (f.welding_process) tokens.push(String(f.welding_process).trim());
  if (f.product_type) tokens.push(String(f.product_type).trim().toUpperCase());
  if (f.joint_type) tokens.push(String(f.joint_type).trim().toUpperCase());
  if (f.filler_material_group) tokens.push(String(f.filler_material_group).trim());

  const tMin = num(f.thickness_min_mm);
  const tMax = num(f.thickness_max_mm);
  if (tMin != null || tMax != null) {
    if (tMin != null && tMax != null && tMin !== tMax) {
      tokens.push(`t${fmtNum(tMin)}-${fmtNum(tMax)}`);
    } else {
      tokens.push(`t${fmtNum(tMax != null ? tMax : tMin)}`);
    }
  }

  const dMin = num(f.pipe_diameter_min_mm);
  const dMax = num(f.pipe_diameter_max_mm);
  if (dMin != null || dMax != null) {
    if (dMin != null && dMax != null && dMin !== dMax) {
      tokens.push(`D${fmtNum(dMin)}-${fmtNum(dMax)}`);
    } else {
      tokens.push(`D${fmtNum(dMax != null ? dMax : dMin)}`);
    }
  }

  const positions = normalizePositions(f.welding_positions || f.position_range);
  if (positions.length) tokens.push(positions.join("/"));

  if (f.weld_details) tokens.push(String(f.weld_details).trim());

  if (!tokens.length) return "";
  return tokens.join(" ").substring(0, 200);
}

export default buildWelderDesignation;
