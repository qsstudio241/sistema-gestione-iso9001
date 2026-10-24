/**
 * Voce della tendina Audit: azienda, periodo, codice, stato in italiano.
 * Non decide cosa salvare: è solo testo.
 */
import { getStatusConfigLabel } from "../components/StatusBadge";
import { formatAuditPeriodLabel } from "./auditDatePeriod";

export const AUDIT_OPTION_COMPANY_MISSING = "Azienda non indicata";
export const AUDIT_OPTION_DATE_MISSING = "Data non indicata";
export const AUDIT_OPTION_CODE_MISSING = "Codice non indicato";
export const AUDIT_OPTION_STATUS_MISSING = "Stato non indicato";

const SEP = " \u00b7 ";

function presentName(value) {
  const name = String(value ?? "").trim();
  if (!name || name === "-" || name === "\u2014") return "";
  return name;
}

export function auditOptionStatusLabel(status) {
  const known = getStatusConfigLabel("audit", status);
  if (known) return known;
  const raw = String(status ?? "").trim();
  return raw || AUDIT_OPTION_STATUS_MISSING;
}

export function formatAuditOptionLabel(metadata, { outsideFilter = false } = {}) {
  const company = presentName(metadata?.clientName) || AUDIT_OPTION_COMPANY_MISSING;
  const period = formatAuditPeriodLabel(metadata?.auditDate, metadata?.auditDateEnd)
    || AUDIT_OPTION_DATE_MISSING;
  const code = presentName(metadata?.auditNumber) || AUDIT_OPTION_CODE_MISSING;
  const status = auditOptionStatusLabel(metadata?.status);
  const core = [company, period, code, status].join(SEP);
  const prefix = outsideFilter ? "\u26a0 " : "";
  const suffix = outsideFilter ? " - fuori filtro" : "";
  return `${prefix}${core}${suffix}`;
}
