export const CURRENT_AUDIT_SESSION_KEY = 'sgq:currentAuditId';

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
