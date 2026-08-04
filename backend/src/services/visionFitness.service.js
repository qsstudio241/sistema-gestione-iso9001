/**
 * visionFitness.service.js
 * Idoneità visiva (acuità + Ishihara) richiesta per personale NDT (ISO 9712)
 * e per ispettori VT / saldatori quando rilevante ISO 3834.
 *
 * Un certificato oculistico unico copre acuità e visione cromatica.
 * Gap = persona con qualifica che richiede visione, senza certificato valido collegato.
 */

'use strict';

const { getPool } = require('../config/database');
const {
  visionFitnessSqlInList,
  isVisionFitnessType,
} = require('../constants/occupationalQualificationTypes');

/**
 * Tipi qualifica che richiedono idoneità visiva in corso di validità.
 * @param {string} qualificationType
 * @returns {boolean}
 */
function requiresVisionFitness(qualificationType) {
  const t = String(qualificationType || '');
  if (!t) return false;
  if (isVisionFitnessType(t)) return false; // il certificato stesso non richiede un altro
  if (/NDT/i.test(t)) return true;
  // VT come metodo NDT o ispettore visivo
  if (/\bVT\b/i.test(t) || /esame\s+visivo/i.test(t)) return true;
  return false;
}

function normalizePersonName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Elenco gap visione per org (+ azienda opzionale).
 * @param {number} organizationId
 * @param {{ companyId?: number|null }} [opts]
 * @returns {Promise<{ gaps: object[], summary: object }>}
 */
async function findVisionFitnessGaps(organizationId, opts = {}) {
  const companyId = opts.companyId != null ? parseInt(opts.companyId, 10) : null;
  const pool = await getPool();
  const visionIn = visionFitnessSqlInList();

  const req = pool.request().input('orgId', organizationId);
  let companyClause = '';
  if (companyId && !Number.isNaN(companyId)) {
    req.input('companyId', companyId);
    companyClause = ' AND q.company_id = @companyId';
  }

  const qualsRes = await req.query(`
    SELECT q.id, q.person_name, q.personnel_id, q.qualification_type,
           q.ndt_method, q.expiry_date, q.status, q.company_id,
           c.name AS company_name
    FROM qualifications q
    LEFT JOIN companies c ON c.id = q.company_id
    WHERE q.organization_id = @orgId
      AND q.status NOT IN ('revocata', 'sospesa')
      ${companyClause}
    ORDER BY q.person_name, q.id
  `);

  const requiring = (qualsRes.recordset || []).filter((q) =>
    requiresVisionFitness(q.qualification_type),
  );
  if (requiring.length === 0) {
    return {
      gaps: [],
      summary: { persons_requiring: 0, missing: 0, expired: 0, ok: 0 },
    };
  }

  const visionReq = pool.request().input('orgId', organizationId);
  let visionCompany = '';
  if (companyId && !Number.isNaN(companyId)) {
    visionReq.input('companyId', companyId);
    visionCompany = ' AND q.company_id = @companyId';
  }
  const visionRes = await visionReq.query(`
    SELECT q.id, q.person_name, q.personnel_id, q.qualification_type,
           q.expiry_date, q.status, q.company_id
    FROM qualifications q
    WHERE q.organization_id = @orgId
      AND q.status NOT IN ('revocata', 'sospesa')
      AND q.qualification_type IN (${visionIn})
      ${visionCompany}
  `);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function visionStatus(row) {
    if (!row) return { state: 'missing', expiry_date: null, vision_id: null };
    if (!row.expiry_date) {
      return { state: 'ok', expiry_date: null, vision_id: row.id, note: 'senza_scadenza' };
    }
    const exp = new Date(row.expiry_date);
    exp.setHours(0, 0, 0, 0);
    if (exp < today) {
      return { state: 'expired', expiry_date: row.expiry_date, vision_id: row.id };
    }
    return { state: 'ok', expiry_date: row.expiry_date, vision_id: row.id };
  }

  function pickBestVision(candidates) {
    if (!candidates.length) return null;
    // Preferisci non scaduto con scadenza più lontana; poi senza scadenza; poi scaduto più recente
    const scored = candidates.map((v) => {
      const st = visionStatus(v);
      let score = 0;
      if (st.state === 'ok' && v.expiry_date) score = 300 + new Date(v.expiry_date).getTime() / 1e12;
      else if (st.state === 'ok') score = 200;
      else score = 100 + (v.expiry_date ? new Date(v.expiry_date).getTime() / 1e12 : 0);
      return { v, st, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }

  // Raggruppa per persona (personnel_id preferito, altrimenti nome normalizzato + company)
  const byPerson = new Map();
  for (const q of requiring) {
    const key = q.personnel_id
      ? `pid:${q.personnel_id}`
      : `name:${normalizePersonName(q.person_name)}|c:${q.company_id || 0}`;
    if (!byPerson.has(key)) {
      byPerson.set(key, {
        key,
        person_name: q.person_name,
        personnel_id: q.personnel_id,
        company_id: q.company_id,
        company_name: q.company_name,
        requiring_quals: [],
      });
    }
    byPerson.get(key).requiring_quals.push({
      id: q.id,
      qualification_type: q.qualification_type,
      ndt_method: q.ndt_method,
      expiry_date: q.expiry_date,
    });
  }

  const visionRows = visionRes.recordset || [];
  const gaps = [];
  let missing = 0;
  let expired = 0;
  let ok = 0;

  for (const person of byPerson.values()) {
    const candidates = visionRows.filter((v) => {
      if (person.personnel_id && v.personnel_id) {
        return Number(v.personnel_id) === Number(person.personnel_id);
      }
      return (
        normalizePersonName(v.person_name) === normalizePersonName(person.person_name)
        && Number(v.company_id || 0) === Number(person.company_id || 0)
      );
    });
    const best = pickBestVision(candidates);
    const st = best ? best.st : { state: 'missing', expiry_date: null, vision_id: null };

    if (st.state === 'ok') {
      ok += 1;
      continue;
    }
    if (st.state === 'missing') missing += 1;
    if (st.state === 'expired') expired += 1;

    gaps.push({
      person_name: person.person_name,
      personnel_id: person.personnel_id,
      company_id: person.company_id,
      company_name: person.company_name,
      vision_state: st.state,
      vision_expiry_date: st.expiry_date,
      vision_qualification_id: st.vision_id,
      requiring_quals: person.requiring_quals,
    });
  }

  return {
    gaps,
    summary: {
      persons_requiring: byPerson.size,
      missing,
      expired,
      ok,
    },
  };
}

module.exports = {
  requiresVisionFitness,
  findVisionFitnessGaps,
  normalizePersonName,
};
