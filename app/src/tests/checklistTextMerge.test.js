import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldKeepLocalText,
  pickMergedNotes,
  applyServerResponsesPreservingLocalNotes,
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
