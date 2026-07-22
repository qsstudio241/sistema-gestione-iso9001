/**
 * notificationContacts.controller.js  -  CRUD rubrica referenti notifiche NC
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

const VALID_ROLES = ['attuazione', 'verifica', 'generico'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function validateEmail(email) {
  return EMAIL_RE.test(String(email || '').trim());
}

async function listContacts(req, res) {
  try {
    const { organization_id } = req.user;
    const { active, role_type } = req.query;

    // La rubrica studio mostra solo i contatti diretti dello studio (company_id IS NULL).
    // I contatti bridge creati da ensurePersonnelNotificationContact (company_id != NULL)
    // appartengono alle aziende clienti e non devono comparire in questa rubrica.
    const where = ['organization_id = @org', 'company_id IS NULL'];
    const params = { org: organization_id };

    if (active !== undefined) {
      where.push('active = @active');
      params.active = active === 'false' ? 0 : 1;
    }
    if (role_type && VALID_ROLES.includes(role_type)) {
      where.push('role_type = @role_type');
      params.role_type = role_type;
    }

    const result = await query(`
      SELECT id, organization_id, name, email, role_type, active, created_at
      FROM notification_contacts
      WHERE ${where.join(' AND ')}
      ORDER BY name ASC
    `, params);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error('listNotificationContacts:', err.message);
    res.status(500).json({ error: 'Errore recupero rubrica referenti' });
  }
}

async function createContact(req, res) {
  try {
    const { organization_id } = req.user;
    const { name, email, role_type = 'generico', active = true } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Nome obbligatorio' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email non valida' });
    }
    if (!VALID_ROLES.includes(role_type)) {
      return res.status(400).json({ error: 'Ruolo non valido', allowed: VALID_ROLES });
    }

    const result = await query(`
      INSERT INTO notification_contacts (organization_id, name, email, role_type, active)
      OUTPUT INSERTED.*
      VALUES (@org, @name, @email, @role_type, @active)
    `, {
      org: organization_id,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      role_type,
      active: active ? 1 : 0,
    });

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    logger.error('createNotificationContact:', err.message);
    res.status(500).json({ error: 'Errore creazione referente' });
  }
}

async function updateContact(req, res) {
  try {
    const { organization_id } = req.user;
    const { id } = req.params;
    const { name, email, role_type, active } = req.body;

    const check = await query(
      'SELECT id FROM notification_contacts WHERE id = @id AND organization_id = @org',
      { id: parseInt(id, 10), org: organization_id },
    );
    if (check.recordset.length === 0) {
      return res.status(404).json({ error: 'Referente non trovato' });
    }

    const updates = [];
    const params = { id: parseInt(id, 10) };

    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: 'Nome obbligatorio' });
      updates.push('name = @name');
      params.name = String(name).trim();
    }
    if (email !== undefined) {
      if (!validateEmail(email)) return res.status(400).json({ error: 'Email non valida' });
      updates.push('email = @email');
      params.email = String(email).trim().toLowerCase();
    }
    if (role_type !== undefined) {
      if (!VALID_ROLES.includes(role_type)) {
        return res.status(400).json({ error: 'Ruolo non valido', allowed: VALID_ROLES });
      }
      updates.push('role_type = @role_type');
      params.role_type = role_type;
    }
    if (active !== undefined) {
      updates.push('active = @active');
      params.active = active ? 1 : 0;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nessun campo da aggiornare' });
    }

    const result = await query(`
      UPDATE notification_contacts SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id
    `, params);

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    logger.error('updateNotificationContact:', err.message);
    res.status(500).json({ error: 'Errore aggiornamento referente' });
  }
}

async function deleteContact(req, res) {
  try {
    const { organization_id } = req.user;
    const { id } = req.params;

    const result = await query(`
      DELETE FROM notification_contacts
      OUTPUT DELETED.id
      WHERE id = @id AND organization_id = @org
    `, { id: parseInt(id, 10), org: organization_id });

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Referente non trovato' });
    }

    res.json({ success: true, message: 'Referente eliminato' });
  } catch (err) {
    if (err.number === 547) {
      return res.status(409).json({
        error: 'Referente collegato a NC/azioni: disattivalo invece di eliminarlo',
      });
    }
    logger.error('deleteNotificationContact:', err.message);
    res.status(500).json({ error: 'Errore eliminazione referente' });
  }
}

module.exports = {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  validateEmail,
  VALID_ROLES,
};
