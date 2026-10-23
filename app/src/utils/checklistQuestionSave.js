/**
 * Punto unico fra la checklist e la rete.
 * Si attiva solo da scheduleChecklistQuestionSave (click o note dell'utente).
 */
import { syncService } from '../services/syncService';
import {
  createChecklistSaveScheduler,
  DEFAULT_DEBOUNCE_MS,
} from './checklistSaveScheduler';

const scheduler = createChecklistSaveScheduler({
  debounceMs: DEFAULT_DEBOUNCE_MS,
  send: (payload, opts) => syncService.postQuestionSave(payload, opts),
});

let guardsInstalled = false;

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
}

export function scheduleChecklistQuestionSave(payload) {
  installGuards();
  if (!payload?.auditUuid || payload.questionId == null) return;
  const key = `${payload.auditUuid}:${payload.questionId}`;
  scheduler.schedule(key, payload);
}

export function subscribeChecklistSave(fn) {
  return scheduler.subscribe(fn);
}

export function checklistSaveSnapshot() {
  return scheduler.snapshot();
}
