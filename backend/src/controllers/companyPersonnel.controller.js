/**
 * companyPersonnel.controller.js ù CRUD anagrafica personale per azienda (ADR-012)
 * RBAC: stesso scope auditor_org di company.controller.js
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function resolveAuditorOrgId(req) {
  const userOrgId = req.user.auditor_org_id;
  const isSuperadmin = req.user.role === 'admin' && !userOrgId;
  const queryOrgId = req.query.auditor_org_id ? parseInt(req.query.auditor_org_id, 10) : null;

  if (isSuperadmin && queryOrgId) return queryOrgId;
  return userOrgId;
}

function validateEmail(email) {
  if (email === null || email === undefined || String(email).trim() === '') return true;
  return EMAIL_RE.test(String(email).trim());
}

/** Ruoli con permesso scrittura su personale azienda (viewer ? 403). */
const COMPANY_WRITE_ROLES = new Set(['admin', 'auditor', 'superadmin']);

function assertCompanyWriteRole(req, res) {
  const role = String(req.user?.role || '').trim().toLowerCase();
  if (!COMPANY_WRITE_ROLES.has(role)) {
    res.status(403).json({
      error: 'Permesso negato: sola lettura',
      code: 'AUTH_FORBIDDEN',
    });
    return false;
  }
  return true;
}

async function resolveCompanyScope(companyId, auditorOrgId) {
  const result = await query(`
    SELECT c.id AS company_id, ao.organization_id
    FROM companies c
    INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
    WHERE c.id = @company_id AND c.auditor_org_id = @auditor_org_id
  `, { company_id: companyId, auditor_org_id: auditorOrgId });

  return result.recordset[0] || null;
}

async function listPersonnel(req, res) {
  try {
    const auditorOrgId = resolveAuditorOrgId(req);
    if (!auditorOrgId) {
      return res.status(403).json({
        error: 'Specificare auditor_org_id (superadmin) o appartenere a un auditor_org',
        code: 'AUDITOR_ORG_REQUIRED',
      });
    }

    const companyId = parseInt(req.params.companyId, 10);
    if (!Number.isFinite(companyId)) {
      return res.status(400).json({ error: 'companyId non valido', code: 'INVALID_COMPANY_ID' });
    }

    const scope = await resolveCompanyScope(companyId, auditorOrgId);
    if (!scope) {
      return res.status(403).json({ error: 'Azienda non accessibile', code: 'FORBIDDEN' });
    }

    const { active } = req.query;
    const where = ['company_id = @company_id', 'organization_id = @organization_id'];
    const params = { company_id: companyId, organization_id: scope.organization_id };

    if (active !== undefined && active !== '') {
      where.push('active = @active');
      params.active = active === 'true' || active === '1' ? 1 : 0;
    }

    const result = await query(`
      SELECT id, organization_id, company_id, name, job_title, email,
             active, can_actuation, can_verify, notification_contact_id,
             created_at, updated_at
      FROM company_personnel
      WHERE ${where.join(' AND ')}
      ORDER BY name ASC
    `, params);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error('[COMPANY_PERSONNEL] list error:', err.message);
    res.status(500).json({ error: 'Errore recupero personale', code: 'SERVER_ERROR' });
  }
}

async function createPersonnel(req, res) {
  try {
    if (!assertCompanyWriteRole(req, res)) return;

    const auditorOrgId = resolveAuditorOrgId(req);
    if (!auditorOrgId) {
      return res.status(403).json({ error: 'Auditor org richiesto', code: 'AUDITOR_ORG_REQUIRED' });
    }

    const companyId = parseInt(req.params.companyId, 10);
    const scope = await resolveCompanyScope(companyId, auditorOrgId);
    if (!scope) {
      return res.status(403).json({ error: 'Azienda non accessibile', code: 'FORBIDDEN' });
    }

    const {
      name,
      job_title,
      email,
      active = true,
      can_actuation = false,
      can_verify = false,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Nome obbligatorio', code: 'MISSING_NAME' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email non valida', code: 'INVALID_EMAIL' });
    }

    const result = await query(`
      INSERT INTO company_personnel (
        organization_id, company_id, name, job_title, email,
        active, can_actuation, can_verify, updated_at
      )
      OUTPUT INSERTED.*
      VALUES (
        @organization_id, @company_id, @name, @job_title, @email,
        @active, @can_actuation, @can_verify, GETDATE()
      )
    `, {
      organization_id: scope.organization_id,
      company_id: companyId,
      name: String(name).trim(),
      job_title: job_title?.trim() || null,
      email: email ? String(email).trim().toLowerCase() : null,
      active: active ? 1 : 0,
      can_actuation: can_actuation ? 1 : 0,
      can_verify: can_verify ? 1 : 0,
    });

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    logger.error('[COMPANY_PERSONNEL] create error:', err.message);
    res.status(500).json({ error: 'Errore creazione personale', code: 'SERVER_ERROR' });
  }
}

