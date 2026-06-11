/**
 * personnelQualificationLink.service.js
 * Import anagrafica da qualifiche, backfill personnel_id, validazione collegamento.
 */

const { query } = require('../config/database');

function normalizePersonKey(name, code) {
  const trimmedName = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const trimmedCode = String(code || '').trim().toLowerCase();
  if (trimmedCode) return `code:${trimmedCode}`;
  return `name:${trimmedName}`;
}

function normalizeDisplayName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

async function loadPersonnelIndex(organizationId, companyId) {
  const result = await query(`
    SELECT id, name, person_code, job_title, email, active
    FROM company_personnel
    WHERE organization_id = @organization_id AND company_id = @company_id
  `, { organization_id: organizationId, company_id: companyId });

  const byKey = new Map();
  for (const row of result.recordset) {
    byKey.set(normalizePersonKey(row.name, row.person_code), row);
    if (row.person_code) {
      byKey.set(normalizePersonKey(null, row.person_code), row);
    }
  }
  return { rows: result.recordset, byKey };
}

/**
 * Risolve personnel_id + campi persona per create/update qualifica.
 */
async function resolvePersonnelForQualification({
  organizationId,
  companyId,
  personnelId,
  personName,
  personCode,
}) {
  const pid = personnelId != null && personnelId !== ''
    ? parseInt(personnelId, 10)
    : null;

  if (pid != null && Number.isFinite(pid)) {
    const check = await query(`
      SELECT id, name, person_code
      FROM company_personnel
      WHERE id = @id AND organization_id = @organization_id AND company_id = @company_id
    `, { id: pid, organization_id: organizationId, company_id: companyId });

    const person = check.recordset[0];
    if (!person) {
      return { ok: false, status: 400, error: 'Personale non trovato per questa azienda.', code: 'INVALID_PERSONNEL_ID' };
    }
    return {
      ok: true,
      personnelId: person.id,
      personName: person.name,
      personCode: personCode?.trim() || person.person_code || null,
    };
  }

  const name = normalizeDisplayName(personName);
  if (!name) {
    return { ok: false, status: 400, error: 'Il nome della persona \u00e8 obbligatorio.', code: 'MISSING_PERSON_NAME' };
  }

  return {
    ok: true,
    personnelId: null,
    personName: name,
    personCode: personCode?.trim() || null,
  };
}

/**
 * Import guidato: crea record company_personnel da person_name distinti nelle qualifiche.
 */
async function importPersonnelFromQualifications({ organizationId, companyId }) {
  const qualRows = await query(`
    SELECT DISTINCT
      LTRIM(RTRIM(person_name)) AS person_name,
      NULLIF(LTRIM(RTRIM(person_code)), '') AS person_code,
      NULLIF(LTRIM(RTRIM(department)), '') AS department
    FROM qualifications
    WHERE organization_id = @organization_id
      AND company_id = @company_id
      AND person_name IS NOT NULL
      AND LTRIM(RTRIM(person_name)) <> ''
      AND status <> 'revocata'
  `, { organization_id: organizationId, company_id: companyId });

  const { byKey } = await loadPersonnelIndex(organizationId, companyId);
  let created = 0;
  let skipped = 0;
  const createdIds = [];

  for (const row of qualRows.recordset) {
    const key = normalizePersonKey(row.person_name, row.person_code);
    if (!key || key === 'name:') {
      skipped += 1;
      continue;
    }
    if (byKey.has(key)) {
      skipped += 1;
      continue;
    }

    const insert = await query(`
      INSERT INTO company_personnel (
        organization_id, company_id, name, person_code, job_title, active, updated_at
      )
      OUTPUT INSERTED.id, INSERTED.name, INSERTED.person_code
      VALUES (
        @organization_id, @company_id, @name, @person_code, @job_title, 1, GETDATE()
      )
    `, {
      organization_id: organizationId,
      company_id: companyId,
      name: normalizeDisplayName(row.person_name),
      person_code: row.person_code || null,
      job_title: row.department || null,
    });

    const inserted = insert.recordset[0];
    byKey.set(key, inserted);
    if (inserted.person_code) {
      byKey.set(normalizePersonKey(null, inserted.person_code), inserted);
    }
    created += 1;
    createdIds.push(inserted.id);
  }

  return { created, skipped, created_ids: createdIds };
}

/**
 * Backfill personnel_id sulle qualifiche senza collegamento.
 */
async function linkQualificationsToPersonnel({ organizationId, companyId }) {
  const { byKey } = await loadPersonnelIndex(organizationId, companyId);

  const orphans = await query(`
    SELECT id, person_name, person_code
    FROM qualifications
    WHERE organization_id = @organization_id
      AND company_id = @company_id
      AND personnel_id IS NULL
      AND person_name IS NOT NULL
      AND LTRIM(RTRIM(person_name)) <> ''
      AND status <> 'revocata'
  `, { organization_id: organizationId, company_id: companyId });

  let linked = 0;
  let unmatched = 0;

  for (const q of orphans.recordset) {
    const key = normalizePersonKey(q.person_name, q.person_code);
    const person = byKey.get(key);
    if (!person) {
      unmatched += 1;
      continue;
    }

    await query(`
      UPDATE qualifications
      SET personnel_id = @personnel_id, updated_at = GETDATE()
      WHERE id = @id AND organization_id = @organization_id
    `, {
      id: q.id,
      personnel_id: person.id,
      organization_id: organizationId,
    });
    linked += 1;
  }

  return { linked, unmatched };
}

async function listQualificationsForPersonnel({ organizationId, companyId, personnelId }) {
  const result = await query(`
    SELECT q.id, q.person_name, q.qualification_type, q.certificate_number,
           q.issue_date, q.expiry_date, q.status, q.approval_status, q.personnel_id
    FROM qualifications q
    INNER JOIN company_personnel cp ON cp.id = q.personnel_id
    WHERE q.organization_id = @organization_id
      AND q.company_id = @company_id
      AND q.personnel_id = @personnel_id
      AND cp.organization_id = @organization_id
      AND cp.company_id = @company_id
      AND q.status <> 'revocata'
    ORDER BY q.expiry_date ASC, q.qualification_type ASC
  `, {
    organization_id: organizationId,
    company_id: companyId,
    personnel_id: personnelId,
  });

  return result.recordset;
}

module.exports = {
  normalizePersonKey,
  normalizeDisplayName,
  resolvePersonnelForQualification,
  importPersonnelFromQualifications,
  linkQualificationsToPersonnel,
  listQualificationsForPersonnel,
};
