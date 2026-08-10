/**
 * Test L1 — deadlines.controller: mapEquipmentDeadlineRows
 *
 * Regressione 10/08/2026 (segnalazione committente, stessa sessione del fix
 * card "Non attiva" in Qualifiche — vedi sgq-operating-memory.mdc § Filtri:
 * singola fonte di verità): le tarature strumenti scadute avevano
 * status:'expired', un quarto valore che non combacia con nessuno dei 4 stati
 * lifecycle noti al frontend ('active'|'completed'|'dismissed'|
 * 'expired_acknowledged') — restavano escluse sia dal filtro default "Attive"
 * sia dalla card statistica "Scadute" (che filtra su
 * status==='active' && days_until_due<0).
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getPool: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const { mapEquipmentDeadlineRows } = require('./deadlines.controller');

describe('deadlines.controller — mapEquipmentDeadlineRows', () => {
  it('assegna sempre status "active" anche per tarature scadute (mai un quarto valore "expired")', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const past = new Date(today);
    past.setDate(past.getDate() - 10);

    const rows = mapEquipmentDeadlineRows([
      { id: 1, name: 'Termometro', next_calibration_date: past.toISOString(), company_id: 5, company_name: 'ACME' },
    ], 365);

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('active');
    expect(rows[0].days_until_due).toBeLessThan(0);
  });

  it('assegna status "active" anche per tarature future (comportamento invariato)', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + 15);

    const rows = mapEquipmentDeadlineRows([
      { id: 2, name: 'Calibro', next_calibration_date: future.toISOString(), company_id: 5, company_name: 'ACME' },
    ], 365);

    expect(rows[0].status).toBe('active');
    expect(rows[0].days_until_due).toBeGreaterThan(0);
  });

  it('filtra sulla finestra giorni richiesta (daysWindow)', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const farFuture = new Date(today);
    farFuture.setDate(farFuture.getDate() + 400);

    const rows = mapEquipmentDeadlineRows([
      { id: 3, name: 'Manometro', next_calibration_date: farFuture.toISOString(), company_id: 5, company_name: 'ACME' },
    ], 365);

    expect(rows).toHaveLength(0);
  });
});
