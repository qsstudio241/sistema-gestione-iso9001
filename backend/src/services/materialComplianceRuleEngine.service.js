/**
 * Rule Engine Material Compliance (MC-3, ADR-021).
 * Input: JSON certificato + snapshot KB. Output: status + checks[].
 * Zero rete, zero LLM. Non scrive workflow_status compliant.
 */
'use strict';

const {
  loadMaterialKbSnapshot,
  lookupEn10025Limits,
} = require('./materialKbLoader.service');

const DOC_RANK = { '2.1': 1, '2.2': 2, '3.1': 3, '3.2': 4 };
const LEVEL_RANK = { company: 4, customer: 3, po: 2, material_std: 1, en10204: 1 };
const FILLER_PRODUCT_MISSING = /2560|17632|14174/;
const ISO_14341 = /14341/;

const STRENGTH_A = '35|38|42|46|50';
const STRENGTH_B = '43[AP]|49[AP]|55[AP]|57[AP]';

function parseNumber(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'object') {
    if (Number.isFinite(raw.value)) return raw.value;
    if (Number.isFinite(raw.minJ)) return raw.minJ;
    return null;
  }
  const s = String(raw).trim();
  if (!s || s === '—' || s === '-') return null;
  const range = s.match(/^(\d+(?:[.,]\d+)?)\s*[–\-]\s*(\d+(?:[.,]\d+)?)$/);
  if (range) {
    return {
      min: Number(range[1].replace(',', '.')),
      max: Number(range[2].replace(',', '.')),
    };
  }
  const n = Number(s.replace(',', '.').replace(/[^\d.+-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function asMinMax(value) {
  if (value == null) return null;
  if (typeof value === 'object' && Number.isFinite(value.min)) {
    return { min: value.min, max: Number.isFinite(value.max) ? value.max : Infinity };
  }
  if (Number.isFinite(value)) return { min: value, max: Infinity };
  return null;
}

function stringifyRequired(value) {
  if (value == null) return null;
  if (typeof value === 'object' && Number.isFinite(value.min) && Number.isFinite(value.max)
      && value.max !== Infinity) {
    return `${value.min}–${value.max}`;
  }
  if (typeof value === 'object' && Number.isFinite(value.minJ)) {
    const t = Number.isFinite(value.tempC) ? ` a ${value.tempC} °C` : '';
    return `≥ ${value.minJ} J${t}`;
  }
  if (typeof value === 'object' && Number.isFinite(value.min) && value.max === Infinity) {
    return `≥ ${value.min}`;
  }
  if (typeof value === 'number') return String(value);
  return String(value);
}

function stringifyActual(value) {
  if (value == null) return null;
  if (typeof value === 'object') return stringifyRequired(value);
  return String(value);
}

function pickCertJson(extractedJson, correctedJson) {
  const a = extractedJson && typeof extractedJson === 'object' && !Array.isArray(extractedJson)
    ? extractedJson : {};
  const b = correctedJson && typeof correctedJson === 'object' && !Array.isArray(correctedJson)
    ? correctedJson : {};
  return { ...a, ...b };
}

function parseThicknessMm(cert) {
  const direct = parseNumber(cert.thickness_mm ?? cert.thicknessMm);
  if (typeof direct === 'number') return direct;
  const d = String(cert.dimensions || '').trim();
  if (!d) return null;
  const mm = d.match(/(\d+(?:[.,]\d+)?)\s*mm/i);
  if (mm) return Number(mm[1].replace(',', '.'));
  const x = d.match(/^(\d+(?:[.,]\d+)?)\s*[x×]/i);
  if (x) return Number(x[1].replace(',', '.'));
  return null;
}

function normalizeDocType(raw) {
  const s = String(raw || '').trim();
  if (DOC_RANK[s]) return s;
  const m = s.match(/\b(3\.2|3\.1|2\.2|2\.1)\b/);
  return m ? m[1] : null;
}

function moreSpecific(a, b) {
  return (LEVEL_RANK[a.source_level] || 0) >= (LEVEL_RANK[b.source_level] || 0) ? a : b;
}

function pickMaxMin(candidates) {
  let best = null;
  for (const c of candidates) {
    if (c == null || !Number.isFinite(c.value)) continue;
    if (!best || c.value > best.value || (c.value === best.value && moreSpecific(c, best) === c)) {
      best = c;
    }
  }
  return best;
}

function pickMinMax(candidates) {
  let best = null;
  for (const c of candidates) {
    if (c == null || !Number.isFinite(c.value)) continue;
    if (!best || c.value < best.value || (c.value === best.value && moreSpecific(c, best) === c)) {
      best = c;
    }
  }
  return best;
}

function pickDocType(candidates) {
  let best = null;
  for (const c of candidates) {
    const t = normalizeDocType(c && c.value);
    if (!t) continue;
    const rec = { ...c, value: t, rank: DOC_RANK[t] };
    if (!best || rec.rank > best.rank || (rec.rank === best.rank && moreSpecific(rec, best) === rec)) {
      best = rec;
    }
  }
  return best;
}

function intersectRanges(candidates) {
  const usable = candidates.filter((c) => c && asMinMax(c.value));
  if (!usable.length) return null;
  let min = -Infinity;
  let max = Infinity;
  let source = usable[0];
  for (const c of usable) {
    const r = asMinMax(c.value);
    if (r.min > min) {
      min = r.min;
      source = c;
    } else if (r.min === min) {
      source = moreSpecific(c, source);
    }
    if (r.max < max) {
      max = r.max;
      source = moreSpecific(c, source);
    }
  }
  if (min > max) return { empty: true, source_level: source.source_level, source_ref: source.source_ref };
  return { min, max, source_level: source.source_level, source_ref: source.source_ref };
}

function checkRow({
  requirement_key,
  source_level,
  source_ref,
  required_value,
  actual_value,
  result,
  explanation,
}) {
  return {
    requirement_key,
    source_level,
    source_ref: source_ref || null,
    required_value: required_value == null ? null : stringifyRequired(required_value),
    actual_value: actual_value == null ? null : stringifyActual(actual_value),
    result,
    explanation,
  };
}

function overallStatus(checks) {
  if (checks.some((c) => c.result === 'fail')) return 'fail';
  if (checks.some((c) => c.result === 'pass')) return 'pass';
  return 'skip';
}

function scopeLevels(scope = {}) {
  const out = [];
  for (const level of ['po', 'customer', 'company']) {
    if (scope[level] && typeof scope[level] === 'object') {
      out.push({
        source_level: level,
        source_ref: scope[level].source_ref || level,
        req: scope[level],
      });
    }
  }
  return out;
}

function matchesIso14341Designation(raw) {
  const s = String(raw || '').toUpperCase().replace(/\s+/g, ' ').trim();
  if (!s) return false;
  const prefix = '(?:ISO\\s*14341[- ]?[AB][- ]?)?';
  const deposit = new RegExp(
    `^${prefix}G\\s+(?:${STRENGTH_A}|${STRENGTH_B})\\s+\\S+\\s+\\S+\\s+\\S+`
  );
  if (deposit.test(s)) return true;
  return /^ISO\s*14341[- ]?[AB][- ]?G\s+\S+/.test(s);
}

function actualReH(cert) {
  const n = parseNumber(cert.ReH ?? cert.reh);
  return typeof n === 'number' ? n : null;
}

function actualRm(cert) {
  const n = parseNumber(cert.Rm ?? cert.rm);
  if (typeof n === 'number') return n;
  if (n && typeof n === 'object') return n;
  return null;
}

function actualC(cert) {
  const chem = cert.chemistry && typeof cert.chemistry === 'object' ? cert.chemistry : {};
  const n = parseNumber(chem.C ?? cert.C);
  return typeof n === 'number' ? n : null;
}

function actualCev(cert) {
  const n = parseNumber(cert.CEV ?? cert.Ceq ?? cert.cev);
  return typeof n === 'number' ? n : null;
}

function actualKv(cert) {
  const raw = cert.KV ?? cert.kv;
  if (raw && typeof raw === 'object') {
    const minJ = parseNumber(raw.minJ ?? raw.value ?? raw.J);
    const tempC = parseNumber(raw.tempC ?? raw.temperature);
    if (typeof minJ === 'number') {
      return { minJ, tempC: typeof tempC === 'number' ? tempC : null };
    }
  }
  const n = parseNumber(raw);
  return typeof n === 'number' ? { minJ: n, tempC: parseNumber(cert.KV_temp ?? cert.kv_temp) } : null;
}

function compareMin(actual, requiredMin) {
  if (!Number.isFinite(actual)) return 'skip';
  return actual + 1e-9 >= requiredMin ? 'pass' : 'fail';
}

function compareMax(actual, requiredMax) {
  if (!Number.isFinite(actual)) return 'skip';
  return actual <= requiredMax + 1e-9 ? 'pass' : 'fail';
}

function compareRange(actual, range) {
  if (actual == null) return 'skip';
  const n = typeof actual === 'number' ? actual : null;
  if (!Number.isFinite(n)) return 'skip';
  const lo = n + 1e-9 >= range.min;
  const hi = n <= range.max + 1e-9;
  return lo && hi ? 'pass' : 'fail';
}

function evaluateDocType(cert, scope) {
  const actual = normalizeDocType(cert.inspection_document_type);
  const required = pickDocType(scopeLevels(scope).map((s) => ({
    value: s.req.inspection_document_type,
    source_level: s.source_level,
    source_ref: s.source_ref,
  })));
  if (!required) {
    return checkRow({
      requirement_key: 'inspection_document_type',
      source_level: 'en10204',
      source_ref: 'EN 10204',
      required_value: null,
      actual_value: actual,
      result: 'skip',
      explanation: 'Nessun requisito di tipo documento nello scope (PO / cliente / azienda) — skip, non fail',
    });
  }
  if (!actual) {
    return checkRow({
      requirement_key: 'inspection_document_type',
      source_level: required.source_level,
      source_ref: required.source_ref,
      required_value: required.value,
      actual_value: null,
      result: 'skip',
      explanation: 'Tipo documento assente sul certificato',
    });
  }
  const actualRank = DOC_RANK[actual];
  const result = actualRank >= required.rank ? 'pass' : 'fail';
  return checkRow({
    requirement_key: 'inspection_document_type',
    source_level: required.source_level,
    source_ref: required.source_ref,
    required_value: required.value,
    actual_value: actual,
    result,
    explanation: result === 'pass'
      ? `Tipo ${actual} copre il richiesto ${required.value}`
      : `Capitolato/ordine chiede ${required.value}, il PDF è ${actual}`,
  });
}

function extraLimitCandidates(scope, key) {
  return scopeLevels(scope).map((s) => {
    const raw = s.req[key];
    if (raw == null || raw === '') return null;
    return { value: parseNumber(raw) ?? raw, source_level: s.source_level, source_ref: s.source_ref };
  }).filter(Boolean);
}

function evaluateNumericCheck({
  requirement_key,
  materialCandidate,
  extraCandidates,
  actual,
  kind,
  skipIfNoMaterial,
  skipExplanation,
}) {
  const fromStd = materialCandidate
    ? [{
      value: materialCandidate,
      source_level: 'material_std',
      source_ref: skipIfNoMaterial || 'material_std',
    }]
    : [];
  const all = fromStd.concat(extraCandidates || []);
  if (!all.length) {
    return checkRow({
      requirement_key,
      source_level: 'material_std',
      source_ref: skipIfNoMaterial || 'material_std',
      required_value: null,
      actual_value: actual,
      result: 'skip',
      explanation: skipExplanation || 'Nessun limite nello scope per questo campo',
    });
  }

  let picked;
  if (kind === 'min') picked = pickMaxMin(all.map((c) => ({ ...c, value: typeof c.value === 'number' ? c.value : parseNumber(c.value) })));
  else if (kind === 'max') picked = pickMinMax(all.map((c) => ({ ...c, value: typeof c.value === 'number' ? c.value : parseNumber(c.value) })));
  else picked = intersectRanges(all);

  if (kind === 'range' && picked && picked.empty) {
    return checkRow({
      requirement_key,
      source_level: picked.source_level,
      source_ref: picked.source_ref,
      required_value: null,
      actual_value: actual,
      result: 'fail',
      explanation: 'Intervallo richiesto vuoto dopo il più restrittivo',
    });
  }
  if (!picked) {
    return checkRow({
      requirement_key,
      source_level: 'material_std',
      source_ref: skipIfNoMaterial || 'material_std',
      required_value: null,
      actual_value: actual,
      result: 'skip',
      explanation: 'Limite non confrontabile',
    });
  }

  const required = kind === 'range' ? { min: picked.min, max: picked.max } : picked.value;
  if (actual == null || (kind !== 'range' && !Number.isFinite(actual) && !(actual && actual.minJ))) {
    return checkRow({
      requirement_key,
      source_level: picked.source_level,
      source_ref: picked.source_ref,
      required_value: required,
      actual_value: null,
      result: 'skip',
      explanation: 'Valore assente sul certificato — skip, non fail',
    });
  }

  let result;
  if (kind === 'min') result = compareMin(actual, picked.value);
  else if (kind === 'max') result = compareMax(actual, picked.value);
  else result = compareRange(actual, picked);

  const verb = kind === 'min' ? '≥' : kind === 'max' ? '≤' : 'in';
  return checkRow({
    requirement_key,
    source_level: picked.source_level,
    source_ref: picked.source_ref,
    required_value: required,
    actual_value: actual,
    result,
    explanation: result === 'pass'
      ? `${requirement_key} ${stringifyActual(actual)} rispetta ${verb} ${stringifyRequired(required)}`
      : `${requirement_key} ${stringifyActual(actual)} non rispetta ${verb} ${stringifyRequired(required)}`,
  });
}

function evaluateKvCheck({ materialKv, extraCandidates, actual, skipExplanation }) {
  const fromStd = materialKv && Number.isFinite(materialKv.minJ)
    ? [{ value: materialKv, source_level: 'material_std', source_ref: materialKv.source_ref || 'material_std' }]
    : [];
  const extras = (extraCandidates || []).map((c) => {
    if (c.value && typeof c.value === 'object' && Number.isFinite(c.value.minJ)) return c;
    const n = parseNumber(c.value);
    return typeof n === 'number' ? { ...c, value: { minJ: n, tempC: null } } : null;
  }).filter(Boolean);
  const all = fromStd.concat(extras);
  if (!all.length) {
    return checkRow({
      requirement_key: 'KV',
      source_level: 'material_std',
      source_ref: 'material_std',
      required_value: null,
      actual_value: actual,
      result: 'skip',
      explanation: skipExplanation || 'Nessun limite KV nello scope',
    });
  }
  const picked = pickMaxMin(all.map((c) => ({ ...c, value: c.value.minJ })));
  const src = all.find((c) => c.source_level === picked.source_level && c.value.minJ === picked.value) || all[0];
  const required = { minJ: picked.value, tempC: src.value.tempC };
  if (!actual || !Number.isFinite(actual.minJ)) {
    return checkRow({
      requirement_key: 'KV',
      source_level: picked.source_level,
      source_ref: picked.source_ref,
      required_value: required,
      actual_value: null,
      result: 'skip',
      explanation: 'KV assente sul certificato — skip, non fail',
    });
  }
  const result = compareMin(actual.minJ, picked.value);
  return checkRow({
    requirement_key: 'KV',
    source_level: picked.source_level,
    source_ref: picked.source_ref,
    required_value: required,
    actual_value: actual,
    result,
    explanation: result === 'pass'
      ? `KV ${actual.minJ} J rispetta ≥ ${picked.value} J`
      : `KV ${actual.minJ} J non rispetta ≥ ${picked.value} J`,
  });
}

function evaluateFiller(cert, snapshot, checks) {
  const designation = cert.filler_designation || cert.designation || '';
  const std = String(cert.filler_standard || cert.material_standard || '');
  const skipReason = snapshot.skip.fillerProduct;

  checks.push(checkRow({
    requirement_key: 'ReH',
    source_level: 'material_std',
    source_ref: std || 'filler',
    required_value: null,
    actual_value: actualReH(cert),
    result: 'skip',
    explanation: skipReason,
  }));

  const wants14341 = ISO_14341.test(std) || /^\s*G\b/i.test(designation);
  if (FILLER_PRODUCT_MISSING.test(std) && !ISO_14341.test(std)) {
    checks.push(checkRow({
      requirement_key: 'filler_designation',
      source_level: 'material_std',
      source_ref: std,
      required_value: null,
      actual_value: designation || null,
      result: 'skip',
      explanation: skipReason,
    }));
    return;
  }

  if (wants14341) {
    if (!designation) {
      checks.push(checkRow({
        requirement_key: 'filler_designation',
        source_level: 'material_std',
        source_ref: 'ISO 14341',
        required_value: 'forma G + resistenza + impatto + gas + composizione',
        actual_value: null,
        result: 'skip',
        explanation: 'Designazione apporto assente — skip, non fail',
      }));
      return;
    }
    const ok = matchesIso14341Designation(designation);
    checks.push(checkRow({
      requirement_key: 'filler_designation',
      source_level: 'material_std',
      source_ref: 'ISO 14341',
      required_value: 'forma classificazione ISO 14341',
      actual_value: designation,
      result: ok ? 'pass' : 'fail',
      explanation: ok
        ? 'Forma designazione ISO 14341 accettata (niente soglie chimica 3A/3B)'
        : 'Designazione non rispetta la forma ISO 14341 (classificazione); chimica lotto non valutata',
    }));
    return;
  }

  checks.push(checkRow({
    requirement_key: 'filler_designation',
    source_level: 'material_std',
    source_ref: std || 'filler',
    required_value: null,
    actual_value: designation || null,
    result: 'skip',
    explanation: skipReason,
  }));
}

function evaluateBaseLimits(cert, snapshot, scope, checks) {
  const designation = cert.steel_designation || cert.designation || '';
  const lookup = lookupEn10025Limits(snapshot, {
    materialRole: 'base',
    productForm: cert.product_form,
    designation,
    thicknessMm: parseThicknessMm(cert),
    materialStandard: cert.material_standard,
  });

  const stdRef = lookup.source || 'material_std';
  const skipReason = lookup.skip ? lookup.reason : null;
  const extras = {
    ReH: extraLimitCandidates(scope, 'ReH'),
    Rm: extraLimitCandidates(scope, 'Rm'),
    CEV: extraLimitCandidates(scope, 'CEV'),
    C: extraLimitCandidates(scope, 'C'),
    KV: extraLimitCandidates(scope, 'KV'),
  };

  if (lookup.skip) {
    checks.push(evaluateNumericCheck({
      requirement_key: 'ReH',
      materialCandidate: null,
      extraCandidates: extras.ReH,
      actual: actualReH(cert),
      kind: 'min',
      skipIfNoMaterial: stdRef,
      skipExplanation: skipReason,
    }));
    checks.push(evaluateNumericCheck({
      requirement_key: 'Rm',
      materialCandidate: null,
      extraCandidates: extras.Rm,
      actual: actualRm(cert),
      kind: 'range',
      skipIfNoMaterial: stdRef,
      skipExplanation: skipReason,
    }));
    checks.push(evaluateNumericCheck({
      requirement_key: 'CEV',
      materialCandidate: null,
      extraCandidates: extras.CEV,
      actual: actualCev(cert),
      kind: 'max',
      skipIfNoMaterial: stdRef,
      skipExplanation: skipReason,
    }));
    checks.push(evaluateNumericCheck({
      requirement_key: 'C',
      materialCandidate: null,
      extraCandidates: extras.C,
      actual: actualC(cert),
      kind: 'max',
      skipIfNoMaterial: stdRef,
      skipExplanation: skipReason,
    }));
    checks.push(evaluateKvCheck({
      materialKv: null,
      extraCandidates: extras.KV,
      actual: actualKv(cert),
      skipExplanation: skipReason,
    }));
    return;
  }

  checks.push(evaluateNumericCheck({
    requirement_key: 'ReH',
    materialCandidate: lookup.rehMin,
    extraCandidates: extras.ReH,
    actual: actualReH(cert),
    kind: 'min',
    skipIfNoMaterial: stdRef,
  }));
  checks.push(evaluateNumericCheck({
    requirement_key: 'Rm',
    materialCandidate: lookup.rm,
    extraCandidates: extras.Rm,
    actual: actualRm(cert),
    kind: 'range',
    skipIfNoMaterial: stdRef,
  }));
  checks.push(evaluateNumericCheck({
    requirement_key: 'CEV',
    materialCandidate: lookup.cevMax,
    extraCandidates: extras.CEV,
    actual: actualCev(cert),
    kind: 'max',
    skipIfNoMaterial: stdRef,
  }));
  checks.push(evaluateNumericCheck({
    requirement_key: 'C',
    materialCandidate: lookup.cHeatMax,
    extraCandidates: extras.C,
    actual: actualC(cert),
    kind: 'max',
    skipIfNoMaterial: stdRef,
  }));
  checks.push(evaluateKvCheck({
    materialKv: lookup.kv ? { ...lookup.kv, source_ref: stdRef } : null,
    extraCandidates: extras.KV,
    actual: actualKv(cert),
  }));
}

/**
 * Valuta un certificato materiale. Non persiste, non chiama LLM, non imposta compliant.
 * @param {object} opts
 * @param {object} [opts.snapshot] snapshot loader; se omesso viene caricato dal repo
 * @param {object|null} [opts.extractedJson]
 * @param {object|null} [opts.correctedJson]
 * @param {{ po?: object, customer?: object, company?: object }} [opts.scope]
 */
function evaluateMaterialCertificate(opts = {}) {
  const snapshot = opts.snapshot || loadMaterialKbSnapshot();
  const cert = pickCertJson(opts.extractedJson, opts.correctedJson);
  const scope = opts.scope || {};
  const checks = [];

  checks.push(evaluateDocType(cert, scope));

  const role = cert.material_role === 'filler' ? 'filler' : 'base';
  if (role === 'filler') {
    evaluateFiller(cert, snapshot, checks);
  } else {
    evaluateBaseLimits(cert, snapshot, scope, checks);
  }

  return {
    status: overallStatus(checks),
    kb_snapshot_hash: snapshot.hash,
    checks,
  };
}

module.exports = {
  evaluateMaterialCertificate,
  matchesIso14341Designation,
  pickCertJson,
  parseThicknessMm,
  overallStatus,
};
