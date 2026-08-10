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

const { mapEquipmentDeadlineRows, updateDeadlineItem } = require('./deadlines.controller');
const { getPool } = require('../config/database');

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

/**
 * Test L1 — deadlines.controller: updateDeadlineItem (validazione status)
 *
 * Audit di follow-up alla PR #371 (10/08/2026): le card "Archiviate"/"Prese in
 * carico" avevano introdotto due nuovi valori di status raggiungibili solo
 * lato UI, ma l'endpoint PATCH /deadline-items/:id scriveva il campo `status`
 * ricevuto dal body senza validarlo contro il CHECK constraint DB (ADR-013
 * §4.1: 'active'|'completed'|'dismissed'|'expired_acknowledged'). Un valore
 * non ammesso avrebbe generato un errore SQL 500 invece di un 400 chiaro.
 */
describe('deadlines.controller — updateDeadlineItem (validazione status)', () => {
  const buildReq = (body) => ({
    params: { itemId: '1' },
    user: { organization_id: 1, user_id: 1 },
    body,
  });
  const buildRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('risponde 400 con messaggio chiaro se status non è tra i 4 valori ammessi', async () => {
    getPool.mockResolvedValue({ request: jest.fn() });
    const res = buildRes();

    await updateDeadlineItem(buildReq({ status: 'foo_invalid' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Stato non valido') })
    );
  });

  it('accetta e applica uno status valido (es. "dismissed", introdotto da PR #371)', async () => {
    const checkRequest  = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 1 }] }) };
    const updateRequest = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({}) };
    const selectRequest = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 1, status: 'dismissed' }] }) };

    const pool = { request: jest.fn() };
    pool.request
      .mockReturnValueOnce(checkRequest)
      .mockReturnValueOnce(updateRequest)
      .mockReturnValueOnce(selectRequest);
    getPool.mockResolvedValue(pool);

    const res = buildRes();
    await updateDeadlineItem(buildReq({ status: 'dismissed' }), res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, item: expect.objectContaining({ status: 'dismissed' }) })
    );
  });
});
