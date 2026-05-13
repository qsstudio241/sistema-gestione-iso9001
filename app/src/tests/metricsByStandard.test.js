/**
 * Test L1 — calculateByStandardMetrics + integrazione con updateAuditMetrics
 *
 * ADR-009 Fase 1: i conteggi NC/OSS/OM devono essere disponibili sia come
 * totali (legacy `metrics.totalNC` ecc.) sia per-norma (`metrics.byStandard[key]`).
 */

import { describe, it, expect } from 'vitest';
import {
  calculateByStandardMetrics,
  calculateFindingsMetrics,
  updateAuditMetrics,
} from '../utils/metricsCalculator';

function makeQuestion(status) {
  return { questionId: Math.random().toString(36).slice(2), status };
}

function makeChecklistMultiStandard() {
  // ISO 9001: 3 NC, 1 OSS, 1 OM, 2 C → 7 totali, 7 risposte
  // ISO 14001: 1 NC, 1 OSS, 0 OM, 1 NA, 1 NOT_ANSWERED → 4 totali, 3 risposte
  return {
    ISO_9001: {
      clause4: {
        questions: [
          makeQuestion('NC'),
          makeQuestion('NC'),
          makeQuestion('NC'),
          makeQuestion('OSS'),
          makeQuestion('C'),
        ],
      },
      clause5: {
        questions: [makeQuestion('OM'), makeQuestion('C')],
      },
    },
    ISO_14001: {
      clause4: {
        questions: [
          makeQuestion('NC'),
          makeQuestion('OSS'),
          makeQuestion('NA'),
          makeQuestion('NOT_ANSWERED'),
        ],
      },
    },
  };
}

describe('calculateByStandardMetrics', () => {
  it('input vuoto → oggetto vuoto', () => {
    expect(calculateByStandardMetrics(null)).toEqual({});
    expect(calculateByStandardMetrics(undefined)).toEqual({});
    expect(calculateByStandardMetrics({})).toEqual({});
  });

  it('produce metriche per ciascuna norma presente in checklist', () => {
    const checklist = makeChecklistMultiStandard();
    const out = calculateByStandardMetrics(checklist);

    expect(Object.keys(out).sort()).toEqual(['ISO_14001', 'ISO_9001']);

    expect(out.ISO_9001).toMatchObject({
      totalNC: 3,
      totalOSS: 1,
      totalOM: 1,
      totalQuestions: 7,
      // 7 risposte non NOT_ANSWERED (NA escluso da answeredQuestions)
      answeredQuestions: 7,
      completionPercentage: 100,
    });

    expect(out.ISO_14001).toMatchObject({
      totalNC: 1,
      totalOSS: 1,
      totalOM: 0,
      totalQuestions: 4,
      // NA (uppercase) viene contata come answered dal motore corrente
      // (vedi STATUS_TO_FINDING). Solo NOT_ANSWERED e 'not_applicable'
      // lowercase legacy sono escluse → 3 risposte effettive su 4.
      answeredQuestions: 3,
      completionPercentage: 75,
    });
  });

  it('norma con struttura vuota produce conteggi a 0 (non null)', () => {
    const out = calculateByStandardMetrics({ ISO_9001: {} });
    expect(out.ISO_9001).toMatchObject({
      totalNC: 0,
      totalOSS: 0,
      totalOM: 0,
      totalQuestions: 0,
      answeredQuestions: 0,
      completionPercentage: 0,
    });
  });

  it('somma per norma == totale calculateFindingsMetrics (no doppio conteggio)', () => {
    const checklist = makeChecklistMultiStandard();
    const totals = calculateFindingsMetrics(checklist);
    const byStandard = calculateByStandardMetrics(checklist);

    const sumNC = Object.values(byStandard).reduce((s, m) => s + m.totalNC, 0);
    const sumOSS = Object.values(byStandard).reduce((s, m) => s + m.totalOSS, 0);
    const sumOM = Object.values(byStandard).reduce((s, m) => s + m.totalOM, 0);

    expect(sumNC).toBe(totals.totalNC);
    expect(sumOSS).toBe(totals.totalOSS);
    expect(sumOM).toBe(totals.totalOM);
  });
});

describe('updateAuditMetrics — espone byStandard', () => {
  it('arricchisce metrics.byStandard senza rompere i campi legacy', () => {
    const audit = {
      metadata: { auditOutcome: {} },
      checklist: makeChecklistMultiStandard(),
    };
    const enriched = updateAuditMetrics(audit);

    // Campi legacy intatti (retrocompatibilità)
    expect(enriched.metrics.totalNC).toBe(4); // 3 + 1
    expect(enriched.metrics.observationsNC).toBe(2); // OSS totali (legacy alias)
    expect(enriched.metrics.totalQuestions).toBe(11); // 7 + 4
    expect(enriched.metadata.auditOutcome.emergingFindings.totalNC).toBe(4);

    // Nuovo campo per-norma
    expect(enriched.metrics.byStandard).toBeDefined();
    expect(enriched.metrics.byStandard.ISO_9001.totalNC).toBe(3);
    expect(enriched.metrics.byStandard.ISO_14001.totalNC).toBe(1);
  });

  it('audit senza checklist → byStandard = {} (nessuna eccezione)', () => {
    const audit = { metadata: { auditOutcome: {} }, checklist: undefined };
    const enriched = updateAuditMetrics(audit);
    expect(enriched.metrics.byStandard).toEqual({});
    expect(enriched.metrics.totalNC).toBe(0);
  });
});
