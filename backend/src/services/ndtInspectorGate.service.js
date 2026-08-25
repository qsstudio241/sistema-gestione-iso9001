/**
 * Gate ispettore verbale CND (CND-2 / ISO-9).
 *
 * Prima del giudizio/firma (status completed|approved):
 * - patentino ISO 9712 valido per il metodo del verbale
 * - livello 2 o 3 per interpretazione autonoma (estratto ISO 9712 §5.3.2)
 * - idoneità visiva in corso di validità (visionFitness)
 *
 * Stesso codice per studio e azienda con licenza cnd/saldatura.
 * Nessuna anagrafica operatori: si riusano qualifications + certificato oculistico.
 */

'use strict';

const { query } = require('../config/database');
const {
  isVisionFitnessType,
  isOccupationalQualificationType,
  visionFitnessSqlInList,
} = require('../constants/occupationalQualificationTypes');
const { normalizePersonName } = require('./visionFitness.service');

const GATE_CODE = 'NDT_INSPECTOR_GATE';
const NDT_METHODS = new Set(['VT', 'MT', 'PT', 'UT', 'RT', 'ET', 'AE', 'TT', 'ST', 'LT']);
const JUDGMENT_STATUSES = new Set(['completed', 'approved']);

function isJudgmentStatus(status) {
  return JUDGMENT_STATUSES.has(String(status || '').trim().toLowerCase());
}

function normalizeMethod(method) {
  return String(method || '').trim().toUpperCase();
}