async function updatePersonnel(req, res) {
  try {
    if (!assertCompanyWriteRole(req, res)) return;

    const auditorOrgId = resolveAuditorOrgId(req);
    if (!auditorOrgId) {
      return res.status(403).json({ error: 'Auditor org richiesto', code: 'AUDITOR_ORG_REQUIRED' });
    }

    const companyId = parseInt(req.params.companyId, 10);
    const personnelId = parseInt(req.params.id, 10);
    const scope = await resolveCompanyScope(companyId, auditorOrgId);
    if (!scope) {
      return res.status(403).json({ error: 'Azienda non accessibile', code: 'FORBIDDEN' });
    }

    const check = await query(`
      SELECT id FROM company_personnel
      WHERE id = @id AND company_id = @company_id AND organization_id = @organization_id
    `, { id: personnelId, company_id: companyId, organization_id: scope.organization_id });

    if (check.recordset.length === 0) {
      return res.status(404).json({ error: 'Personale non trovato', code: 'NOT_FOUND' });
    }

    const { name, job_title, email, active, can_actuation, can_verify } = req.body;
    const updates = [];
    const params = { id: personnelId };

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ error: 'Nome obbligatorio', code: 'MISSING_NAME' });
      }
      updates.push('name = @name');
      params.name = String(name).trim();
    }
    if (job_title !== undefined) {
      updates.push('job_title = @job_title');
      params.job_title = job_title?.trim() || null;
    }
    if (email !== undefined) {
      if (!validateEmail(email)) {
        return res.status(400).json({ error: 'Email non valida', code: 'INVALID_EMAIL' });
      }
      updates.push('email = @email');
      params.email = email ? String(email).trim().toLowerCase() : null;
    }
    if (active !== undefined) {
      updates.push('active = @active');
      params.active = active ? 1 : 0;
    }
    if (can_actuation !== undefined) {
      updates.push('can_actuation = @can_actuation');
      params.can_actuation = can_actuation ? 1 : 0;
    }
    if (can_verify !== undefined) {
      updates.push('can_verify = @can_verify');
      params.can_verify = can_verify ? 1 : 0;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nessun campo da aggiornare', code: 'NO_FIELDS' });
    }

    updates.push('updated_at = GETDATE()');

    const result = await query(`
      UPDATE company_personnel SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id
    `, params);

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    logger.error('[COMPANY_PERSONNEL] update error:', err.message);
    res.status(500).json({ error: 'Errore aggiornamento personale', code: 'SERVER_ERROR' });
  }
}

async function deletePersonnel(req, res) {
  try {
    if (!assertCompanyWriteRole(req, res)) return;

    const auditorOrgId = resolveAuditorOrgId(req);
    if (!auditorOrgId) {
      return res.status(403).json({ error: 'Auditor org richiesto', code: 'AUDITOR_ORG_REQUIRED' });
    }

    const companyId = parseInt(req.params.companyId, 10);
    const personnelId = parseInt(req.params.id, 10);
    const scope = await resolveCompanyScope(companyId, auditorOrgId);
    if (!scope) {
      return res.status(403).json({ error: 'Azienda non accessibile', code: 'FORBIDDEN' });
    }

    const row = await query(`
      SELECT id, notification_contact_id, active
      FROM company_personnel
      WHERE id = @id AND company_id = @company_id AND organization_id = @organization_id
    `, { id: personnelId, company_id: companyId, organization_id: scope.organization_id });

    if (row.recordset.length === 0) {
      return res.status(404).json({ error: 'Personale non trovato', code: 'NOT_FOUND' });
    }

    const personnel = row.recordset[0];
    if (personnel.notification_contact_id) {
      const ncRefs = await query(`
        SELECT TOP 1 1 AS has_ref FROM non_conformities
        WHERE responsible_contact_id = @cid OR verification_contact_id = @cid
        UNION ALL
        SELECT TOP 1 1 FROM nc_actions WHERE responsible_contact_id = @cid
      `, { cid: personnel.notification_contact_id });

      if (ncRefs.recordset.length > 0) {
        if (!personnel.active) {
          return res.status(409).json({
            error: 'Personale collegato a NC: giù disattivato',
            code: 'NC_LINKED',
          });
        }
        const result = await query(`
          UPDATE company_personnel SET active = 0, updated_at = GETDATE()
          OUTPUT INSERTED.*
          WHERE id = @id
        `, { id: personnelId });
        return res.json({
          success: true,
          message: 'Personale disattivato (vincolo NC)',
          data: result.recordset[0],
        });
      }
    }

    const result = await query(`
      UPDATE company_personnel SET active = 0, updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE id = @id
    `, { id: personnelId });

    res.json({ success: true, message: 'Personale disattivato', data: result.recordset[0] });
  } catch (err) {
    logger.error('[COMPANY_PERSONNEL] delete error:', err.message);
    res.status(500).json({ error: 'Errore disattivazione personale', code: 'SERVER_ERROR' });
  }
}

module.exports = {
  listPersonnel,
  createPersonnel,
  updatePersonnel,
  deletePersonnel,
  resolveAuditorOrgId,
  validateEmail,
  assertCompanyWriteRole,
  COMPANY_WRITE_ROLES,
};
