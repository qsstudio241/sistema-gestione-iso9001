/**
 * Filtro audit rispetto all'Ambito (CompanyScopeContext).
 * Una sola fonte per l'azienda: l'header, non un secondo select in pagina.
 */

import { isStudioPatrimonioScope } from "./appCompanyScope";

/**
 * company_id numerico dell'Ambito, oppure null se Tutto lo studio / Patrimonio.
 * @param {string|number|null|undefined} companyScope
 * @returns {number|null}
 */
export function resolveNumericCompanyScope(companyScope) {
  if (companyScope == null || companyScope === "") return null;
  if (isStudioPatrimonioScope(companyScope)) return null;
  const n = parseInt(companyScope, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function auditCompanyId(audit) {
  const meta = audit?.metadata || audit || {};
  const raw = meta.companyId ?? meta.company_id;
  if (raw == null || raw === "") return null;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function namesMatch(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

/**
 * @param {object} audit
 * @param {string|number|null|undefined} companyScope  valore Ambito
 * @param {{ scopeCompanyName?: string }} [opts]
 * @returns {boolean}
 */
export function auditMatchesCompanyScope(audit, companyScope, opts = {}) {
  if (companyScope == null || companyScope === "") return true;
  const numericId = resolveNumericCompanyScope(companyScope);
  if (numericId == null) return false;

  const cid = auditCompanyId(audit);
  if (cid != null) return cid === numericId;

  const scopeName = opts.scopeCompanyName;
  if (!scopeName) return false;
  const clientName = audit?.metadata?.clientName ?? audit?.client_name ?? "";
  return namesMatch(clientName, scopeName);
}