function startOfDay(value) {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatIsoDate(value) {
  const d = startOfDay(value);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function isNdt9712Qualification(q) {
  if (!q) return false;
  if (isVisionFitnessType(q.qualification_type)) return false;
  const type = String(q.qualification_type || '');
  if (isOccupationalQualificationType(type) && !/NDT|9712|\bVT\b|esame\s+visivo/i.test(type)) {
    return false;
  }
  const method = normalizeMethod(q.ndt_method);
  if (NDT_METHODS.has(method)) return true;
  return /NDT/i.test(type) || /9712/i.test(type) || /\bVT\b/i.test(type) || /esame\s+visivo/i.test(type);
}

function qualCoversMethod(q, reportType) {
  const want = normalizeMethod(reportType);
  if (!want) return false;
  const have = normalizeMethod(q.ndt_method);
  if (have === want) return true;
  if (have) return false;
  const type = String(q.qualification_type || '').toUpperCase();
  return type.includes(want);
}

function isQualNotExpired(q, today) {
  if (!q || !q.expiry_date) return true;
  const exp = startOfDay(q.expiry_date);
  if (!exp) return true;
  return exp >= today;
}

function ndtLevelNumber(q) {
  const n = parseInt(q && q.ndt_level, 10);
  return Number.isFinite(n) ? n : null;
}

function isLevelAutonomous(q) {
  const n = ndtLevelNumber(q);
  return n != null && n >= 2;
}

function personMatches(row, inspectorName, personnelId) {
  if (personnelId != null && row.personnel_id != null) {
    return Number(row.personnel_id) === Number(personnelId);
  }
  return normalizePersonName(row.person_name) === normalizePersonName(inspectorName);
}

function visionStateForPerson(visionRows, inspectorName, personnelId, companyId, today) {
  const candidates = (visionRows || []).filter((v) => personMatches(v, inspectorName, personnelId));
  const preferred = companyId != null
    ? candidates.filter((v) => Number(v.company_id || 0) === Number(companyId))
    : candidates;
  const pool = preferred.length ? preferred : candidates;

  if (pool.length === 0) {
    return { state: 'missing', expiry_date: null, vision_id: null };
  }

  const scored = pool.map((v) => {
    const ok = isQualNotExpired(v, today);
    let score = 0;
    if (ok && v.expiry_date) score = 300 + new Date(v.expiry_date).getTime() / 1e12;
    else if (ok) score = 200;
    else score = 100 + (v.expiry_date ? new Date(v.expiry_date).getTime() / 1e12 : 0);
    return { v, ok, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best.ok) {
    return { state: 'expired', expiry_date: best.v.expiry_date, vision_id: best.v.id };
  }
  return { state: 'ok', expiry_date: best.v.expiry_date, vision_id: best.v.id };
}

function summarizeQual(q) {
  if (!q) return null;
  return {
    id: q.id,
    person_name: q.person_name,
    personnel_id: q.personnel_id || null,
    ndt_method: normalizeMethod(q.ndt_method) || null,
    ndt_level: ndtLevelNumber(q),
    expiry_date: q.expiry_date || null,
    certificate_number: q.certificate_number || null,
    company_id: q.company_id || null,
  };
}

/**
 * Valuta il gate da righe già caricate (testabile senza DB).
 * @returns {{ ok: boolean, reasons: string[], qualification: object|null, vision: object, candidates: object[] }}
 */
function evaluateInspectorFromRows(opts = {}) {
  const inspectorName = String(opts.inspectorName || '').trim();
  const reportType = normalizeMethod(opts.reportType);
  const companyId = opts.companyId != null && opts.companyId !== ''
    ? parseInt(opts.companyId, 10)
    : null;
  const today = startOfDay(opts.today || new Date());
  const ndtQuals = (opts.ndtQuals || []).filter(isNdt9712Qualification);
  const visionRows = opts.visionRows || [];

  const covering = ndtQuals.filter((q) => qualCoversMethod(q, reportType) && isQualNotExpired(q, today));
  const candidatesMap = new Map();
  for (const q of covering) {
    const key = normalizePersonName(q.person_name);
    if (!key) continue;
    if (!candidatesMap.has(key)) {
      candidatesMap.set(key, {
        person_name: q.person_name,
        ndt_method: reportType,
        ndt_level: ndtLevelNumber(q),
        expiry_date: q.expiry_date || null,
      });
    }
  }
  const candidates = [...candidatesMap.values()].sort((a, b) =>
    String(a.person_name).localeCompare(String(b.person_name), 'it')
  );

  if (!inspectorName) {
    return {
      ok: false,
      reasons: ['Indicare il nome dell\'ispettore.'],
      qualification: null,
      vision: { state: 'unknown', expiry_date: null, vision_id: null },
      candidates,
    };
  }
  if (!reportType) {
    return {
      ok: false,
      reasons: ['Indicare il metodo del verbale (VT, MT, PT, UT, \u2026).'],
      qualification: null,
      vision: { state: 'unknown', expiry_date: null, vision_id: null },
      candidates,
    };
  }

  const personQuals = ndtQuals.filter((q) => personMatches(q, inspectorName, opts.personnelId));
  if (personQuals.length === 0) {
    return {
      ok: false,
      reasons: [`Nessun patentino ISO 9712 in anagrafica per ${inspectorName}.`],
      qualification: null,
      vision: visionStateForPerson(visionRows, inspectorName, opts.personnelId, companyId, today),
      candidates,
    };
  }

  const methodQuals = personQuals.filter((q) => qualCoversMethod(q, reportType));
  if (methodQuals.length === 0) {
    const have = [...new Set(personQuals.map((q) => normalizeMethod(q.ndt_method) || 'non indicato'))].join(', ');
    return {
      ok: false,
      reasons: [`Patentino ISO 9712 di ${inspectorName} non copre il metodo ${reportType} (metodi in anagrafica: ${have}).`],
      qualification: summarizeQual(personQuals[0]),
      vision: visionStateForPerson(visionRows, inspectorName, personQuals[0].personnel_id, companyId, today),
      candidates,
    };
  }

  const validMethod = methodQuals.filter((q) => isQualNotExpired(q, today));
  if (validMethod.length === 0) {
    const latest = methodQuals.slice().sort((a, b) => {
      const da = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
      const db = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
      return db - da;
    })[0];
    return {
      ok: false,
      reasons: [`Patentino ISO 9712 ${reportType} scaduto il ${formatIsoDate(latest.expiry_date) || 'data sconosciuta'}.`],
      qualification: summarizeQual(latest),
      vision: visionStateForPerson(visionRows, inspectorName, latest.personnel_id, companyId, today),
      candidates,
    };
  }

  const autonomous = validMethod.filter(isLevelAutonomous);
  if (autonomous.length === 0) {
    const best = validMethod[0];
    const level = ndtLevelNumber(best);
    const levelTxt = level == null ? 'non indicato' : String(level);
    return {
      ok: false,
      reasons: [`Serve livello 2 o 3 per il giudizio autonomo (ISO 9712 \u00a75.3.2). Livello sul patentino: ${levelTxt}.`],
      qualification: summarizeQual(best),
      vision: visionStateForPerson(visionRows, inspectorName, best.personnel_id, companyId, today),
      candidates,
    };
  }

  const preferredCompany = companyId != null
    ? autonomous.filter((q) => Number(q.company_id || 0) === Number(companyId))
    : autonomous;
  const pool = preferredCompany.length ? preferredCompany : autonomous;
  pool.sort((a, b) => {
    const la = ndtLevelNumber(a) || 0;
    const lb = ndtLevelNumber(b) || 0;
    if (lb !== la) return lb - la;
    const da = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
    const db = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
    return db - da;
  });
  const chosen = pool[0];
  const vision = visionStateForPerson(
    visionRows,
    inspectorName,
    chosen.personnel_id || opts.personnelId,
    companyId,
    today,
  );

  if (vision.state === 'missing') {
    return {
      ok: false,
      reasons: ['Idoneit\u00e0 visiva assente. Caricare il certificato oculistico in Qualifiche.'],
      qualification: summarizeQual(chosen),
      vision,
      candidates,
    };
  }
  if (vision.state === 'expired') {
    return {
      ok: false,
      reasons: [`Idoneit\u00e0 visiva scaduta il ${formatIsoDate(vision.expiry_date) || 'data sconosciuta'}.`],
      qualification: summarizeQual(chosen),
      vision,
      candidates,
    };
  }

  return {
    ok: true,
    reasons: [],
    qualification: summarizeQual(chosen),
    vision,
    candidates,
  };
}

async function loadNdtQuals(organizationId, allowedCompanyIds) {
  const { params, clause } = withCompanyScope(organizationId, allowedCompanyIds);
  const result = await query(`
    SELECT q.id, q.person_name, q.personnel_id, q.qualification_type,
           q.ndt_method, q.ndt_level, q.expiry_date, q.status, q.company_id,
           q.certificate_number
    FROM qualifications q
    WHERE q.organization_id = @organization_id
      AND q.status NOT IN ('revocata', 'sospesa')
      ${clause}
  `, params);
  return result.recordset || [];
}

async function loadVisionRows(organizationId, allowedCompanyIds) {
  const visionIn = visionFitnessSqlInList();
  const { params, clause } = withCompanyScope(organizationId, allowedCompanyIds);
  const result = await query(`
    SELECT q.id, q.person_name, q.personnel_id, q.qualification_type,
           q.expiry_date, q.status, q.company_id
    FROM qualifications q
    WHERE q.organization_id = @organization_id
      AND q.status NOT IN ('revocata', 'sospesa')
      AND q.qualification_type IN (${visionIn})
      ${clause}
  `, params);
  return result.recordset || [];
}

function withCompanyScope(organizationId, allowedCompanyIds) {
  const params = { organization_id: organizationId };
  if (!Array.isArray(allowedCompanyIds)) {
    return { params, clause: '' };
  }
  if (allowedCompanyIds.length === 0) {
    return { params, clause: ' AND 1 = 0' };
  }
  const parts = allowedCompanyIds.map((id, i) => {
    const key = `acq_${i}`;
    params[key] = id;
    return `@${key}`;
  });
  return { params, clause: ` AND q.company_id IN (${parts.join(', ')})` };
}

/**
 * @param {{ organizationId: number, companyId?: number|null, inspectorName: string, reportType: string, personnelId?: number|null, allowedCompanyIds?: number[]|null }} opts
 */
async function evaluateNdtInspectorGate(opts = {}) {
  const organizationId = opts.organizationId;
  if (!organizationId) {
    return {
      ok: false,
      reasons: ['Organizzazione assente: impossibile verificare il patentino.'],
      qualification: null,
      vision: { state: 'unknown', expiry_date: null, vision_id: null },
      candidates: [],
    };
  }
  const allowedCompanyIds = Array.isArray(opts.allowedCompanyIds) ? opts.allowedCompanyIds : null;
  const [ndtQuals, visionRows] = await Promise.all([
    loadNdtQuals(organizationId, allowedCompanyIds),
    loadVisionRows(organizationId, allowedCompanyIds),
  ]);
  return evaluateInspectorFromRows({
    inspectorName: opts.inspectorName,
    reportType: opts.reportType,
    companyId: opts.companyId,
    personnelId: opts.personnelId,
    ndtQuals,
    visionRows,
  });
}

module.exports = {
  GATE_CODE,
  isJudgmentStatus,
  isNdt9712Qualification,
  evaluateInspectorFromRows,
  evaluateNdtInspectorGate,
};
