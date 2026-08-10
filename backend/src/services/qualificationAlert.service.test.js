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

const { effectiveAlertDue, matchQualAlertRule, mapQualificationDeadlineRows } = require('./qualificationAlert.service');

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

/**
 * Regressione bug critico 10/08/2026: q.expiry_date / q.next_confirmation_due
 * arrivano da mssql come oggetti Date nativi, non come stringhe "YYYY-MM-DD".
 * daysUntilDue (alertSchedulerHelpers.js) faceva `String(dueDate)` e testava
 * una regex ISO: su un Date nativo non combacia mai → tornava sempre null →
 * nessun alert qualifiche è mai partito in produzione (qual_notification_log
 * a 0 righe nonostante qualifiche realmente scadute, es. LUKIC BLAGO con
 * conferma semestrale scaduta e certificato ancora valido fino al 2027).
 */
describe('qualificationAlert.service — matchQualAlertRule con date come oggetti Date nativi (regressione mssql)', () => {
  it('scatta overdue con effectiveDate come oggetto Date nativo già scaduto', () => {
    const past = new Date();
    past.setUTCHours(0, 0, 0, 0);
    past.setUTCDate(past.getUTCDate() - 6);
    const r = matchQualAlertRule({ effectiveDate: past, status: 'valida', thresholds: [30, 7] });
    expect(r).toEqual({ kind: 'overdue', thresholdDays: null });
  });

  it('scatta la soglia con effectiveDate come oggetto Date nativo futuro', () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setUTCDate(future.getUTCDate() + 7);
    const r = matchQualAlertRule({ effectiveDate: future, status: 'valida', thresholds: [30, 7] });
    expect(r).toEqual({ kind: 'threshold', thresholdDays: 7 });
  });

  it('effectiveAlertDue + matchQualAlertRule end-to-end con date native (scenario reale: certificato 2027, conferma semestrale scaduta)', () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const nextConfirmationPast = new Date(today);
    nextConfirmationPast.setUTCDate(nextConfirmationPast.getUTCDate() - 6);
    const expiryFuture = new Date('2027-02-04T00:00:00.000Z');

    const { date, kind } = effectiveAlertDue({
      qualification_type: 'Saldatore ISO 9606-1',
      expiry_date: expiryFuture,
      next_confirmation_due: nextConfirmationPast,
    });
    expect(kind).toBe('confirmation');

    const rule = matchQualAlertRule({ effectiveDate: date, status: 'valida', thresholds: [30, 7] });
    expect(rule).toEqual({ kind: 'overdue', thresholdDays: null });
  });
});

/**
 * Regressione bug critico 10/08/2026 (segnalazione committente 10/08/2026,
 * Scadenzari Mason vuoto di qualifiche): mapQualificationDeadlineRows genera
 * le righe virtuali per lo Scadenzario unificato usando daysUntilDue sulla
 * data effettiva — con date come oggetti Date nativi (formato reale mssql)
 * ogni riga veniva scartata, a prescindere da quante qualifiche fossero
 * realmente scadute/in scadenza.
 */
describe('qualificationAlert.service — mapQualificationDeadlineRows con date native (regressione Scadenzari)', () => {
  it('non scarta le qualifiche scadute/in scadenza quando le date sono oggetti Date nativi', () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const scaduta = new Date(today);
    scaduta.setUTCDate(scaduta.getUTCDate() - 6);
    const inScadenza = new Date(today);
    inScadenza.setUTCDate(inScadenza.getUTCDate() + 10);

    const rows = mapQualificationDeadlineRows([
      {
        id: 1, person_name: 'Lukic Blago', qualification_type: 'Saldatore ISO 9606-1',
        status: 'valida', expiry_date: new Date('2027-02-04T00:00:00.000Z'), next_confirmation_due: scaduta,
      },
      {
        id: 2, person_name: 'Nuovo Saldatore', qualification_type: 'Saldatore ISO 9606-1',
        status: 'valida', expiry_date: inScadenza, next_confirmation_due: null,
      },
      {
        id: 3, person_name: 'Qualifica Sospesa', qualification_type: 'Saldatore ISO 9606-1',
        status: 'sospesa', expiry_date: inScadenza, next_confirmation_due: null,
      },
    ], 365);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.qualification_id).sort()).toEqual([1, 2]);
    expect(rows[0].item_type).toBe('qualification');
    // La scaduta (Lukic Blago, conferma semestrale 6gg fa) deve precedere
    // quella futura (10gg) — ordinamento per data reale, non per stringa
    // Date.toString() (che inizia dal nome del giorno della settimana).
    expect(rows[0].qualification_id).toBe(1);
    expect(rows[1].qualification_id).toBe(2);
  });
});
