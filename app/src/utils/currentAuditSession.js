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

export function pickRestoredAuditId(audits) {
  const remembered = readRememberedAuditId();
  if (!remembered) return null;
  const list = Array.isArray(audits) ? audits : [];
  const found = list.some((audit) => {
    const id = audit?.metadata?.id || audit?.id;
    return id != null && String(id) === String(remembered);
  });
  return found ? remembered : null;
}
