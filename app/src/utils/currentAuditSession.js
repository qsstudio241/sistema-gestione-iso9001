export const CURRENT_AUDIT_SESSION_KEY = 'sgq:currentAuditId';
export const RECENT_AUDITS_PREFIX = 'sgq:recentAuditIds:';
const RECENT_AUDIT_LIMIT = 20;

function recentAuditsKey(organizationId) {
  if (organizationId == null || organizationId === '') return `${RECENT_AUDITS_PREFIX}none`;
  return `${RECENT_AUDITS_PREFIX}${organizationId}`;
}

export function readRecentAuditIds(organizationId) {
  try {
    const raw = localStorage.getItem(recentAuditsKey(organizationId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
  } catch (_) {
    return [];
  }
}

/** Elenco durevole: sopravvive al ricaricamento, a differenza della sola scheda di sessione. */
export function rememberRecentAuditId(id, organizationId) {
  if (id == null || id === '') return;
  const current = readRecentAuditIds(organizationId);
  const next = [
    String(id),
    ...current.filter((item) => item.toLowerCase() !== String(id).toLowerCase()),
  ].slice(0, RECENT_AUDIT_LIMIT);
  try {
    localStorage.setItem(recentAuditsKey(organizationId), JSON.stringify(next));
  } catch (_) { /* private mode */ }
}

export function rememberCurrentAuditId(id) {
  if (id == null || id === '') return;
  try {
    sessionStorage.setItem(CURRENT_AUDIT_SESSION_KEY, String(id));
  } catch (_) { /* private mode */ }
}

export function forgetCurrentAuditId() {
  try {
    sessionStorage.removeItem(CURRENT_AUDIT_SESSION_KEY);
  } catch (_) { /* private mode */ }
}

export function readRememberedAuditId() {
  try {
    return sessionStorage.getItem(CURRENT_AUDIT_SESSION_KEY);
  } catch (_) {
    return null;
  }
}

function auditRowId(audit) {
  const id = audit?.metadata?.id || audit?.id;
  return id == null || id === '' ? null : String(id);
}

export function sameAuditId(a, b) {
  if (a == null || b == null || a === '' || b === '') return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

/** Id come sta in lista, così la tendina lo riconosce anche se il maiuscolo è diverso. */
export function resolveAuditId(audits, id) {
  if (id == null || id === '') return null;
  const list = Array.isArray(audits) ? audits : [];
  const found = list.find((audit) => sameAuditId(auditRowId(audit), id));
  return found ? auditRowId(found) : null;
}

export function pickRestoredAuditId(audits) {
  return resolveAuditId(audits, readRememberedAuditId());
}
