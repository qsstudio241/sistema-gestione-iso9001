'use strict';

/**
 * Autorizzazione coordinatore responsabile primario — conferma semestrale ISO 9606.
 *
 * Chi può registrare la conferma:
 * 1. admin / superadmin dello studio (sempre)
 * 2. Utente la cui email coincide con company_personnel.is_primary_welding_coordinator=1
 *    per la stessa company_id della qualifica
 *
 * Se nessun coordinatore primario è configurato sull'azienda, solo admin/superadmin.
 * I coordinatori generici o deputy NON sono autorizzati salvo corrispondenza email primario.
 */

const { query } = require('../config/database');

const STUDIO_ADMIN_ROLES = new Set(['admin', 'superadmin']);

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : '';
}

/** Tipi saldatore ISO 9606-1 ammessi per conferma semestrale. */
function isWelder9606Type(qualificationType) {
  const t = String(qualificationType || '').toLowerCase();
  return t.includes('9606') || t.includes('patentino_saldatore') || t === '9606_1';
}

/** Operatori/preparatori ISO 14732 (saldatura automatica/meccanizzata). */
function isOperator14732Type(qualificationType) {
  const t = String(qualificationType || '').toLowerCase();
  return t.includes('14732') || t.includes('qualifica_14732');
}

/**
 * Tipi qualifica che richiedono conferma semestrale per rimanere valide:
 * ISO 9606-1 (saldatori manuali) e ISO 14732 (operatori automatica/meccanizzata)
 * condividono lo stesso requisito di conferma ogni 6 mesi (§ norme).
 */
function requiresSemiannualConfirmation(qualificationType) {
  return isWelder9606Type(qualificationType) || isOperator14732Type(qualificationType);
}

/** Aggiunge mesi a una data ISO (YYYY-MM-DD), restituisce YYYY-MM-DD. */
function addMonthsIso(dateStr, months) {
  const raw = String(dateStr || '').slice(0, 10);
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

async function getPrimaryCoordinatorForCompany(organizationId, companyId) {
  const result = await query(`
    SELECT id, name, email, job_title
    FROM company_personnel
    WHERE organization_id = @organization_id
      AND company_id = @company_id
      AND active = 1
      AND is_primary_welding_coordinator = 1
  `, { organization_id: organizationId, company_id: companyId });
  return result.recordset[0] || null;
}

/**
 * @returns {{ allowed: boolean, reason: string, primary: object|null }}
 */
async function canUserConfirmSemiannual(user, companyId) {
  const role = String(user?.role || '').trim().toLowerCase();
  if (STUDIO_ADMIN_ROLES.has(role)) {
    return { allowed: true, reason: 'studio_admin', primary: null };
  }

  const userEmail = normalizeEmail(user?.email);
  if (!userEmail || !companyId) {
    return { allowed: false, reason: 'no_email_or_company', primary: null };
  }

  const primary = await getPrimaryCoordinatorForCompany(user.organization_id, companyId);
  if (!primary) {
    return { allowed: false, reason: 'no_primary_configured', primary: null };
  }

  const primaryEmail = normalizeEmail(primary.email);
  if (!primaryEmail) {
    return { allowed: false, reason: 'primary_no_email', primary };
  }

  if (userEmail === primaryEmail) {
    return { allowed: true, reason: 'primary_coordinator', primary };
  }

  return { allowed: false, reason: 'not_primary', primary };
}

module.exports = {
  STUDIO_ADMIN_ROLES,
  normalizeEmail,
  isWelder9606Type,
  isOperator14732Type,
  requiresSemiannualConfirmation,
  addMonthsIso,
  getPrimaryCoordinatorForCompany,
  canUserConfirmSemiannual,
};
