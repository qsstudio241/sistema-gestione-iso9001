import { describe, expect, it } from 'vitest';
import {
  countAllPending,
  countPendingForAudit,
  forgetMatchingQuestions,
  getOrCreateDeviceId,
  listPendingQuestions,
  pushConflictNotices,
  readConflictNotices,
  pendingQuestionKey,
  upsertPendingQuestion,
} from './checklistPendingStore';

function box() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(String(key), String(value)); },
    removeItem: (key) => { map.delete(key); },
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() { return map.size; },
  };
}

describe('checklistPendingStore', () => {
  it('tiene la bozza per studio e audit e riusa la chiave se il testo non cambia', () => {
    const storage = box();
    const first = upsertPendingQuestion(4, 'ABCD', {
      questionId: 7,
      status: 'C',
      notes: 'a',
    }, storage);
    const second = upsertPendingQuestion(4, 'abcd', {
      questionId: 7,
      status: 'C',
      notes: 'a',
    }, storage);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.clientTs).toBe(first.clientTs);
    expect(countPendingForAudit(4, 'ABCD', storage)).toBe(1);
    expect(getOrCreateDeviceId(storage)).toBe(first.deviceId);
  });

  it('una modifica nuova cambia orario e chiave, e sopravvive alla lettura', () => {
    const storage = box();
    upsertPendingQuestion(4, 'abcd', { questionId: 7, status: 'C', notes: 'a' }, storage);
    const changed = upsertPendingQuestion(4, 'abcd', { questionId: 7, status: 'NC', notes: 'a' }, storage);
    upsertPendingQuestion(4, 'abcd', { questionId: 8, status: 'OSS', notes: '' }, storage);
    expect(countAllPending(storage)).toBe(2);
    expect(listPendingQuestions(storage).map((q) => q.questionId).sort()).toEqual([7, 8]);
    expect(changed.status).toBe('NC');
  });

  it('senza id numerico tiene la bozza sulla clausola e la sostituisce quando l\'id arriva', () => {
    const storage = box();
    const draft = upsertPendingQuestion(4, 'abcd', {
      questionId: null,
      clauseRef: '4.1',
      status: 'C',
      notes: 'prima dell\'id',
    }, storage);
    expect(draft.questionKey).toBe('clause:4.1');
    expect(pendingQuestionKey(draft)).toBe('clause:4.1');
    const withId = upsertPendingQuestion(4, 'abcd', {
      questionId: 42,
      clauseRef: '4.1',
      status: 'C',
      notes: 'prima dell\'id',
    }, storage);
    expect(withId.questionKey).toBe('42');
    expect(countPendingForAudit(4, 'abcd', storage)).toBe(1);
  });

  it('dimentica solo la versione inviata, non una bozza più nuova', () => {
    const storage = box();
    const sent = upsertPendingQuestion(4, 'abcd', { questionId: 7, status: 'C', notes: '' }, storage);
    upsertPendingQuestion(4, 'abcd', { questionId: 7, status: 'NC', notes: 'dopo' }, storage);
    forgetMatchingQuestions([{
      organizationId: 4,
      auditUuid: 'abcd',
      questionId: 7,
      idempotencyKey: sent.idempotencyKey,
    }], storage);
    expect(countPendingForAudit(4, 'abcd', storage)).toBe(1);
    expect(listPendingQuestions(storage)[0].status).toBe('NC');
  });

  it('registra il conflitto una sola volta', () => {
    const storage = box();
    const conflict = {
      question_id: 7,
      reason: 'server_newer',
      server: { conformity_status: 'NC' },
      client: { conformity_status: 'C', client_ts: '2026-10-23T10:00:00.000Z' },
    };
    expect(pushConflictNotices('abcd', [conflict], storage)).toBe(1);
    expect(pushConflictNotices('abcd', [conflict], storage)).toBe(0);
    expect(readConflictNotices('abcd', storage)).toHaveLength(1);
  });
});
