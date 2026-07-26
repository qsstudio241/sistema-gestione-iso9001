/**
 * Test L1 — ncWorkflow gate ISO 10.2 (Aperta / Chiusa)
 */
import { describe, it, expect } from 'vitest';
import {
  canTransitionNcStatus,
  canCloseNc,
  canVerifyAction,
  needsVerificationNotesForStatus,
  isItemOverdue,
  isItemDueSoon,
  filterActionsByDue,
  getActionDueStatus,
  getNcDisplayStatus,
  getNcWorkflowProfile,
  hasVerificationResponsibleSelected,
} from '../utils/ncWorkflow';

describe('ncWorkflow', () => {
  describe('display / profile', () => {
    it('mostra solo Aperta o Chiusa', () => {
      expect(getNcDisplayStatus('open')).toBe('open');
      expect(getNcDisplayStatus('in_progress')).toBe('open');
      expect(getNcDisplayStatus('resolved')).toBe('open');
      expect(getNcDisplayStatus('verified')).toBe('open');
      expect(getNcDisplayStatus('closed')).toBe('closed');
    });

    it('profilo da corrective_action_needed', () => {
      expect(getNcWorkflowProfile({})).toBe('unset');
      expect(getNcWorkflowProfile({ corrective_action_needed: 'no' })).toBe('simple');
      expect(getNcWorkflowProfile({ corrective_action_needed: 'yes' })).toBe('full');
    });
  });

  describe('needsVerificationNotesForStatus', () => {
    it('richiede note per closed (e verified legacy)', () => {
      expect(needsVerificationNotesForStatus('closed')).toBe(true);
      expect(needsVerificationNotesForStatus('verified')).toBe(true);
      expect(needsVerificationNotesForStatus('open')).toBe(false);
    });
  });

  describe('canCloseNc / canTransitionNcStatus', () => {
    const baseSimple = {
      status: 'open',
      corrective_action_needed: 'no',
      corrective_action_evaluation_notes: 'Problema isolato, non ricorre',
      correction_completed_count: 1,
      verification_notes: 'Trattamento efficace',
      verification_contact_id: 12,
    };

    const baseFull = {
      status: 'open',
      corrective_action_needed: 'yes',
      root_cause: 'Mancata formazione',
      correction_completed_count: 1,
      corrective_completed_count: 1,
      verification_notes: 'Azioni efficaci',
      verification_contact_id: 12,
    };

    it('blocca chiusura senza valutazione AC', () => {
      const r = canCloseNc({ status: 'open', correction_completed_count: 1 });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/azione correttiva/i);
    });

    it('blocca chiusura senza correzione completata', () => {
      const r = canCloseNc({ ...baseSimple, correction_completed_count: 0 });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/Correzione/i);
    });

    it('blocca chiusura senza responsabile verifica selezionato', () => {
      expect(hasVerificationResponsibleSelected({ verification_contact_id: null })).toBe(false);
      const r = canCloseNc({ ...baseSimple, verification_contact_id: null });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/Responsabile verifica/i);
    });

    it('percorso semplice: chiusura OK con gate minimi', () => {
      expect(canCloseNc(baseSimple).ok).toBe(true);
      expect(canTransitionNcStatus(baseSimple, 'closed').ok).toBe(true);
    });

    it('percorso semplice: richiede motivazione No', () => {
      const r = canCloseNc({ ...baseSimple, corrective_action_evaluation_notes: '' });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/Motivare/i);
    });

    it('percorso completo: richiede causa e azione correttiva', () => {
      expect(canCloseNc(baseFull).ok).toBe(true);
      expect(canCloseNc({ ...baseFull, root_cause: '' }).ok).toBe(false);
      expect(canCloseNc({ ...baseFull, corrective_completed_count: 0 }).ok).toBe(false);
    });

    it('non richiede più approved_at per chiudere', () => {
      expect(canTransitionNcStatus(baseSimple, 'closed').ok).toBe(true);
      expect(baseSimple.approved_at).toBeUndefined();
    });

    it('blocca transizioni intermedie legacy', () => {
      const r = canTransitionNcStatus({ status: 'open' }, 'in_progress');
      expect(r.ok).toBe(false);
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
