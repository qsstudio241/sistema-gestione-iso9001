/**
 * companyCounterparties.controller.js — CRUD controparti per azienda (PR1)
 * RBAC: stesso scope auditor_org / company_access di companyPersonnel
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const {
  assertMutatingAllowed,
  sendAccessDenied,
  WRITE_STUDIO_ROLES,
} = require('../services/companyAccess.service');
const personnelCtrl = require('./companyPersonnel.controller');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const VALID_ROLES = new Set(['customer', 'end_customer', 'supplier']);

function validateEmail(email) {
  if (email === null || email === undefined || String(email).trim() === '') return true;
  return EMAIL_RE.test(String(email).trim());
}

function validateRole(role) {
  return VALID_ROLES.has(String(role || '').trim());
}

function roleLabel(role) {
  const map = {
    customer: 'Cliente',
    end_customer: 'Committente finale',
    supplier: 'Fornitore',
  };
  return map[role] || role;
}

async function resolveCounterpartyScope(req, companyId, level = 'read') {
  return personnelCtrl.resolvePersonnelScope(req, companyId, level);
}

async function listCounterparties(req, res) {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    const { scope, denied } = await resolveCounterpartyScope(req, companyId, 'read');
    if (denied) return sendAccessDenied(res, denied);

    const { role, is_active } = req.query;
    const where = ['cc.company_id = @company_id', 'cc.organization_id = @organization_id'];
    const params = { company_id: companyId, organization_id: scope.organization_id };

    if (role && String(role).trim()) {
      if (!validateRole(role)) {
        return res.status(400).json({ error: 'Ruolo non valido', code: 'INVALID_ROLE' });
      }
      where.push('cc.role = @role');
      params.role = String(role).trim();
    }

    if (is_active !== undefined && is_active !== '') {
      where.push('cc.is_active = @is_active');
      params.is_active = is_active === 'true' || is_active === '1' ? 1 : 0;
    }

    const result = await query(`
      SELECT
        cc.id, cc.organization_id, cc.company_id, cc.counterparty_uuid,
        cc.name, cc.vat_number, cc.external_ref, cc.role,
        cc.contact_person, cc.email, cc.phone, cc.address, cc.notes,
        cc.linked_supplier_id, cc.is_active,
        cc.created_by, cc.created_at, cc.updated_at,
        s.name AS linked_supplier_name
      FROM company_counterparties cc
      LEFT JOIN suppliers s ON s.id = cc.linked_supplier_id
      WHERE ${where.join(' AND ')}
      ORDER BY cc.name ASC
    `, params);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error('[COMPANY_COUNTERPARTIES] list error:', err.message);
    res.status(500).json({ error: 'Errore recupero controparti', code: 'SERVER_ERROR' });
  }
}

async function getCounterpartyById(req, res) {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    const counterpartyId = parseInt(req.params.id, 10);
    const { scope, denied } = await resolveCounterpartyScope(req, companyId, 'read');
    if (denied) return sendAccessDenied(res, denied);

    const result = await query(`
      SELECT
        cc.id, cc.organization_id, cc.company_id, cc.counterparty_uuid,
        cc.name, cc.vat_number, cc.external_ref, cc.role,
        cc.contact_person, cc.email, cc.phone, cc.address, cc.notes,
        cc.linked_supplier_id, cc.is_active,
        cc.created_by, cc.created_at, cc.updated_at,
        s.name AS linked_supplier_name
      FROM company_counterparties cc
      LEFT JOIN suppliers s ON s.id = cc.linked_supplier_id
      WHERE cc.id = @id AND cc.company_id = @company_id AND cc.organization_id = @organization_id
    `, {
      id: counterpartyId,
      company_id: companyId,
      organization_id: scope.organization_id,
    });

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Controparte non trovata', code: 'NOT_FOUND' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    logger.error('[COMPANY_COUNTERPARTIES] getById error:', err.message);
    res.status(500).json({ error: 'Errore recupero controparte', code: 'SERVER_ERROR' });
  }
}

async function createCounterparty(req, res) {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    const writeDenied = await assertMutatingAllowed(req.user, { companyId });
    if (writeDenied) return sendAccessDenied(res, writeDenied);

    const { scope, denied } = await resolveCounterpartyScope(req, companyId, 'write');
    if (denied) return sendAccessDenied(res, denied);

    const {
      name,
      vat_number,
      external_ref,
      role,
      contact_person,
      email,
      phone,
      address,
      notes,
      linked_supplier_id,
      is_active = true,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Nome obbligatorio', code: 'MISSING_NAME' });
    }
    if (!validateRole(role)) {
      return res.status(400).json({ error: 'Ruolo obbligatorio e valido', code: 'INVALID_ROLE' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email non valida', code: 'INVALID_EMAIL' });
    }

    const linkedId = linked_supplier_id != null && linked_supplier_id !== ''
      ? parseInt(linked_supplier_id, 10)
      : null;

    if (linkedId != null && !Number.isFinite(linkedId)) {
      return res.status(400).json({ error: 'linked_supplier_id non valido', code: 'INVALID_SUPPLIER' });
    }

    const result = await query(`
      INSERT INTO company_counterparties (
        organization_id, company_id, name, vat_number, external_ref, role,
        contact_person, email, phone, address, notes, linked_supplier_id,
        is_active, created_by, updated_at
      )
      OUTPUT INSERTED.*
      VALUES (
        @organization_id, @company_id, @name, @vat_number, @external_ref, @role,
        @contact_person, @email, @phone, @address, @notes, @linked_supplier_id,
        @is_active, @created_by, GETDATE()
      )
    `, {
      organization_id: scope.organization_id,
      company_id: companyId,
      name: String(name).trim(),
      vat_number: vat_number?.trim() || null,
      external_ref: external_ref?.trim() || null,
      role: String(role).trim(),
      contact_person: contact_person?.trim() || null,
      email: email ? String(email).trim().toLowerCase() : null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      notes: notes?.trim() || null,
      linked_supplier_id: linkedId,
      is_active: is_active ? 1 : 0,
      created_by: req.user?.user_id || null,
    });

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    logger.error('[COMPANY_COUNTERPARTIES] create error:', err.message);
    res.status(500).json({ error: 'Errore creazione controparte', code: 'SERVER_ERROR' });
  }
}

async function updateCounterparty(req, res) {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    const writeDenied = await assertMutatingAllowed(req.user, { companyId });
    if (writeDenied) return sendAccessDenied(res, writeDenied);

    const { scope, denied } = await resolveCounterpartyScope(req, companyId, 'write');
    if (denied) return sendAccessDenied(res, denied);

    const counterpartyId = parseInt(req.params.id, 10);

    const check = await query(`
      SELECT id FROM company_counterparties
      WHERE id = @id AND company_id = @company_id AND organization_id = @organization_id
    `, { id: counterpartyId, company_id: companyId, organization_id: scope.organization_id });

    if (check.recordset.length === 0) {
      return res.status(404).json({ error: 'Controparte non trovata', code: 'NOT_FOUND' });
    }

    const fields = [
      'name', 'vat_number', 'external_ref', 'role',
      'contact_person', 'email', 'phone', 'address', 'notes',
      'linked_supplier_id', 'is_active',
    ];
    const updates = [];
    const params = { id: counterpartyId };

    for (const field of fields) {
      if (req.body[field] === undefined) continue;

      if (field === 'name') {
        if (!String(req.body.name).trim()) {
          return res.status(400).json({ error: 'Nome obbligatorio', code: 'MISSING_NAME' });
        }
        updates.push('name = @name');
        params.name = String(req.body.name).trim();
      } else if (field === 'role') {
        if (!validateRole(req.body.role)) {
          return res.status(400).json({ error: 'Ruolo non valido', code: 'INVALID_ROLE' });
        }
        updates.push('role = @role');
        params.role = String(req.body.role).trim();
      } else if (field === 'email') {
        if (!validateEmail(req.body.email)) {
          return res.status(400).json({ error: 'Email non valida', code: 'INVALID_EMAIL' });
        }
        updates.push('email = @email');
        params.email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
      } else if (field === 'linked_supplier_id') {
        const linkedId = req.body.linked_supplier_id != null && req.body.linked_supplier_id !== ''
          ? parseInt(req.body.linked_supplier_id, 10)
          : null;
        if (linkedId != null && !Number.isFinite(linkedId)) {
          return res.status(400).json({ error: 'linked_supplier_id non valido', code: 'INVALID_SUPPLIER' });
        }
        updates.push('linked_supplier_id = @linked_supplier_id');
        params.linked_supplier_id = linkedId;
      } else if (field === 'is_active') {
        updates.push('is_active = @is_active');
        params.is_active = req.body.is_active ? 1 : 0;
      } else {
        updates.push(`${field} = @${field}`);
        params[field] = req.body[field]?.trim() || null;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nessun campo da aggiornare', code: 'NO_FIELDS' });
    }

    updates.push('updated_at = GETDATE()');

    const result = await query(`
      UPDATE company_counterparties SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id
    `, params);

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    logger.error('[COMPANY_COUNTERPARTIES] update error:', err.message);
    res.status(500).json({ error: 'Errore aggiornamento controparte', code: 'SERVER_ERROR' });
  }
}

async function deactivateCounterparty(req, res) {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    const writeDenied = await assertMutatingAllowed(req.user, { companyId });
    if (writeDenied) return sendAccessDenied(res, writeDenied);

    const { scope, denied } = await resolveCounterpartyScope(req, companyId, 'write');
    if (denied) return sendAccessDenied(res, denied);

    const counterpartyId = parseInt(req.params.id, 10);

    const check = await query(`
      SELECT id, is_active FROM company_counterparties
      WHERE id = @id AND company_id = @company_id AND organization_id = @organization_id
    `, { id: counterpartyId, company_id: companyId, organization_id: scope.organization_id });

    if (check.recordset.length === 0) {
      return res.status(404).json({ error: 'Controparte non trovata', code: 'NOT_FOUND' });
    }

    if (!check.recordset[0].is_active) {
      return res.json({
        success: true,
        message: 'Controparte già disattivata',
        data: check.recordset[0],
      });
    }

    const result = await query(`
      UPDATE company_counterparties SET is_active = 0, updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE id = @id
    `, { id: counterpartyId });

    res.json({ success: true, message: 'Controparte disattivata', data: result.recordset[0] });
  } catch (err) {
    logger.error('[COMPANY_COUNTERPARTIES] deactivate error:', err.message);
    res.status(500).json({ error: 'Errore disattivazione controparte', code: 'SERVER_ERROR' });
  }
}

module.exports = {
  listCounterparties,
  getCounterpartyById,
  createCounterparty,
  updateCounterparty,
  deactivateCounterparty,
  validateRole,
  roleLabel,
  VALID_ROLES,
  WRITE_STUDIO_ROLES,
};
