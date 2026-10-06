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

/**
 * Spessore della PROVA per tipo di giunto (ISO 9606-1): BW -> s depositato (Tab. 6),
 * FW -> t materiale (Tab. 8). Speculare al backend: sposta solo se la colonna corretta
 * e' vuota; se ci sono entrambi restano entrambi; giunto non BW/FW: nessuna deduzione.
 */
export function resolveTestThicknessByJoint({ joint_type: jointType, s, t } = {}) {
  let sNum = num(s);
  let tNum = num(t);
  const joint = jointType == null ? "" : String(jointType).trim().toUpperCase();
  if (joint === "BW" && sNum == null && tNum != null) {
    sNum = tNum;
    tNum = null;
  } else if (joint === "FW" && tNum == null && sNum != null) {
    tNum = sNum;
    sNum = null;
  }
  return { s: sNum, t: tNum };
}

const POSITION_TOKEN_RE = /^(PA|PB|PC|PD|PE|PF|PG|PH|PJ|H-L045|J-L045)$/i;
const PROCESS_TOKEN_RE = /^\d{2,3}[A-Z]?$/i;
const PROCESS_IN_LINE_RE = /\b\d{2,3}[A-Z]?\b/i;
const EDITION_ONLY_RE = /^(?:19|20)\d{2}(?:\s*[+]\s*A\d+)?\s*$/i;
const LABELED_9606_RE = /ISO\s*9606-1\s*[:.\-]?\s*([^\n\r]*)/gi;

function parseNumberToken(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function isEditionOnlyRemainder(rest) {
  return EDITION_ONLY_RE.test(String(rest || "").trim());
}

function isDesignationRemainder(rest) {
  const s = String(rest || "");
  if (!s.trim() || isEditionOnlyRemainder(s)) return false;
  return PROCESS_IN_LINE_RE.test(s) && /\b[PT]\b/.test(s) && /\b(?:BW|FW)\b/i.test(s);
}

function compactLine(line) {
  return String(line || "").replace(/\s+/g, " ").trim();
}

function pickDesignationSource(body) {
  LABELED_9606_RE.lastIndex = 0;
  let m;
  while ((m = LABELED_9606_RE.exec(body))) {
    if (!isDesignationRemainder(m[1])) continue;
    return {
      rawLine: compactLine(m[0]),
      tokenSource: m[1],
    };
  }
  const lines = String(body).split(/\r?\n/);
  for (const line of lines) {
    const compact = compactLine(line);
    if (!compact || isEditionOnlyRemainder(compact.replace(/^ISO\s*9606-1\s*[:.\-]?\s*/i, ""))) continue;
    const remainder = compact.replace(/^ISO\s*9606-1\s*[:.\-]?\s*/i, "");
    if (!isDesignationRemainder(remainder) && !isDesignationRemainder(compact)) continue;
    return { rawLine: compact, tokenSource: remainder || compact };
  }
  return null;
}

export function parseWelderQualificationDesignation(text) {
  const body = String(text || "");
  if (!body.trim()) return null;

  const picked = pickDesignationSource(body);
  if (!picked) return null;
  const rawLine = picked.rawLine;
  const tokenSource = picked.tokenSource;

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
    transfer_mode: null,
    tokens,
  };

  const leftover = [];
  for (const tok of tokens) {
    if (!parsed.welding_process_test && PROCESS_TOKEN_RE.test(tok)) {
      const digits = String(tok).match(/^(\d{2,3})/i);
      parsed.welding_process_test = digits ? digits[1] : tok;
      const suffix = String(tok).slice(String(parsed.welding_process_test).length).toUpperCase();
      if (suffix === "S" || suffix === "D") parsed.transfer_mode = suffix;
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
    const sTok = tok.match(/^s\s*=?\s*(\d+(?:[.,]\d+)?)(?:-(\d+(?:[.,]\d+)?))?$/i);
    if (sTok) {
      parsed.thickness_s_test_mm = parseNumberToken(sTok[1]);
      continue;
    }
    const tTok = tok.match(/^t\s*=?\s*(\d+(?:[.,]\d+)?)(?:-(\d+(?:[.,]\d+)?))?$/i);
    if (tTok) {
      parsed.thickness_t_test_mm = parseNumberToken(tTok[1]);
      continue;
    }
    const dTok = tok.match(/^D\s*=?\s*(\d+(?:[.,]\d+)?)(?:-(\d+(?:[.,]\d+)?))?$/i);
    if (dTok) {
      parsed.pipe_diameter_test_mm = parseNumberToken(dTok[1]);
      continue;
    }
    if (!parsed.welding_position_test && POSITION_TOKEN_RE.test(up)) {
      parsed.welding_position_test = up;
      continue;
    }
    if (up === "S" || up === "D") {
      if (!parsed.transfer_mode) parsed.transfer_mode = up;
      continue;
    }
    leftover.push(tok);
  }

  if (leftover.length) parsed.weld_details = leftover.join(" ");

  const thk = resolveTestThicknessByJoint({
    joint_type: parsed.joint_type,
    s: parsed.thickness_s_test_mm,
    t: parsed.thickness_t_test_mm,
  });
  parsed.thickness_s_test_mm = thk.s;
  parsed.thickness_t_test_mm = thk.t;

  const hasCore = parsed.welding_process_test && parsed.product_type && parsed.joint_type;
  if (!hasCore) return null;
  return parsed;
}

export default buildWelderDesignation;
