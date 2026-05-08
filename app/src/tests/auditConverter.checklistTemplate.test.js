/**
 * Test L1 — auditConverter.backendToFrontend: pre-popolamento checklist da template
 *
 * Causa radice del bug "Checklist Non Inizializzata" su passaggio device:
 * il converter restituiva oggetti vuoti `{ ISO_9001: {}, ISO_14001: {} }` lasciando
 * a un useEffect post-render il compito di copiare il template. Tra primo render
 * e useEffect il fallback "Non Inizializzata" diventava visibile.
 *
 * Il fix popola la struttura checklist direttamente nel converter (sincrono),
 * eliminando la race window.
 */

import { describe, it, expect } from 'vitest';
import { backendToFrontend, buildChecklistFromTemplate } from '../utils/auditConverter';

/**
 * Il converter restituisce checklist con chiavi norma PRESENTI ma struttura interna VUOTA ({}).
 * Questo è intenzionale: il template viene popolato da initializeChecklist (AuditAccordionLayout)
 * e le risposte da fetchAndApplyServerResponses. Pre-popolare il template nel converter causerebbe
 * Exception 4 di reconcileAuditsFromServer a non attivarsi mai, sovrascrivendo le risposte
 * idratate con NOT_ANSWERED ad ogni reconcile (ogni 45s).
 */
describe('auditConverter — struttura checklist dal converter', () => {
  it('audit con due standard → checklist contiene entrambe le chiavi norma (struttura vuota)', () => {
    const backendAudit = {
      audit_id: 35191,
      audit_uuid: 'FE8167F8-521D-48E2-B5A9-6C9E222B363C',
      audit_number: 'MSN-260508-01',
      client_name: 'IDRAULICA SIGHINOLFI',
      project_year: 2026,
      audit_date: '2026-05-08',
      auditor_name: 'Marco Camellini',
      audit_type: 'first_party',
      status: 'in_progress',
      standards: 'ISO_9001_2015, ISO_14001_2015',
      audit_extra_data: {
        generalData: { auditObject: 'test' },
        auditObjective: { description: 'desc' },
      },
      custom_checklist_id: null,
    };

    const result = backendToFrontend(backendAudit);

    expect(result).toBeTruthy();
    expect(result.metadata.selectedStandards).toEqual(['ISO_9001', 'ISO_14001']);
    expect(result.checklist).toBeTypeOf('object');
    // Converter restituisce CHIAVI presenti, struttura VUOTA (verrà popolata da initializeChecklist)
    expect(Object.keys(result.checklist)).toEqual(expect.arrayContaining(['ISO_9001', 'ISO_14001']));
    expect(result.checklist.ISO_9001).toEqual({});
    expect(result.checklist.ISO_14001).toEqual({});
  });

  it('audit con audit_extra_data.checklist non vuoto → preserva struttura legacy con risposte', () => {
    const fakeChecklist = {
      ISO_9001: {
        clause4: {
          id: 'clause4',
          title: 'Contesto',
          questions: [{ id: 'q1', text: 'Test', status: 'C', notes: 'già risposto' }],
        },
      },
    };
    const backendAudit = {
      audit_id: 1,
      audit_uuid: 'uuid-1',
      client_name: 'Cliente',
      audit_date: '2026-01-01',
      audit_type: 'first_party',
      standards: 'ISO_9001_2015',
      audit_extra_data: { checklist: fakeChecklist },
    };

    const result = backendToFrontend(backendAudit);
    expect(result.checklist.ISO_9001.clause4.questions[0].status).toBe('C');
    expect(result.checklist.ISO_9001.clause4.questions[0].notes).toBe('già risposto');
  });

  it('audit solo custom_checklist_id → selectedStandards=[] e checklist={}', () => {
    const backendAudit = {
      audit_id: 2,
      audit_uuid: 'uuid-2',
      client_name: 'Custom Co',
      audit_date: '2026-01-01',
      audit_type: 'first_party',
      standards: null,
      custom_checklist_id: 42,
    };
    const result = backendToFrontend(backendAudit);
    expect(result.metadata.selectedStandards).toEqual([]);
    expect(result.checklist).toEqual({});
  });

  it('audit legacy senza standards → fallback ISO_9001 con chiave presente (struttura vuota)', () => {
    const backendAudit = {
      audit_id: 3,
      audit_uuid: 'uuid-3',
      client_name: 'Legacy',
      audit_date: '2026-01-01',
      audit_type: 'first_party',
      standards: null,
      custom_checklist_id: null,
    };
    const result = backendToFrontend(backendAudit);
    expect(result.metadata.selectedStandards).toEqual(['ISO_9001']);
    // Chiave presente, struttura vuota → initializeChecklist la popola
    expect('ISO_9001' in result.checklist).toBe(true);
    expect(result.checklist.ISO_9001).toEqual({});
  });

  it('audit_extra_data.checklist={} vuoto → struttura vuota (non pre-popola da template)', () => {
    const backendAudit = {
      audit_id: 4,
      audit_uuid: 'uuid-4',
      client_name: 'Cliente',
      audit_date: '2026-01-01',
      audit_type: 'first_party',
      standards: 'ISO_9001_2015',
      audit_extra_data: { checklist: {} },
    };
    const result = backendToFrontend(backendAudit);
    // {} vuoto in extra_data: non viene considerata struttura valida → ricostruisce con chiave vuota
    expect('ISO_9001' in result.checklist).toBe(true);
    expect(result.checklist.ISO_9001).toEqual({});
  });
});

describe('buildChecklistFromTemplate — helper esposto', () => {
  it('ISO_9001 → struttura con almeno una clausola e una domanda', () => {
    const obj = buildChecklistFromTemplate('ISO_9001');
    expect(Object.keys(obj).length).toBeGreaterThan(0);
    const firstClause = obj[Object.keys(obj)[0]];
    expect(Array.isArray(firstClause.questions)).toBe(true);
    expect(firstClause.questions.length).toBeGreaterThan(0);
  });

  it('chiave norma sconosciuta → oggetto vuoto', () => {
    expect(buildChecklistFromTemplate('NORMA_INVENTATA')).toEqual({});
    expect(buildChecklistFromTemplate(null)).toEqual({});
  });
});
