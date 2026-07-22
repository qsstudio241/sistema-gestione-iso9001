jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');
const svc = require('./weldingCoordinatorAuth.service');

afterEach(() => jest.clearAllMocks());

describe('weldingCoordinatorAuth.service', () => {
  it('isWelder9606Type riconosce varianti 9606', () => {
    expect(svc.isWelder9606Type('Saldatore ISO 9606-1')).toBe(true);
    expect(svc.isWelder9606Type('9606_1')).toBe(true);
    expect(svc.isWelder9606Type('patentino_saldatore')).toBe(true);
    expect(svc.isWelder9606Type('Coordinatore ISO 14731')).toBe(false);
    expect(svc.isWelder9606Type('Operatore ISO 14732')).toBe(false);
  });

  it('isOperator14732Type riconosce varianti 14732', () => {
    expect(svc.isOperator14732Type('Operatore ISO 14732')).toBe(true);
    expect(svc.isOperator14732Type('qualifica_14732')).toBe(true);
    expect(svc.isOperator14732Type('Saldatore ISO 9606-1')).toBe(false);
  });

  it('requiresSemiannualConfirmation vale per 9606 e 14732, non per altri tipi', () => {
    expect(svc.requiresSemiannualConfirmation('Saldatore ISO 9606-1')).toBe(true);
    expect(svc.requiresSemiannualConfirmation('Operatore ISO 14732')).toBe(true);
    expect(svc.requiresSemiannualConfirmation('Coordinatore ISO 14731')).toBe(false);
    expect(svc.requiresSemiannualConfirmation('Operatore NDT VT Livello 2')).toBe(false);
  });

  it('addMonthsIso aggiunge 6 mesi', () => {
    expect(svc.addMonthsIso('2026-01-15', 6)).toBe('2026-07-15');
  });

  it('canUserConfirmSemiannual consente admin studio', async () => {
    const r = await svc.canUserConfirmSemiannual(
      { role: 'admin', organization_id: 1, email: 'a@x.it' },
      42
    );
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('studio_admin');
    expect(query).not.toHaveBeenCalled();
  });

  it('canUserConfirmSemiannual consente email primario', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ id: 7, name: 'Mario', email: 'coord@azienda.it', job_title: 'IWE' }],
    });
    const r = await svc.canUserConfirmSemiannual(
      { role: 'coordinatore', organization_id: 1, email: 'coord@azienda.it' },
      42
    );
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('primary_coordinator');
  });

  it('canUserConfirmSemiannual nega coordinatore non primario', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ id: 7, name: 'Mario', email: 'primario@azienda.it', job_title: 'IWE' }],
    });
    const r = await svc.canUserConfirmSemiannual(
      { role: 'coordinatore', organization_id: 1, email: 'altro@azienda.it' },
      42
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('not_primary');
  });

  it('canUserConfirmSemiannual nega se primario non configurato', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const r = await svc.canUserConfirmSemiannual(
      { role: 'coordinatore', organization_id: 1, email: 'x@y.it' },
      42
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('no_primary_configured');
  });
});
