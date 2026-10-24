import { describe, expect, it } from 'vitest';
import { decideAuditSync } from './decideAuditSync';

describe('decideAuditSync', () => {
  it('apertura vuota: copia il modello, lo stato resta bozza, non parte nulla', () => {
    const decision = decideAuditSync({ event: 'open_empty', status: 'draft' });
    expect(decision.nextStatus).toBe('draft');
    expect(decision.sendQuestions).toBe(false);
    expect(decision.sendStatusOnly).toBe(false);
    expect(decision.sendScheda).toBe(false);
    expect(decision.bypassLock).toBe(true);

    const alreadyStarted = decideAuditSync({ event: 'open_empty', status: 'in_progress' });
    expect(alreadyStarted.nextStatus).toBe('in_progress');
    expect(alreadyStarted.sendStatusOnly).toBe(false);
    expect(alreadyStarted.sendScheda).toBe(false);
  });

  it('prima risposta: parte solo quella domanda e lo stato in corso, non la scheda', () => {
    const decision = decideAuditSync({ event: 'first_answer', status: 'draft' });
    expect(decision.nextStatus).toBe('in_progress');
    expect(decision.sendQuestions).toBe(true);
    expect(decision.sendStatusOnly).toBe(true);
    expect(decision.sendScheda).toBe(false);
  });

  it('prima risposta con scheda già in attesa: la coda non rimette bozza', () => {
    const decision = decideAuditSync({
      event: 'first_answer',
      status: 'draft',
      pendingScheda: {
        status: 'draft',
        notes: 'bozza',
        auditOutcome: { conclusions: 'dal PC' },
      },
    });
    expect(decision.sendStatusOnly).toBe(true);
    expect(decision.sendScheda).toBe(false);
    expect(decision.patchPendingSchedaStatus).toBe('in_progress');
    expect(decision.pendingScheda.status).toBe('in_progress');
    expect(decision.pendingScheda.notes).toBe('bozza');
    expect(decision.pendingScheda.auditOutcome.conclusions).toBe('dal PC');
  });

  it('risposte successive: solo le domande cambiate, lo stato non si rimanda', () => {
    const decision = decideAuditSync({ event: 'next_answer', status: 'in_progress' });
    expect(decision.nextStatus).toBe('in_progress');
    expect(decision.sendQuestions).toBe(true);
    expect(decision.sendStatusOnly).toBe(false);
    expect(decision.sendScheda).toBe(false);
  });

  it('refresh con bozza locale: la bozza resta in coda e la scheda non riparte', () => {
    const decision = decideAuditSync({
      event: 'refresh_draft',
      status: 'in_progress',
      pendingKeys: ['7'],
    });
    expect(decision.keepPending).toBe(true);
    expect(decision.sendQuestions).toBe(false);
    expect(decision.sendScheda).toBe(false);
    expect(decision.sendStatusOnly).toBe(false);
    expect(decision.nextStatus).toBe('in_progress');
  });

  it('offline: la coda resta; al ritorno della rete partono le domande, non l’audit intero', () => {
    const offline = decideAuditSync({
      event: 'offline',
      online: false,
      pendingKeys: ['7', '8'],
    });
    expect(offline.sendQuestions).toBe(false);
    expect(offline.sendScheda).toBe(false);
    expect(offline.sendStatusOnly).toBe(false);
    expect(offline.keepPending).toBe(true);
    expect(offline.questionKeys).toEqual(['7', '8']);

    const reopened = decideAuditSync({
      event: 'offline',
      online: false,
      organizationId: 4,
      rememberedId: 'audit-locale',
      recentIds: ['audit-locale'],
      localAudits: [
        {
          metadata: { id: 'audit-locale', clientName: 'Smoke', status: 'in_progress' },
          checklist: {
            ISO_9001: {
              clause4: {
                questions: [{ questionId: 7, clauseRef: '4.1', status: 'C', notes: '' }],
              },
            },
          },
        },
        {
          metadata: { id: 'altro-studio', organizationId: 9, clientName: 'Altro' },
          checklist: {},
        },
      ],
      pendingByAudit: {
        'audit-locale': [{ questionId: 7, clauseRef: '4.1', status: 'NC', notes: 'bozza offline' }],
      },
    });
    expect(reopened.sendQuestions).toBe(false);
    expect(reopened.sendScheda).toBe(false);
    expect(reopened.sendStatusOnly).toBe(false);
    expect(reopened.keepPending).toBe(true);
    expect(reopened.reopenFromCache).toBe(true);
    expect(reopened.visibleAudits.map((audit) => audit.metadata.id)).toEqual(['audit-locale']);
    expect(reopened.visibleAudits[0].metadata.organizationId).toBe(4);
    expect(reopened.restoreId).toBe('audit-locale');
    expect(reopened.visibleAudits[0].checklist.ISO_9001.clause4.questions[0].status).toBe('NC');
    expect(reopened.visibleAudits[0].checklist.ISO_9001.clause4.questions[0].notes).toBe('bozza offline');

    const sameOrg = decideAuditSync({
      event: 'offline',
      online: false,
      organizationId: 4,
      localAudits: [
        { metadata: { id: 'mio', organizationId: 4 } },
        { metadata: { id: 'loro', organizationId: 9 } },
      ],
    });
    expect(sameOrg.visibleAudits.map((audit) => audit.metadata.id)).toEqual(['mio']);
    expect(sameOrg.restoreId).toBeNull();

    const online = decideAuditSync({
      event: 'offline',
      online: true,
      pendingKeys: ['7', '8'],
    });
    expect(online.sendQuestions).toBe(true);
    expect(online.sendScheda).toBe(false);
    expect(online.sendStatusOnly).toBe(false);
    expect(online.questionKeys).toEqual(['7', '8']);
  });

  it('HTTP 200 con rifiuto parziale: esce dalla coda solo la domanda accettata', () => {
    const ok = { questionId: 7, clauseRef: '4.1', status: 'C' };
    const bad = { questionId: 8, clauseRef: '4.2', status: 'NC' };
    const decision = decideAuditSync({
      event: 'partial_200',
      payloads: [ok, bad],
      result: { errors: [{ question_id: 8, clause_ref: '4.2' }] },
    });
    expect(decision.confirmed).toEqual([ok]);
    expect(decision.dropKeys).toEqual(['7']);
    expect(decision.keepKeys).toEqual(['8']);
    expect(decision.sendScheda).toBe(false);
  });

  it('secondo dispositivo: stesso testo non riscrive; un testo più vecchio non copre il server', () => {
    const existing = {
      question_id: 7,
      conformity_status: 'C',
      notes: 'dal PC',
      updated_at: '2026-10-23T12:00:00.000Z',
    };
    const same = decideAuditSync({
      event: 'other_device',
      incoming: { status: 'C', notes: 'dal PC', clientTs: '2026-10-23T12:05:00.000Z' },
      existing,
    });
    expect(same.rewriteRow).toBe(false);
    expect(same.bumpClock).toBe(false);
    expect(same.showConflict).toBe(false);

    const older = decideAuditSync({
      event: 'other_device',
      incoming: { status: 'NC', notes: 'dal telefono', clientTs: '2026-10-23T11:00:00.000Z' },
      existing,
    });
    expect(older.rewriteRow).toBe(false);
    expect(older.bumpClock).toBe(false);
    expect(older.showConflict).toBe(true);
    expect(older.conflict.reason).toBe('server_newer');
  });
});
