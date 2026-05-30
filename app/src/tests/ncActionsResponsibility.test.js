/**
 * Test L1  ncWorkflow gate ISO 10.2
 */
import { describe, it, expect } from 'vitest';
import {
  canTransitionNcStatus,
  canVerifyAction,
  needsVerificationNotesForStatus,
  isItemOverdue,
  isItemDueSoon,
  filterActionsByDue,
  getActionDueStatus,
} from '../utils/ncWorkflow';

describe('ncWorkflow', () => {
  describe('needsVerificationNotesForStatus', () => {
    it('richiede note per verified e closed', () => {
      expect(needsVerificationNotesForStatus('verified')).toBe(true);
      expect(needsVerificationNotesForStatus('closed')).toBe(true);
    });

    it('non richiede note per altri stati', () => {
      expect(needsVerificationNotesForStatus('resolved')).toBe(false);
      expect(needsVerificationNotesForStatus('in_progress')).toBe(false);
    });
  });

  describe('canTransitionNcStatus', () => {
    const ncWithNotes = { verification_notes: 'Verifica OK' };
    const ncEmpty = { verification_notes: '' };

    it('consente transizione resolved senza note', () => {
      expect(canTransitionNcStatus(ncEmpty, 'resolved').ok).toBe(true);
    });

    it('blocca verified senza note verifica', () => {
      const result = canTransitionNcStatus(ncEmpty, 'verified');
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/note verifica/i);
    });

    it('consente verified con note verifica', () => {
      expect(canTransitionNcStatus(ncWithNotes, 'verified').ok).toBe(true);
    });

    it('blocca closed senza note verifica', () => {
      expect(canTransitionNcStatus(ncEmpty, 'closed').ok).toBe(false);
    });
  });

  describe('canVerifyAction', () => {
    it('richiede testo non vuoto', () => {
      expect(canVerifyAction('')).toBe(false);
      expect(canVerifyAction('   ')).toBe(false);
      expect(canVerifyAction('Azione efficace')).toBe(true);
    });
  });

  describe('scadenze azioni', () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayIso = `${y}-${m}-${d}`;

    const past = new Date(today);
    past.setDate(past.getDate() - 3);
    const pastIso = past.toISOString().slice(0, 10);

    const soon = new Date(today);
    soon.setDate(soon.getDate() + 5);
    const soonIso = soon.toISOString().slice(0, 10);

    it('segna azione aperta scaduta', () => {
      const action = { due_date: pastIso, status: 'open' };
      expect(isItemOverdue(action)).toBe(true);
      expect(getActionDueStatus(action)).toBe('overdue');
    });

    it('ignora azioni completate o verificate', () => {
      expect(isItemOverdue({ due_date: pastIso, status: 'completed' })).toBe(false);
      expect(isItemOverdue({ due_date: pastIso, status: 'verified' })).toBe(false);
    });

    it('segna azione in scadenza entro 7 giorni', () => {
      const action = { due_date: soonIso, status: 'in_progress' };
      expect(isItemDueSoon(action)).toBe(true);
      expect(getActionDueStatus(action)).toBe('due_soon');
    });

    it('non segna oggi come in scadenza se già scaduta', () => {
      expect(isItemDueSoon({ due_date: pastIso, status: 'open' })).toBe(false);
    });

    it('filtra elenco azioni per scadenza', () => {
      const actions = [
        { action_id: 1, due_date: pastIso, status: 'open' },
        { action_id: 2, due_date: soonIso, status: 'open' },
        { action_id: 3, due_date: todayIso, status: 'open' },
      ];
      expect(filterActionsByDue(actions, 'overdue')).toHaveLength(1);
      expect(filterActionsByDue(actions, 'due_soon').length).toBeGreaterThanOrEqual(2);
    });
  });
});
