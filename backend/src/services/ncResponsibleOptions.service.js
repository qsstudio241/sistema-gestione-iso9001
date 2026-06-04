/**
 * Opzioni responsabili NC: personale azienda + rubrica studio (ADR-012 S8)
 */

const { query } = require('../config/database');
const { ensurePersonnelNotificationContact, roleTypeForPersonnel } = require('./personnelNotificationBridge.service');

const VALID_SCOPES = new Set(['attuazione', 'verifica']);

function addContact(contacts, seen, row) {
  if (!row?.id || seen.has(row.id)) return;
  seen.add(row.id);
  contacts.push({
    id: row.id,
    name: row.name,
    email: row.email || null,
    role_type: row.role_type,
    active: row.active !== 0 && row.active !== false,
    source: row.source || 'rubrica',
  });
}

/**
 * @param {number} organizationId
 * @param {number} companyId
 * @param {'attuazione'|'verifica'} scope
 */
async function listNcResponsibleOptions(organizationId, companyId, scope) {
  if (!VALID_SCOPES.has(scope)) {
    throw new Error('INVALID_SCOPE');
  }

  const contacts = [];
  const seen = new Set();

  const roleFilter = scope === 'attuazione'
    ? "nc.role_type IN ('attuazione', 'generico')"
    : "nc.role_type IN ('verifica', 'generico')";

  if (scope === 'verifica') {
    const studio = await query(`
      SELECT id, name, email, role_type, active
      FROM notification_contacts nc
      WHERE nc.organization_id = @org AND nc.active = 1
        AND nc.company_id IS NULL
        AND ${roleFilter}
      ORDER BY nc.name ASC
    `, { org: organizationId });
    studio.recordset.forEach((row) => addContact(contacts, seen, { ...row, source: 'rubrica_studio' }));
  }

  const companyRubrica = await query(`
    SELECT id, name, email, role_type, active
    FROM notification_contacts nc
    WHERE nc.organization_id = @org AND nc.active = 1
      AND nc.company_id = @company_id
      AND ${roleFilter}
    ORDER BY nc.name ASC
  `, { org: organizationId, company_id: companyId });
  companyRubrica.recordset.forEach((row) => addContact(contacts, seen, { ...row, source: 'rubrica_azienda' }));

  const personnelFlag = scope === 'attuazione' ? 'can_actuation = 1' : 'can_verify = 1';
  const personnel = await query(`
    SELECT id, organization_id, company_id, name, email, active,
           can_actuation, can_verify, notification_contact_id
    FROM company_personnel
    WHERE organization_id = @org AND company_id = @company_id AND active = 1
      AND ${personnelFlag}
    ORDER BY name ASC
  `, { org: organizationId, company_id: companyId });

  for (const person of personnel.recordset) {
    const contactId = await ensurePersonnelNotificationContact(person);
    if (!contactId) continue;

    const mapped = await query(`
      SELECT id, name, email, role_type, active
      FROM notification_contacts
      WHERE id = @id AND organization_id = @org AND active = 1
    `, { id: contactId, org: organizationId });

    const row = mapped.recordset[0];
    if (!row) continue;

    let displayRole = row.role_type;
    if (person.can_actuation && person.can_verify) {
      displayRole = scope === 'verifica' ? 'verifica' : 'attuazione';
    } else {
      displayRole = roleTypeForPersonnel(person);
    }

    addContact(contacts, seen, {
      ...row,
      role_type: displayRole,
      source: 'personale',
    });
  }

  contacts.sort((a, b) => String(a.name).localeCompare(String(b.name), 'it'));
  return contacts;
}

module.exports = {
  listNcResponsibleOptions,
  VALID_SCOPES,
};
