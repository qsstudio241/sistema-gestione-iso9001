/**
 * Test L1 — Scenario multi-device "Camellini SIGHINOLFI"
 *
 * Simula il caso reale: utente avvia audit su PC, sincronizza, poi accede da
 * cellulare (cache locale vuota) e apre lo stesso audit. Il render di
 * ChecklistModule deve trovare la struttura checklist pronta sin dal primo
 * frame, senza dipendere da useEffect post-mount.
 */

import { describe, it, expect } from 'vitest';
import { backendToFrontend, buildChecklistFromTemplate } from '../utils/auditConverter';

describe('Multi-device — Camellini SIGHINOLFI scenario', () => {
  it('audit scaricato su mobile per la prima volta → converter produce chiavi norma, initializeChecklist popola la struttura', () => {
    // Payload identico a quello restituito dall'API in produzione (id=35191)
    // NOTA: il converter restituisce {ISO_9001:{}, ISO_14001:{}} (chiavi presenti, struttura vuota).
    // ChecklistModule mostra "⏳ Caricamento checklist…" per 1.5s (grace period).
    // AuditAccordionLayout.useEffect chiama initializeChecklist → template popola la struttura.
    // fetchAndApplyServerResponses → applica le 17 risposte dal server.
    // Pre-popolare il template nel converter causerebbe Exception4 di reconcile a non scattare
    // → le risposte verrebbero sovrascritte con NOT_ANSWERED ad ogni reconcile (ogni 45s).
    const serverPayload = {
      audit_id: 35191,
      audit_uuid: 'FE8167F8-521D-48E2-B5A9-6C9E222B363C',
      audit_number: 'MSN-260508-01',
      client_name: 'IDRAULICA SIGHINOLFI',
      project_year: 2026,
      audit_date: '2026-05-08',
      auditor_name: 'Marco Camellini',
      audit_type: 'first_party',
      status: 'in_progress',
      organization_id: 1002,
      standard_id: null,
      custom_checklist_id: null,
      total_questions: 35,
      answered_questions: 17,
      conformities_count: 17,
      non_conformities_count: 0,
      completion_percentage: 48,
      standards: 'ISO_9001_2015, ISO_14001_2015',
      audit_extra_data: {
        generalData: {
          auditObject: 'Audit interno',
          scope: 'SGQ',
          referenceDocuments: '',
          auditDate: '2026-05-08',
          processes: '',
          programCommunicatedDate: '',
          auditors: ['Marco Camellini'],
        },
        auditObjective: { description: 'Verifica SGQ', participants: [], agenda: '' },
        auditOutcome: {},
        auditPartyType: 'first_party',
        fornitoreName: '',
      },
    };

    const audit = backendToFrontend(serverPayload);

    // Converter restituisce chiavi norma presenti (necessario per selectedStandards e auto-init)
    expect(Object.keys(audit.checklist)).toContain('ISO_9001');
    expect(Object.keys(audit.checklist)).toContain('ISO_14001');

    // La struttura interna è VUOTA — verrà popolata da initializeChecklist.
    // ChecklistModule.showEmptyFallback ha grace period 1.5s: durante quel tempo
    // AuditAccordionLayout.useEffect scatta e chiama initializeChecklist.
    expect(audit.checklist.ISO_9001).toEqual({});
    expect(audit.checklist.ISO_14001).toEqual({});

    // selectedStandards corretti per AuditAccordionLayout (auto-init + dropdown norme)
    expect(audit.metadata.selectedStandards).toEqual(['ISO_9001', 'ISO_14001']);

    // buildChecklistFromTemplate separato verifica che il template sia disponibile
    // (usato da initializeChecklist in StorageContext)
    const tpl9001 = buildChecklistFromTemplate('ISO_9001');
    expect(Object.keys(tpl9001).length).toBeGreaterThan(0);
    const firstClause = tpl9001[Object.keys(tpl9001)[0]];
    expect(firstClause.questions.length).toBeGreaterThan(0);
    expect(firstClause.questions.length).toBeGreaterThanOrEqual(1);
    const totalQuestions = Object.values(tpl9001).reduce((s, c) => s + (c.questions?.length || 0), 0);
    expect(totalQuestions).toBeGreaterThanOrEqual(35);
  });

  it('audit con un solo standard ISO 14001 → checklist ha chiave ISO_14001 (no ISO_9001)', () => {
    const serverPayload = {
      audit_id: 100,
      audit_uuid: 'uuid-14001-only',
      client_name: 'Solo Ambiente Srl',
      audit_date: '2026-05-08',
      audit_type: 'first_party',
      status: 'draft',
      standards: 'ISO_14001_2015',
      audit_extra_data: {},
    };
    const audit = backendToFrontend(serverPayload);
    expect(audit.metadata.selectedStandards).toEqual(['ISO_14001']);
    expect('ISO_14001' in audit.checklist).toBe(true);
    expect(audit.checklist.ISO_9001).toBeUndefined();
  });

  it('audit con array di oggetti standards (formato getAuditById) → checklist ha entrambe le chiavi', () => {
    const serverPayload = {
      audit_id: 200,
      audit_uuid: 'uuid-array',
      client_name: 'Test',
      audit_date: '2026-05-08',
      audit_type: 'first_party',
      status: 'draft',
      standards: [
        { standard_id: 1, standard_code: 'ISO_9001_2015', standard_name: 'ISO 9001:2015' },
        { standard_id: 2, standard_code: 'ISO_14001_2015', standard_name: 'ISO 14001:2015' },
      ],
      audit_extra_data: {},
    };
    const audit = backendToFrontend(serverPayload);
    expect(audit.metadata.selectedStandards).toEqual(['ISO_9001', 'ISO_14001']);
    // Chiavi presenti, struttura vuota → initializeChecklist le popola
    expect('ISO_9001' in audit.checklist).toBe(true);
    expect('ISO_14001' in audit.checklist).toBe(true);
  });
});
