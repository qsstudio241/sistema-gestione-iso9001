/**
 * CONS-6 — Pacchetto di recupero audit (JSON scaricabile).
 * Funzioni pure: audit + coda → payload filtrato per UUID, senza token.
 * Non tocca sync/auth; la coda si legge in sola lettura dallo store esistente.
 */

import { getAuditOrganizationId } from "./auditLocalTenantFilter";
import { getDatabase } from "../services/IndexedDBProvider";

export const AUDIT_RECOVERY_EXPORT_VERSION = 1;

const SYNC_QUEUE_STORE = "syncQueue";

const SECRET_KEY_RE =
  /^(token|access_token|refresh_token|id_token|jwt|authorization|password|passwd|secret|cookie|cookies|bearer|lock_token|locktoken|accessToken|refreshToken|idToken|api_token|apiToken|auth_token|authToken)$/i;

/**
 * @param {object|null|undefined} audit
 * @returns {string|null}
 */
export function extractAuditUuid(audit) {
  if (audit == null) return null;
  const raw =
    audit.metadata?.id ??
    audit.id ??
    audit.metadata?.audit_uuid ??
    audit.audit_uuid ??
    null;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim();
}

/**
 * @param {object|null|undefined} audit
 * @returns {number|null}
 */
export function extractAuditNumericId(audit) {
  const raw = audit?.metadata?.auditId ?? audit?.audit_id ?? null;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isSecretKey(key) {
  return SECRET_KEY_RE.test(String(key || ""));
}

/**
 * Copia profonda omettendo chiavi segrete (token, jwt, password, …).
 * @param {any} value
 * @returns {any}
 */
export function stripSecrets(value) {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (value && typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (isSecretKey(key)) continue;
      out[key] = stripSecrets(child);
    }
    return out;
  }
  return value;
}

function collectQueueItemAuditRefs(item) {
  const payload = item?.payload && typeof item.payload === "object" ? item.payload : {};
  const event = payload.event && typeof payload.event === "object" ? payload.event : {};
  return [
    payload.audit_uuid,
    payload.auditUuid,
    payload.auditId,
    event.auditUuid,
    event.audit_uuid,
    event.auditId,
    item?.audit_uuid,
    item?.auditUuid,
    item?.auditId,
  ]
    .filter((v) => v != null && String(v).trim() !== "")
    .map((v) => String(v).trim());
}

function getQueueItemOrganizationId(item) {
  if (item == null) return null;
  const fromItem = item.organization_id ?? item.organizationId ?? null;
  if (fromItem != null && fromItem !== "") return fromItem;
  const payload = item.payload && typeof item.payload === "object" ? item.payload : {};
  const fromPayload = payload.organization_id ?? payload.organizationId ?? null;
  if (fromPayload != null && fromPayload !== "") return fromPayload;
  return null;
}

/**
 * True se l'item coda appartiene all'audit (UUID o id numerico server).
 * @param {object} item
 * @param {{ auditUuid?: string|null, auditNumericId?: number|null }} ids
 */
export function queueItemMatchesAuditIds(item, ids) {
  const refs = collectQueueItemAuditRefs(item);
  if (ids?.auditUuid && refs.some((r) => r === String(ids.auditUuid))) return true;
  if (ids?.auditNumericId != null && refs.some((r) => r === String(ids.auditNumericId))) {
    return true;
  }
  return false;
}

/**
 * UUID + eventuale scope organization_id (se presente sull'item).
 * @param {object} item
 * @param {{ auditUuid?: string|null, auditNumericId?: number|null, organizationId?: string|number|null }} ctx
 */
export function queueItemMatchesAudit(item, ctx) {
  if (!queueItemMatchesAuditIds(item, ctx)) return false;
  if (ctx?.organizationId == null || ctx.organizationId === "") return true;
  const itemOrg = getQueueItemOrganizationId(item);
  if (itemOrg == null || itemOrg === "") return true;
  return String(itemOrg) === String(ctx.organizationId);
}

/**
 * @param {string|null|undefined} auditUuid
 * @param {string|Date} [exportedAt]
 * @returns {string}
 */
export function buildAuditRecoveryFilename(auditUuid, exportedAt = new Date()) {
  const dateStr =
    typeof exportedAt === "string"
      ? exportedAt.slice(0, 10)
      : exportedAt.toISOString().slice(0, 10);
  const raw = String(auditUuid || "").trim();
  const short = raw ? raw.replace(/-/g, "").slice(0, 8) : "sconosciuto";
  return `sgq-audit-recupero-${short}-${dateStr}.json`;
}

/**
 * Costruisce il JSON di recupero. Non muta gli input.
 * @param {object|null|undefined} audit
 * @param {Array} [queueItems]
 * @param {{ exportedAt?: string, organizationId?: string|number|null }} [options]
 * @returns {{ version: number, exportedAt: string, auditUuid: string|null, audit: object, queueItems: object[] }|null}
 */
export function buildAuditRecoveryPackage(audit, queueItems = [], options = {}) {
  if (audit == null) return null;

  const auditUuid = extractAuditUuid(audit);
  const auditNumericId = extractAuditNumericId(audit);
  const organizationId =
    getAuditOrganizationId(audit) ??
    (options.organizationId != null && options.organizationId !== ""
      ? options.organizationId
      : null);
  const exportedAt = options.exportedAt || new Date().toISOString();
  const list = Array.isArray(queueItems) ? queueItems : [];
  const filtered = list.filter((item) =>
    queueItemMatchesAudit(item, { auditUuid, auditNumericId, organizationId }),
  );

  return {
    version: AUDIT_RECOVERY_EXPORT_VERSION,
    exportedAt,
    auditUuid,
    audit: stripSecrets(audit),
    queueItems: stripSecrets(filtered),
  };
}

/**
 * Legge la coda sync in sola lettura (stesso store di syncService, senza modificarlo).
 * @returns {Promise<object[]>}
 */
export async function loadSyncQueueItems() {
  try {
    const db = await getDatabase();
    if (!db?.objectStoreNames?.contains(SYNC_QUEUE_STORE)) return [];
    const tx = db.transaction([SYNC_QUEUE_STORE], "readonly");
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const items = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

/**
 * Download Blob + a[download].
 * @param {object} pkg
 * @param {string} filename
 */
export function triggerJsonDownload(pkg, filename) {
  const blob = new Blob([JSON.stringify(pkg, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Compone il pacchetto e avvia il download. Funziona anche offline.
 * @param {object|null|undefined} audit
 * @param {{ queueItems?: Array, exportedAt?: string, organizationId?: string|number|null }} [options]
 * @returns {Promise<boolean>}
 */
export async function downloadAuditRecoveryCopy(audit, options = {}) {
  if (audit == null) return false;
  const queueItems =
    options.queueItems !== undefined
      ? options.queueItems
      : await loadSyncQueueItems();
  const pkg = buildAuditRecoveryPackage(audit, queueItems, options);
  if (!pkg) return false;
  const filename = buildAuditRecoveryFilename(pkg.auditUuid, pkg.exportedAt);
  triggerJsonDownload(pkg, filename);
  return true;
}
