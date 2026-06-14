'use strict';

const {
  effectiveAlertDue,
  matchQualAlertRule,
  mapQualificationDeadlineRows,
} = require('./qualificationAlert.service');
const { buildDocEscalationThresholds } = require('./alertSchedulerHelpers');

describe('qualificationAlert.service effectiveAlertDue', () => {
  it('usa expiry_date per tipi non 9606', () => {
    expect(effectiveAlertDue({
      qualification_type: 'Operatore NDT',
      expiry_date: '2027-01-01',
      next_confirmation_due: '2026-06-01',
    })).toEqual({ date: '2027-01-01', kind: 'expiry' });
  });

  it('per 9606 sceglie la data piu imminente (conferma prima del certificato)', () => {
    expect(effectiveAlertDue({
      qualification_type: 'Saldatore ISO 9606-1',
      expiry_date: '2028-01-10',
      next_confirmation_due: '2026-12-10',
    })).toEqual({ date: '2026-12-10', kind: 'confirmation' });
  });

  it('per 9606 usa expiry se conferma assente', () => {
    expect(effectiveAlertDue({
      qualification_type: 'ISO 9606-1',
      expiry_date: '2028-01-10',
      next_confirmation_due: null,
    })).toEqual({ date: '2028-01-10', kind: 'expiry' });
  });
});

describe('qualificationAlert.service matchQualAlertRule', () => {
  const thresholds = buildDocEscalationThresholds(30, 7, null);

  it('ignora qualifiche non approvate', () => {
    expect(matchQualAlertRule({
      effectiveDate: '2026-06-20',
      status: 'valida',
      approvalStatus: 'bozza',
      thresholds,
    })).toBeNull();
  });

  it('matcha soglia 30 giorni', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const dateStr = future.toISOString().slice(0, 10);
    const rule = matchQualAlertRule({
      effectiveDate: dateStr,
      status: 'valida',
      approvalStatus: 'approvata',
      thresholds,
    });
    expect(rule).toEqual({ kind: 'threshold', thresholdDays: 30 });
  });
});

describe('qualificationAlert.service mapQualificationDeadlineRows', () => {
  it('produce righe virtuali con id qual-*', () => {
    const future = new Date();
    future.setDate(future.getDate() + 15);
    const rows = mapQualificationDeadlineRows([{
      id: 42,
      person_name: 'Mario Rossi',
      qualification_type: 'Saldatore ISO 9606-1',
      certificate_number: 'C-1',
      expiry_date: '2028-01-01',
      next_confirmation_due: future.toISOString().slice(0, 10),
      status: 'valida',
      approval_status: 'approvata',
      company_id: 5,
      company_name: 'ACME',
    }], 60);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('qual-42');
    expect(rows[0].item_type).toBe('qualification');
    expect(rows[0].category).toBe('qualifica');
    expect(rows[0].alert_kind).toBe('confirmation');
  });
});
