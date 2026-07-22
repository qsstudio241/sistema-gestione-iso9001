/**
 * commercialCustomerCounterparty.service.js
 * Risolve commercial_customer_id + snapshot name/ref su commercial_cases.
 */

const { query } = require('../config/database');

function normalizeOptionalText(raw, maxLen) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return maxLen ? s.substring(0, maxLen) : s;
}

function parseCounterpartyId(raw) {
  if (raw === undefined) return { provided: false, value: null };
  if (raw === null || raw === '') return { provided: true, value: null };
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return { provided: true, invalid: true };
  }
  return { provided: true, value: id };
}

async function fetchCounterpartyForCompany(counterpartyId, organizationId, companyId) {
  const r = await query(
    `
    SELECT id, name, external_ref, role, company_id, organization_id, is_active
    FROM company_counterparties
    WHERE id = @id
      AND organization_id = @organizationId
      AND company_id = @companyId
      AND is_active = 1
    `,
    { id: counterpartyId, organizationId, companyId },
  );
  return r.recordset[0] || null;
}

/**
 * Risolve campi committente commerciale per create/update caso.
 * Se commercial_customer_id è impostato, sincronizza snapshot name/ref dalla controparte.
 */
async function resolveCommercialCustomerFields({
  organizationId,
  companyId,
  commercialCustomerIdRaw,
  commercialCustomerNameRaw,
  commercialCustomerRefRaw,
  existing = null,
}) {
  const idParse = parseCounterpartyId(commercialCustomerIdRaw);

  if (idParse.invalid) {
    return {
      ok: false,
      status: 400,
      error: 'commercial_customer_id non valido',
      code: 'VALIDATION_ERROR',
    };
  }

  if (idParse.provided) {
    if (idParse.value == null) {
      const name = commercialCustomerNameRaw !== undefined
        ? normalizeOptionalText(commercialCustomerNameRaw, 255)
        : (existing?.commercial_customer_name ?? null);
      const ref = commercialCustomerRefRaw !== undefined
        ? normalizeOptionalText(commercialCustomerRefRaw, 100)
        : (existing?.commercial_customer_ref ?? null);
      return {
        ok: true,
        commercialCustomerId: null,
        commercialCustomerName: name,
        commercialCustomerRef: ref,
      };
    }

    if (!companyId) {
      return {
        ok: false,
        status: 400,
        error: 'company_id obbligatorio per collegare una controparte',
        code: 'VALIDATION_ERROR',
      };
    }

    const cp = await fetchCounterpartyForCompany(idParse.value, organizationId, companyId);
    if (!cp) {
      return {
        ok: false,
        status: 400,
        error: 'Controparte non trovata per questa azienda',
        code: 'VALIDATION_ERROR',
      };
    }

    return {
      ok: true,
      commercialCustomerId: cp.id,
      commercialCustomerName: cp.name,
      commercialCustomerRef: cp.external_ref,
      counterpartyRole: cp.role,
    };
  }

  const name = commercialCustomerNameRaw !== undefined
    ? normalizeOptionalText(commercialCustomerNameRaw, 255)
    : (existing?.commercial_customer_name ?? null);
  const ref = commercialCustomerRefRaw !== undefined
    ? normalizeOptionalText(commercialCustomerRefRaw, 100)
    : (existing?.commercial_customer_ref ?? null);

  return {
    ok: true,
    commercialCustomerId: existing?.commercial_customer_id ?? null,
    commercialCustomerName: name,
    commercialCustomerRef: ref,
  };
}

const CASE_SELECT_SQL = `
  cc.*,
  cp.name AS counterparty_name,
  cp.role AS counterparty_role,
  cp.external_ref AS counterparty_external_ref
`;

const CASE_FROM_SQL = `
  FROM commercial_cases cc
  LEFT JOIN company_counterparties cp ON cp.id = cc.commercial_customer_id
`;

module.exports = {
  normalizeOptionalText,
  resolveCommercialCustomerFields,
  fetchCounterpartyForCompany,
  CASE_SELECT_SQL,
  CASE_FROM_SQL,
};
