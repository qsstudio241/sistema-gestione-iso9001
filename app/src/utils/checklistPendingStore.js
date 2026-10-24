/**
 * Bozza di invio delle domande, per audit e per studio.
 * Resta nel browser dopo refresh, chiusura e offline.
 * La coda IndexedDB (save_question_diff) è lo specchio per il reconnect.
 */

import { decideAuditSync } from './decideAuditSync';

const DEVICE_KEY = 'sgq:device-id';
const PREFIX = 'sgq:qdiff:';
const NOTICE_PREFIX = 'sgq:qconflict:';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() { return map.size; },
  };
}

function storageOf(storage) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return memoryStorage();
}

function noticeStorageOf(storage) {
  if (storage) return storage;
  if (typeof sessionStorage !== 'undefined') return sessionStorage;
  return memoryStorage();
}

export function pendingStorageKey(organizationId, auditUuid) {
  const org = organizationId == null || organizationId === '' ? 'none' : String(organizationId);
  return `${PREFIX}${org}:${String(auditUuid || '').trim().toLowerCase()}`;
}

export function getOrCreateDeviceId(storage) {
  const box = storageOf(storage);
  const current = box.getItem(DEVICE_KEY);
  if (current) return current;
  const created = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `dev-${Date.now()}`;
  box.setItem(DEVICE_KEY, created);
  return created;
}

export function readPending(organizationId, auditUuid, storage) {
  const box = storageOf(storage);
  try {
    const raw = box.getItem(pendingStorageKey(organizationId, auditUuid));
    if (!raw) return { questions: {} };
    const parsed = JSON.parse(raw);
    const questions = parsed?.questions && typeof parsed.questions === 'object'
      ? parsed.questions
      : {};
    return { questions };
  } catch {
    return { questions: {} };
  }
}

export function readPendingQuestionIdSet(organizationId, auditUuid, storage) {
  return new Set(Object.keys(readPending(organizationId, auditUuid, storage).questions));
}

/** Chiave stabile: id numerico, oppure la clausola finché l'id non è ancora noto. */
export function pendingQuestionKey(question) {
  if (!question) return null;
  if (question.questionId != null && question.questionId !== '') return String(question.questionId);
  const clause = question.clauseRef != null ? String(question.clauseRef).trim() : '';
  return clause ? `clause:${clause}` : null;
}

/**
 * Registra la bozza subito, prima del debounce di rete.
 * Se il contenuto non cambia, tiene la stessa chiave di idempotenza e lo stesso orario.
 */
