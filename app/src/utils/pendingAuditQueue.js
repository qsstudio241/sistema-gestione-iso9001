/**
 * CONS-4 — Coda pendente vs hydrate server-wins.
 * Se per un audit UUID ci sono item attivi (non stalled) in syncQueue,
 * gli esiti server sono vecchi: non vanno applicati sopra il locale.
 * Dopo processQueue ok (coda vuota per quell’UUID) si può hydratare.
 */

import { resolveMergedChecklistForReconcile } from "./checklistTextMerge";

export const PENDING_AUDIT_HYDRATE_TYPES = Object.freeze([
  "save_responses",
  "save_custom_checklist_responses",
  "update_audit",
  "send_audit_event",
]);

function normalizeRef(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/**
 * Riferimenti audit presenti su un item coda (UUID o id numerico).
 * @param {object|null|undefined} item
 * @returns {string[]}
 */
export function collectQueueItemAuditRefs(item) {
  const payload = item?.payload && typeof item.payload === "object" ? item.payload : {};
  const event = payload.event && typeof payload.event === "object" ? payload.event : {};
  return [
    payload.audit_uuid,
    payload.auditUuid,
    payload.auditId,
    payload.audit_id,
    event.auditUuid,
    event.audit_uuid,
    event.auditId,
    item?.audit_uuid,
    item?.auditUuid,
    item?.auditId,
  ]
    .map(normalizeRef)
    .filter(Boolean);
}

/**
 * Item che blocca l’hydrate server-wins: tipo in elenco e non stalled.
 * @param {object|null|undefined} item
 * @returns {boolean}
 */
export function isActivePendingHydrateItem(item) {
  if (!item || item.isStalled) return false;
  return PENDING_AUDIT_HYDRATE_TYPES.includes(item.type);
}

/**
 * True se la coda ha lavoro non ancora inviato per quell’audit: skip server-wins esiti.
 * extraRefs: id numerico server o altri alias (save_responses / custom usano spesso auditId).
 * @param {Array|null|undefined} queueItems
 * @param {string|number|null|undefined} auditUuid
 * @param {Array<string|number>|string|number|null|undefined} [extraRefs]
 * @returns {boolean}
 */
export function shouldSkipServerHydrate(queueItems, auditUuid, extraRefs = []) {
  const targets = new Set();
  const primary = normalizeRef(auditUuid);
  if (primary) targets.add(primary.toLowerCase());
  const extras = Array.isArray(extraRefs) ? extraRefs : extraRefs == null ? [] : [extraRefs];
  extras.forEach((ref) => {
    const n = normalizeRef(ref);
    if (n) targets.add(n.toLowerCase());
  });
  if (targets.size === 0) return false;

  const list = Array.isArray(queueItems) ? queueItems : [];
  return list.some((item) => {
    if (!isActivePendingHydrateItem(item)) return false;
    return collectQueueItemAuditRefs(item).some((ref) => targets.has(ref.toLowerCase()));
  });
}

/**
 * Checklist in reconcile/hydrate: se la coda è pendente si tiene il locale;
 * altrimenti si riusa resolveMergedChecklistForReconcile (draft + locale più ricco).
 * @param {object|null|undefined} localChecklist
 * @param {object|null|undefined} serverChecklist
 * @param {Array|null|undefined} queueItems
 * @param {string|null|undefined} auditUuid
 * @param {Array<string|number>} [extraRefs]
 */
export function resolveChecklistHydrateWithPendingQueue(
  localChecklist,
  serverChecklist,
  queueItems,
  auditUuid,
  extraRefs = [],
) {
  if (shouldSkipServerHydrate(queueItems, auditUuid, extraRefs) && localChecklist) {
    return localChecklist;
  }
  if (localChecklist) {
    return resolveMergedChecklistForReconcile(localChecklist, serverChecklist, auditUuid);
  }
  return serverChecklist;
}
