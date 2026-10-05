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

export function resolvePrintedDesignation(printed, computeFields = {}) {
  const p = printed != null ? String(printed).trim() : "";
  if (p) return p.substring(0, 200);
  return buildWelderDesignation(computeFields);
}

const POSITION_TOKEN_RE = /^(PA|PB|PC|PD|PE|PF|PG|PH|PJ|H-L045|J-L045)$/i;
const PROCESS_TOKEN_RE = /^\d{2,3}$/;

function parseNumberToken(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseWelderQualificationDesignation(text) {
  const body = String(text || "");
  if (!body.trim()) return null;

  let rawLine = null;
  let tokenSource = null;
  const labeled = body.match(/ISO\s*9606-1\s*[:.\-]?\s*([^\n\r]+)/i);
  if (labeled) {
    rawLine = labeled[0].replace(/\s+/g, " ").trim();
    tokenSource = labeled[1];
  } else {
    const compact = body.replace(/\s+/g, " ").trim();
    if (!PROCESS_TOKEN_RE.test(compact.split(/\s+/)[0] || "")) return null;
    if (!/\b(BW|FW)\b/i.test(compact)) return null;
    tokenSource = compact;
    rawLine = compact;
  }

  const tokens = String(tokenSource || "")
    .replace(/[;,]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const parsed = {
    qualification_designation: rawLine ? String(rawLine).substring(0, 200) : null,
    welding_process_test: null,
    product_type: null,
    joint_type: null,
    filler_material_group: null,
    thickness_s_test_mm: null,
    thickness_t_test_mm: null,
    pipe_diameter_test_mm: null,
    welding_position_test: null,
    weld_details: null,
    tokens,
  };

  const leftover = [];
  for (const tok of tokens) {
    if (!parsed.welding_process_test && PROCESS_TOKEN_RE.test(tok)) {
      parsed.welding_process_test = tok;
      continue;
    }
    const up = tok.toUpperCase();
    if (!parsed.product_type && (up === "P" || up === "T")) {
      parsed.product_type = up;
      continue;
    }
    if (!parsed.joint_type && (up === "BW" || up === "FW")) {
      parsed.joint_type = up;
      continue;
    }
    if (!parsed.filler_material_group && /^FM\d$/i.test(tok)) {
      parsed.filler_material_group = up;
      continue;
    }
    const sTok = tok.match(/^s\s*=?\s*(\d+(?:[.,]\d+)?)$/i);
    if (sTok) {
      parsed.thickness_s_test_mm = parseNumberToken(sTok[1]);
      continue;
    }
    const tTok = tok.match(/^t\s*=?\s*(\d+(?:[.,]\d+)?)$/i);
    if (tTok) {
      parsed.thickness_t_test_mm = parseNumberToken(tTok[1]);
      continue;
    }
    const dTok = tok.match(/^D\s*=?\s*(\d+(?:[.,]\d+)?)$/i);
    if (dTok) {
      parsed.pipe_diameter_test_mm = parseNumberToken(dTok[1]);
      continue;
    }
    if (!parsed.welding_position_test && POSITION_TOKEN_RE.test(up)) {
      parsed.welding_position_test = up;
      continue;
    }
    leftover.push(tok);
  }

  if (leftover.length) parsed.weld_details = leftover.join(" ");

  const hasCore = parsed.welding_process_test || parsed.joint_type || parsed.qualification_designation;
  if (!hasCore) return null;
  return parsed;
}

export default buildWelderDesignation;