export function upsertPendingQuestion(organizationId, auditUuid, question, storage) {
  const box = storageOf(storage);
  const id = pendingQuestionKey(question);
  if (!auditUuid || !id) return null;
  const current = readPending(organizationId, auditUuid, box);
  const clauseKey = question?.clauseRef ? `clause:${String(question.clauseRef).trim()}` : null;
  const displaced = question?.questionId != null && clauseKey && clauseKey !== id
    ? current.questions[clauseKey]
    : null;
  if (displaced) delete current.questions[clauseKey];
  const prev = current.questions[id] || displaced;
  const status = question.status ?? null;
  const notes = question.notes ?? null;
  const same = prev
    && prev.status === status
    && prev.notes === notes;
  const next = {
    questionId: question.questionId ?? null,
    clauseRef: question.clauseRef ? String(question.clauseRef).trim() : (prev?.clauseRef ?? null),
    questionKey: id,
    status,
    notes,
    baseUpdatedAt: question.baseUpdatedAt ?? prev?.baseUpdatedAt ?? null,
    deviceId: question.deviceId || prev?.deviceId || getOrCreateDeviceId(box),
    organizationId: organizationId ?? null,
    auditUuid: String(auditUuid),
    idempotencyKey: same
      ? prev.idempotencyKey
      : (question.idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idem-${Date.now()}-${id}`)),
    clientTs: same
      ? prev.clientTs
      : (question.clientTs || new Date().toISOString()),
  };
  current.questions[id] = next;
  box.setItem(pendingStorageKey(organizationId, auditUuid), JSON.stringify(current));
  return next;
}

export function forgetMatchingQuestions(entries, storage) {
  const box = storageOf(storage);
  const groups = new Map();
  for (const entry of entries || []) {
    if (!entry?.auditUuid || !pendingQuestionKey(entry)) continue;
    const key = pendingStorageKey(entry.organizationId, entry.auditUuid);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  for (const [key, list] of groups) {
    let parsed;
    try {
      parsed = JSON.parse(box.getItem(key) || '{"questions":{}}');
    } catch {
      continue;
    }
    const questions = parsed.questions || {};
    for (const entry of list) {
      const id = pendingQuestionKey(entry);
      if (!id) continue;
      const stored = questions[id];
      if (!stored) continue;
      if (entry.idempotencyKey && stored.idempotencyKey !== entry.idempotencyKey) continue;
      delete questions[id];
    }
    if (Object.keys(questions).length === 0) box.removeItem(key);
    else box.setItem(key, JSON.stringify({ questions }));
  }
}

export function countPendingForAudit(organizationId, auditUuid, storage) {
  return Object.keys(readPending(organizationId, auditUuid, storage).questions).length;
}

export function countAllPending(storage) {
  const box = storageOf(storage);
  let total = 0;
  for (let i = 0; i < box.length; i += 1) {
    const key = box.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    try {
      const parsed = JSON.parse(box.getItem(key) || '{}');
      total += Object.keys(parsed.questions || {}).length;
    } catch {
      /* chiave illeggibile */
    }
  }
  return total;
}

export function listPendingQuestions(storage) {
  const box = storageOf(storage);
  const out = [];
  for (let i = 0; i < box.length; i += 1) {
    const key = box.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    try {
      const parsed = JSON.parse(box.getItem(key) || '{}');
      Object.values(parsed.questions || {}).forEach((question) => {
        if (question) out.push(question);
      });
    } catch {
      /* ignora */
    }
  }
  return out;
}

function noticeKey(auditUuid) {
  return `${NOTICE_PREFIX}${String(auditUuid || '').trim().toLowerCase()}`;
}

export function readConflictNotices(auditUuid, storage) {
  const box = noticeStorageOf(storage);
  try {
    const parsed = JSON.parse(box.getItem(noticeKey(auditUuid)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearConflictNotices(auditUuid, storage) {
  noticeStorageOf(storage).removeItem(noticeKey(auditUuid));
}

/** Tiene in bozza le domande che il server ha rifiutato dentro un HTTP 200. */
export function confirmedPayloads(payloads, result) {
  return decideAuditSync({
    event: 'partial_200',
    payloads: payloads || [],
    result,
  }).confirmed;
}

export function noteQuestionSaveResult(payloads, conflicts, pendingStorage, noticeStorage) {
  forgetMatchingQuestions(payloads, pendingStorage);
  const byAudit = new Map();
  for (const conflict of conflicts || []) {
    const auditUuid = conflict.auditUuid
      || (payloads || []).find((item) => item.questionId != null && String(item.questionId) === String(conflict.question_id))?.auditUuid
      || (payloads || []).find((item) => conflict.clause_ref && item.clauseRef && String(item.clauseRef) === String(conflict.clause_ref))?.auditUuid;
    if (!auditUuid) continue;
    if (!byAudit.has(String(auditUuid))) byAudit.set(String(auditUuid), []);
    byAudit.get(String(auditUuid)).push(conflict);
  }
  let added = 0;
  for (const [auditUuid, list] of byAudit) {
    added += pushConflictNotices(auditUuid, list, noticeStorage);
  }
  return added;
}

export function pushConflictNotices(auditUuid, conflicts, storage) {
  const box = noticeStorageOf(storage);
  const prev = readConflictNotices(auditUuid, box);
  const seen = new Set(prev.map((item) => [
    item.question_id,
    item.client?.conformity_status || '',
    item.server?.conformity_status || '',
    item.client?.client_ts || '',
  ].join('|')));
  const next = prev.slice();
  let added = 0;
  for (const conflict of conflicts || []) {
    const mark = [
      conflict.question_id,
      conflict.client?.conformity_status || '',
      conflict.server?.conformity_status || '',
      conflict.client?.client_ts || '',
    ].join('|');
    if (seen.has(mark)) continue;
    seen.add(mark);
    next.push(conflict);
    added += 1;
  }
  box.setItem(noticeKey(auditUuid), JSON.stringify(next.slice(-20)));
  return added;
}
