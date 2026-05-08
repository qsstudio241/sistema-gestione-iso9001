/**
 * Test L1 — Scenario multi-device "Camellini SIGHINOLFI"
 *
 * Simula il caso reale: utente avvia audit su PC, sincronizza, poi accede da
 * cellulare (cache locale vuota) e apre lo stesso audit. Il render di
 * ChecklistModule deve trovare la struttura checklist pronta sin dal primo
 * frame, senza dipendere da useEffect post-mount.
 */

import { describe, it, expect } from 'vitest';
import { backendToFrontend } from '../utils/auditConverter';

describe('Multi-device — Camellini SIGHINOLFI scenario', () => {
  it('audit scaricato su mobile per la prima volta → ChecklistModule trova struttura non vuota al primo render', () => {
    // Payload identico a quello restituito dall'API in produzione (id=35191)
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

    // Replica l'asserzione fatta da ChecklistModule riga ~204:
    //   isChecklistEmpty = !checklist || Object.keys(checklist).length === 0
    // Per la norma di default (ISO_9001) deve essere FALSE.
    const checklistDefault = audit.checklist?.ISO_9001;
    const isChecklistEmpty =
      !checklistDefault || Object.keys(checklistDefault).length === 0;

    expect(isChecklistEmpty).toBe(false);

    // Anche per la seconda norma selezionata
    const iso14001 = audit.checklist?.ISO_14001;
    expect(iso14001).toBeTruthy();
    expect(Object.keys(iso14001).length).toBeGreaterThan(0);

    // selectedStandards corretti per AuditAccordionLayout (dropdown norme)
    expect(audit.metadata.selectedStandards).toEqual(['ISO_9001', 'ISO_14001']);

    // questionId integri: necessari per fetchAndApplyServerResponses (idratazione 17 risposte)
    const allQuestions = Object.values(audit.checklist.ISO_9001).flatMap(
      (clause) => clause.questions || []
    );
    const withQuestionId = allQuestions.filter((q) => q.questionId);
    expect(withQuestionId.length).toBe(allQuestions.length);
    expect(allQuestions.length).toBeGreaterThanOrEqual(35);
  });

  it('audit con un solo standard ISO 14001 (solo "ISO_14001_2015") → checklist 14001 popolata, no fallback ISO 9001', () => {
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
    expect(Object.keys(audit.checklist.ISO_14001).length).toBeGreaterThan(0);
    expect(audit.checklist.ISO_9001).toBeUndefined();
  });

  it('audit con array di oggetti standards (formato getAuditById) → checklist popolata', () => {
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
    expect(Object.keys(audit.checklist.ISO_9001).length).toBeGreaterThan(0);
    expect(Object.keys(audit.checklist.ISO_14001).length).toBeGreaterThan(0);
  });
});
