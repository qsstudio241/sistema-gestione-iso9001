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
const { toIsoDate, visionPresentDates } = require('./weldingCoordinatorAuth.service');
const { queryOptionalVisionClocks } = require('./qualificationExpirySql');

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

/** Giorno di calendario, senza mezzanotte locale che sposta la data in UTC. */
function formatIsoDate(value) {
  return toIsoDate(value);
}

/** Giorno locale di un Date già portato a mezzanotte locale (il «oggi» del gate). */
function localCalendarIso(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function visionGuideDates(row) {
  return visionPresentDates(row);
}

function visionRowOk(row, todayIso) {
  const dates = visionGuideDates(row);
  if (!dates.length) return true;
  return dates.every((raw) => raw >= todayIso);
}

function visionNearestDate(row) {
  const dates = visionGuideDates(row);
  return dates.reduce((best, raw) => (best == null || raw < best ? raw : best), null);
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

  const todayIso = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}/.test(today)
    ? today.slice(0, 10)
    : localCalendarIso(today);
  const scored = pool.map((v) => {
    const ok = visionRowOk(v, todayIso);
    const guide = visionNearestDate(v);
    const stamp = guide ? Date.parse(`${guide}T12:00:00Z`) : 0;
    let score = 0;
    if (ok && guide) score = 300 + stamp / 1e12;
    else if (ok) score = 200;
    else score = 100 + stamp / 1e12;
    return { v, ok, score, guide };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best.ok) {
    return { state: 'expired', expiry_date: best.guide || best.v.expiry_date, vision_id: best.v.id };
  }
  return { state: 'ok', expiry_date: best.guide || best.v.expiry_date, vision_id: best.v.id };
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
    const key = q.id != null ? `id:${q.id}` : `name:${normalizePersonName(q.person_name)}`;
    if (!key || key === 'name:') continue;
    if (!candidatesMap.has(key)) {
      candidatesMap.set(key, {
        qualification_id: q.id != null ? Number(q.id) : null,
        person_name: q.person_name,
        certificate_number: q.certificate_number || null,
        ndt_method: reportType,
        ndt_level: ndtLevelNumber(q),
        expiry_date: q.expiry_date || null,
      });
    }
  }
  const candidates = [...candidatesMap.values()].sort((a, b) => {
    const byName = String(a.person_name).localeCompare(String(b.person_name), 'it');
    if (byName !== 0) return byName;
    return (Number(a.qualification_id) || 0) - (Number(b.qualification_id) || 0);
  });

  const linkedRaw = opts.qualificationId;
  const linkedId = linkedRaw != null && linkedRaw !== '' ? Number(linkedRaw) : null;
  let personQuals;
  let nameForMessages = inspectorName;
  let visionPersonnelId = opts.personnelId;

  if (linkedId != null && Number.isFinite(linkedId)) {
    const linked = ndtQuals.find((q) => Number(q.id) === linkedId);
    if (!linked) {
      return {
        ok: false,
        reasons: ['Il patentino collegato al verbale non è più in anagrafica.'],
        qualification: null,
        vision: { state: 'unknown', expiry_date: null, vision_id: null },
        candidates,
      };
    }
    personQuals = [linked];
    nameForMessages = linked.person_name || inspectorName;
    visionPersonnelId = linked.personnel_id;
  } else if (!inspectorName) {
    return {
      ok: false,
      reasons: ['Indicare il nome dell\'ispettore.'],
      qualification: null,
      vision: { state: 'unknown', expiry_date: null, vision_id: null },
      candidates,
    };
  } else if (!reportType) {
    return {
      ok: false,
      reasons: ['Indicare il metodo del verbale (VT, MT, PT, UT, \u2026).'],
      qualification: null,
      vision: { state: 'unknown', expiry_date: null, vision_id: null },
      candidates,
    };
  } else {
    personQuals = ndtQuals.filter((q) => personMatches(q, inspectorName, opts.personnelId));
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

  if (personQuals.length === 0) {
    return {
      ok: false,
      reasons: [`Nessun patentino ISO 9712 in anagrafica per ${nameForMessages}.`],
      qualification: null,
      vision: visionStateForPerson(visionRows, nameForMessages, visionPersonnelId, companyId, today),
      candidates,
    };
  }

  const methodQuals = personQuals.filter((q) => qualCoversMethod(q, reportType));
  if (methodQuals.length === 0) {
    const have = [...new Set(personQuals.map((q) => normalizeMethod(q.ndt_method) || 'non indicato'))].join(', ');
    return {
      ok: false,
      reasons: [`Patentino ISO 9712 di ${nameForMessages} non copre il metodo ${reportType} (metodi in anagrafica: ${have}).`],
      qualification: summarizeQual(personQuals[0]),
      vision: visionStateForPerson(visionRows, nameForMessages, personQuals[0].personnel_id, companyId, today),
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
      vision: visionStateForPerson(visionRows, nameForMessages, latest.personnel_id, companyId, today),
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
      vision: visionStateForPerson(visionRows, nameForMessages, best.personnel_id, companyId, today),
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
    nameForMessages,
    chosen.personnel_id || visionPersonnelId,
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
      AND q.deleted_at IS NULL
      AND q.status NOT IN ('revocata', 'sospesa')
      ${clause}
  `, params);
  return result.recordset || [];
}

async function loadVisionRows(organizationId, allowedCompanyIds) {
  const visionIn = visionFitnessSqlInList();
  const { params, clause } = withCompanyScope(organizationId, allowedCompanyIds);
  const where = `
    FROM qualifications q
    WHERE q.organization_id = @organization_id
      AND q.deleted_at IS NULL
      AND q.status NOT IN ('revocata', 'sospesa')
      AND q.qualification_type IN (${visionIn})
      ${clause}
  `;
  const result = await queryOptionalVisionClocks(
    (sql) => query(sql, params),
    {
      withClocks: `
    SELECT q.id, q.person_name, q.personnel_id, q.qualification_type,
           q.expiry_date, q.near_vision_expiry_date, q.colour_vision_expiry_date,
           q.status, q.company_id
    ${where}`,
      withoutClocks: `
    SELECT q.id, q.person_name, q.personnel_id, q.qualification_type,
           q.expiry_date, q.status, q.company_id
    ${where}`,
    },
  );
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
    qualificationId: opts.qualificationId,
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
  visionStateForPerson,
};
