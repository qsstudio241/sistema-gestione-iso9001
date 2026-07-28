/**
 * Test L1 — qualificationAlert.service
 * Copre: effectiveAlertDue per ISO 9606-1 e ISO 14732 (entrambe con conferma semestrale).
 */

jest.mock('./alertMail.service', () => ({ sendAlertEmail: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const { effectiveAlertDue, matchQualAlertRule } = require('./qualificationAlert.service');

describe('qualificationAlert.service — effectiveAlertDue', () => {
  it('ISO 9606-1: conferma semestrale più imminente → kind confirmation', () => {
    const r = effectiveAlertDue({
      qualification_type: 'Saldatore ISO 9606-1',
      expiry_date: '2030-01-01',
      next_confirmation_due: '2026-06-01',
    });
    expect(r).toEqual({ date: '2026-06-01', kind: 'confirmation' });
  });

  it('ISO 14732: conferma semestrale più imminente → kind confirmation (come 9606)', () => {
    const r = effectiveAlertDue({
      qualification_type: 'Operatore ISO 14732',
      expiry_date: '2032-01-01',
      next_confirmation_due: '2026-05-01',
    });
    expect(r).toEqual({ date: '2026-05-01', kind: 'confirmation' });
  });

  it('ISO 14732: certificato più imminente della conferma → kind expiry', () => {
    const r = effectiveAlertDue({
      qualification_type: 'Operatore ISO 14732',
      expiry_date: '2026-03-01',
      next_confirmation_due: '2027-01-01',
    });
    expect(r).toEqual({ date: '2026-03-01', kind: 'expiry' });
  });

  it('Coordinatore ISO 14731: ignora next_confirmation_due, solo expiry', () => {
    const r = effectiveAlertDue({
      qualification_type: 'Coordinatore ISO 14731',
      expiry_date: '2030-01-01',
      next_confirmation_due: '2026-01-01',
    });
    expect(r).toEqual({ date: '2030-01-01', kind: 'expiry' });
  });
});

/**
 * Decisione di prodotto 28/07/2026: nessun gate su approval_status per gli alert
 * (rimosso Approva/Rifiuta interno). Gli alert scattano su qualsiasi qualifica
 * attiva (status non revocata/sospesa), a prescindere da approval_status.
 */
describe('qualificationAlert.service — matchQualAlertRule (nessun gate su approval_status)', () => {
  it('scatta l\'alert anche senza approvalStatus nei parametri', () => {
    const r = matchQualAlertRule({
      effectiveDate: '2026-07-20',
      status: 'valida',
      thresholds: [30, 60],
    });
    expect(r).toEqual({ kind: 'overdue', thresholdDays: null });
  });

  it('esclude comunque status revocata/sospesa', () => {
    expect(matchQualAlertRule({ effectiveDate: '2026-07-20', status: 'revocata', thresholds: [30, 60] })).toBeNull();
    expect(matchQualAlertRule({ effectiveDate: '2026-07-20', status: 'sospesa', thresholds: [30, 60] })).toBeNull();
  });
});
