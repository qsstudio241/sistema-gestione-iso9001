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

describe('auditConverter — checklist popolata da template', () => {
  it('audit con due standard (ISO 9001 + ISO 14001) → checklist popolata per entrambi', () => {
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
    expect(Object.keys(result.checklist)).toEqual(['ISO_9001', 'ISO_14001']);

    const iso9001 = result.checklist.ISO_9001;
    expect(Object.keys(iso9001).length).toBeGreaterThan(0);
    const firstClause = iso9001[Object.keys(iso9001)[0]];
    expect(firstClause).toHaveProperty('id');
    expect(firstClause).toHaveProperty('title');
    expect(Array.isArray(firstClause.questions)).toBe(true);
    expect(firstClause.questions.length).toBeGreaterThan(0);
    expect(firstClause.questions[0]).toMatchObject({
      status: 'NOT_ANSWERED',
      notes: '',
    });

    const iso14001 = result.checklist.ISO_14001;
    expect(Object.keys(iso14001).length).toBeGreaterThan(0);
  });

  it('audit con audit_extra_data.checklist non vuoto → preserva struttura legacy', () => {
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

  it('audit legacy senza standards e senza custom → fallback ISO_9001 popolato', () => {
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
    expect(Object.keys(result.checklist.ISO_9001).length).toBeGreaterThan(0);
  });

  it('audit_extra_data.checklist vuoto ({}) → ricostruisce da template (no struttura silente vuota)', () => {
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
    expect(Object.keys(result.checklist.ISO_9001).length).toBeGreaterThan(0);
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
