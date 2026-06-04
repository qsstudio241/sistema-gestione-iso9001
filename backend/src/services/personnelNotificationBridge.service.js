/**
 * Bridge company_personnel ? notification_contacts (ADR-012 slice S7 minimo)
 */

const { query } = require('../config/database');

function bridgeEmailForPersonnel(personnel) {
  const trimmed = personnel.email ? String(personnel.email).trim().toLowerCase() : '';
  if (trimmed) return trimmed;
  return `personnel.${personnel.id}.${personnel.organization_id}@nc-internal.local`;
}

function roleTypeForPersonnel(personnel) {
  if (personnel.can_actuation && !personnel.can_verify) return 'attuazione';
  if (personnel.can_verify && !personnel.can_actuation) return 'verifica';
  if (personnel.can_actuation && personnel.can_verify) return 'generico';
  return 'generico';
}

/**
 * Garantisce un notification_contact collegato al personale azienda.
 * @returns {Promise<number|null>} contact id
 */
async function ensurePersonnelNotificationContact(personnel) {
  if (!personnel?.id) return null;

  if (personnel.notification_contact_id) {
    const existing = await query(`
      SELECT id FROM notification_contacts
      WHERE id = @id AND organization_id = @org AND active = 1
    `, { id: personnel.notification_contact_id, org: personnel.organization_id });
    if (existing.recordset.length > 0) {
      return personnel.notification_contact_id;
    }
  }

  const email = bridgeEmailForPersonnel(personnel);
  const role_type = roleTypeForPersonnel(personnel);

  const inserted = await query(`
    INSERT INTO notification_contacts (
      organization_id, name, email, role_type, active, company_id, personnel_id
    )
    OUTPUT INSERTED.id
    VALUES (@org, @name, @email, @role_type, 1, @company_id, @personnel_id)
  `, {
    org: personnel.organization_id,
    name: String(personnel.name).trim(),
    email,
    role_type,
    company_id: personnel.company_id,
    personnel_id: personnel.id,
  });

  const contactId = inserted.recordset[0]?.id;
  if (!contactId) return null;

  await query(`
    UPDATE company_personnel
    SET notification_contact_id = @contact_id, updated_at = GETDATE()
    WHERE id = @id AND organization_id = @org
  `, {
    contact_id: contactId,
    id: personnel.id,
    org: personnel.organization_id,
  });

  return contactId;
}

module.exports = {
  ensurePersonnelNotificationContact,
  bridgeEmailForPersonnel,
  roleTypeForPersonnel,
};
