/**
 * Punto unico fra la checklist e la rete.
 * La bozza è scritta subito (sopravvive a refresh e offline).
 * L'invio parte dopo il debounce, a differenze, in un solo batch.
 */
import { syncService } from '../services/syncService';
import {
  createChecklistSaveScheduler,
  DEFAULT_DEBOUNCE_MS,
} from './checklistSaveScheduler';
import {
  listPendingQuestions,
  noteQuestionSaveResult,
  upsertPendingQuestion,
} from './checklistPendingStore';

const scheduler = createChecklistSaveScheduler({
  debounceMs: DEFAULT_DEBOUNCE_MS,
  send: (payload, opts) => deliver([payload], opts),
  sendMany: (payloads, opts) => deliver(payloads, opts),
});

let guardsInstalled = false;
let resumed = false;

function collectConflicts(result) {
  const conflicts = [];
  const rows = Array.isArray(result?.results) ? result.results : [result];
  for (const row of rows) {
    if (!row) continue;
    if (Array.isArray(row.conflicts)) conflicts.push(...row.conflicts);
    if (Array.isArray(row.results?.conflicts)) conflicts.push(...row.results.conflicts);
  }
  if (Array.isArray(result?.conflicts)) conflicts.push(...result.conflicts);
  return conflicts;
}

async function deliver(payloads, opts) {
  const result = await syncService.postQuestionSaves(payloads, opts);
  const conflicts = collectConflicts(result);
  noteQuestionSaveResult(payloads, conflicts);
  try {
    await syncService.clearQuestionDiffMatches(payloads);
  } catch {
    /* la bozza locale è già aggiornata */
  }
  if (conflicts.length && typeof window !== 'undefined') {
    const auditUuid = payloads[0]?.auditUuid || null;
    window.dispatchEvent(new CustomEvent('sgq:question-conflicts', {
      detail: { auditUuid, conflicts },
    }));
  }
  return result;
}

function resumePending() {
  if (resumed) return;
  resumed = true;
  const pending = listPendingQuestions();
  for (const question of pending) {
    if (!question?.auditUuid || question.questionId == null) continue;
    const key = `${question.auditUuid}:${question.questionId}`;
    scheduler.schedule(key, question);
  }
}

function installGuards() {
  if (guardsInstalled || typeof window === 'undefined') return;
  guardsInstalled = true;
  window.addEventListener('beforeunload', (event) => {
    if (!scheduler.hasUnsaved()) return;
    event.preventDefault();
    event.returnValue = '';
  });
  window.addEventListener('pagehide', () => {
    scheduler.flushAllNow({ keepalive: true });
  });
  window.addEventListener('online', () => {
    scheduler.flushAllNow();
  });
  resumePending();
}

export function resumeChecklistPendingSends() {
  installGuards();
}

export function scheduleChecklistQuestionSave(payload) {
  installGuards();
  if (!payload?.auditUuid || payload.questionId == null) return;
  const stored = upsertPendingQuestion(payload.organizationId, payload.auditUuid, {
    questionId: payload.questionId,
    status: payload.status ?? null,
    notes: payload.notes ?? null,
    baseUpdatedAt: payload.baseUpdatedAt ?? null,
    deviceId: payload.deviceId,
  });
  if (!stored) return;
  const enriched = {
    ...payload,
    status: stored.status,
    notes: stored.notes,
    deviceId: stored.deviceId,
    idempotencyKey: stored.idempotencyKey,
    clientTs: stored.clientTs,
    baseUpdatedAt: stored.baseUpdatedAt,
    organizationId: stored.organizationId,
    auditUuid: stored.auditUuid,
  };
  syncService.upsertQuestionDiff(enriched).catch(() => {});
  const key = `${enriched.auditUuid}:${enriched.questionId}`;
  scheduler.schedule(key, enriched);
}

export function subscribeChecklistSave(fn) {
  return scheduler.subscribe(fn);
}

export function checklistSaveSnapshot() {
  return scheduler.snapshot();
}
