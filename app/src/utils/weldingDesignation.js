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
  // Form modifica usa `filler_material` (colonna DB); revisione ingest usa
  // `filler_material_group`. Accetta entrambi per l'anteprima (bug 01/08/2026).
  const fillerGroup = f.filler_material_group || f.filler_material;
  if (fillerGroup) tokens.push(String(fillerGroup).trim());

  // Spessore: min+max noti -> range; solo max noto -> valore singolo (prova puntuale);
  // solo min noto (max vuoto/null) -> "senza limite superiore" (es. t>=3, tipico ISO 9606-1
  // quando il certificato non riporta un massimo esplicito). Vedi feedback cliente Studio Mason.
  const tMin = num(f.thickness_min_mm);
  const tMax = num(f.thickness_max_mm);
  if (tMin != null && tMax != null) {
    tokens.push(tMin === tMax ? `t${fmtNum(tMax)}` : `t${fmtNum(tMin)}-${fmtNum(tMax)}`);
  } else if (tMax != null) {
    tokens.push(`t${fmtNum(tMax)}`);
  } else if (tMin != null) {
    tokens.push(`t\u2265${fmtNum(tMin)}`);
  }

  const dMin = num(f.pipe_diameter_min_mm);
  const dMax = num(f.pipe_diameter_max_mm);
  if (dMin != null && dMax != null) {
    tokens.push(dMin === dMax ? `D${fmtNum(dMax)}` : `D${fmtNum(dMin)}-${fmtNum(dMax)}`);
  } else if (dMax != null) {
    tokens.push(`D${fmtNum(dMax)}`);
  } else if (dMin != null) {
    tokens.push(`D\u2265${fmtNum(dMin)}`);
  }

  const positions = normalizePositions(f.welding_positions || f.position_range);
  if (positions.length) tokens.push(positions.join("/"));

  if (f.weld_details) tokens.push(String(f.weld_details).trim());

  if (!tokens.length) return "";
  return tokens.join(" ").substring(0, 200);
}

export default buildWelderDesignation;
