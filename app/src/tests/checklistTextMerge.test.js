import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldKeepLocalText,
  pickMergedNotes,
  applyServerResponsesPreservingLocalNotes,
  checklistQuestionBindSignature,
  countPendingMatches,
  mergeChecklistStructuresLocalRichWins,
  localChecklistIsRicher,
  resolveMergedChecklistForReconcile,
  mergeCustomEvidenceResponses,
} from '../utils/checklistTextMerge';
import {
  markDraft,
  clearDraft,
  isDraft,
  hasAnyDraftForAudit,
  _resetDraftRegistryForTests,
} from '../utils/draftFieldRegistry';

describe('checklistTextMerge', () => {
  beforeEach(() => {
    _resetDraftRegistryForTests();
  });

  it('shouldKeepLocalText preferisce testo locale più lungo', () => {
    expect(shouldKeepLocalText('abc def', 'abc')).toBe(true);
    expect(shouldKeepLocalText('abc', 'abc def')).toBe(false);
    expect(shouldKeepLocalText('', 'server')).toBe(false);
    expect(shouldKeepLocalText('solo locale', '')).toBe(true);
  });

  it('pickMergedNotes rispetta forceLocal (draft)', () => {
    expect(pickMergedNotes('digitando', 'server', { forceLocal: true })).toBe('digitando');
  });

  it('applyServerResponsesPreservingLocalNotes non sovrascrive note in draft', () => {
    const auditUuid = 'uuid-test-1';
    markDraft(auditUuid, 'q:42');
    const checklist = {
      ISO_9001: {
        '4.1': {
          questions: [{ questionId: 42, status: 'NOT_ANSWERED', notes: 'testo in digitazione' }],
        },
      },
    };
    const map = { 42: { status: 'C', notes: 'vecchio server' } };
    applyServerResponsesPreservingLocalNotes(checklist, map, auditUuid);
    expect(checklist.ISO_9001['4.1'].questions[0].notes).toBe('testo in digitazione');
    expect(checklist.ISO_9001['4.1'].questions[0].status).toBe('C');
    clearDraft(auditUuid, 'q:42');
  });

  it('non segnala conflitto se la cache locale differisce e la domanda non è in attesa', () => {
    const replaced = [];
    const checklist = {
      ISO_9001: {
        '4.1': {
          questions: [{ questionId: 1, clauseRef: '4.1', status: 'C', notes: 'cache' }],
        },
      },
    };
    applyServerResponsesPreservingLocalNotes(
      checklist,
      { 1: { status: 'NC', notes: 'server', updated_at: '2026-10-23T10:00:00.000Z' } },
      'u1',
      { pendingQuestionIds: new Set(), replaced },
    );
    expect(replaced).toEqual([]);
    expect(checklist.ISO_9001['4.1'].questions[0].status).toBe('NC');
    expect(checklist.ISO_9001['4.1'].questions[0].notes).toBe('server');
  });

  it('non sovrascrive una risposta ancora in attesa, anche se la chiave è la clausola', () => {
    const checklist = {
      ISO_9001: {
        '4.1': {
          questions: [{ questionId: 42, clauseRef: '4.1', status: 'C', notes: 'sul telefono' }],
        },
      },
    };
    applyServerResponsesPreservingLocalNotes(
      checklist,
      { 42: { status: 'NC', notes: 'server' } },
      'u1',
      { pendingQuestionIds: new Set(['clause:4.1']) },
    );
    expect(checklist.ISO_9001['4.1'].questions[0].status).toBe('C');
    expect(checklist.ISO_9001['4.1'].questions[0].notes).toBe('sul telefono');
  });

  it('la bozza si applica solo quando la domanda è già in checklist, e la firma cambia con gli id', () => {
    const pending = [{ questionId: 42, clauseRef: '4.1', status: 'C', notes: 'bozza' }];
    const empty = {};
    expect(countPendingMatches(empty, pending)).toBe(0);
    expect(checklistQuestionBindSignature(empty)).toBe('0:0');
    const withoutId = {
      ISO_9001: { '4.1': { questions: [{ clauseRef: '4.1', status: 'NOT_ANSWERED', notes: '' }] } },
    };
    expect(checklistQuestionBindSignature(withoutId)).toBe('1:0');
    expect(countPendingMatches(withoutId, pending)).toBe(1);
    const withId = {
      ISO_9001: { '4.1': { questions: [{ questionId: 42, clauseRef: '4.1', status: 'NOT_ANSWERED', notes: '' }] } },
    };
    expect(checklistQuestionBindSignature(withId)).toBe('1:1');
    expect(checklistQuestionBindSignature(withId)).not.toBe(checklistQuestionBindSignature(withoutId));
  });

  it('resolveMergedChecklistForReconcile unisce quando locale più ricco', () => {
    const local = {
      ISO_9001: {
        '4.1': {
          questions: [{ questionId: 1, status: 'C', notes: 'nota lunga locale' }],
        },
      },
    };
    const server = {
      ISO_9001: {
        '4.1': {
          questions: [{ questionId: 1, status: 'NOT_ANSWERED', notes: '' }],
        },
      },
    };
    const merged = resolveMergedChecklistForReconcile(local, server, 'u1');
    expect(merged.ISO_9001['4.1'].questions[0].notes).toBe('nota lunga locale');
  });

  it('mergeCustomEvidenceResponses preserva draft custom', () => {
    const auditUuid = 'uuid-custom';
    markDraft(auditUuid, 'custom:item-1');
    const local = { 'item-1': [{ text: 'evidenza locale', attachment_id: null }] };
    const server = { 'item-1': [{ text: 'srv', attachment_id: null }] };
    const merged = mergeCustomEvidenceResponses(local, server, auditUuid);
    expect(merged['item-1'][0].text).toBe('evidenza locale');
    expect(isDraft(auditUuid, 'custom:item-1')).toBe(true);
  });

  it('hasAnyDraftForAudit rileva bozza attiva', () => {
    markDraft('a1', 'q:1');
    expect(hasAnyDraftForAudit('a1')).toBe(true);
    expect(hasAnyDraftForAudit('a2')).toBe(false);
  });

  it('localChecklistIsRicher confronta progresso', () => {
    const local = {
      N: { C: { questions: [{ status: 'C', notes: 'x' }, { status: 'NC', notes: '' }] } },
    };
    const server = {
      N: { C: { questions: [{ status: 'NOT_ANSWERED', notes: '' }] } },
    };
    expect(localChecklistIsRicher(local, server)).toBe(true);
  });

  it('mergeChecklistStructuresLocalRichWins preserva status locale', () => {
    const local = {
      ISO_9001: {
        '4.1': {
          questions: [{ questionId: 5, status: 'NC', notes: 'n' }],
        },
      },
    };
    const server = {
      ISO_9001: {
        '4.1': {
          questions: [{ questionId: 5, status: 'NOT_ANSWERED', notes: '' }],
        },
      },
    };
    const merged = mergeChecklistStructuresLocalRichWins(local, server, null);
    expect(merged.ISO_9001['4.1'].questions[0].status).toBe('NC');
  });
});
