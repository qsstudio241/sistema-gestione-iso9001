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

/**
 * Decisione di prodotto 28/07/2026: rimosso il gate manuale Approva/Rifiuta/Revoca
 * sulle qualifiche (certificati già emessi da ente terzo accreditato). Questa
 * funzione è il controllo automatico basato su date che sostituisce "Revoca"
 * manuale per l'esclusione da copertura/alert — v. header qualifications.controller.js.
 */
describe('weldingCoordinatorAuth.service — isQualificationOperationallyActive', () => {
  const TODAY = '2026-07-28';

  it('esclude qualifiche con status revocata o sospesa, a prescindere dalle date', () => {
    expect(svc.isQualificationOperationallyActive({ status: 'revocata', expiry_date: '2030-01-01' }, TODAY)).toBe(false);
    expect(svc.isQualificationOperationallyActive({ status: 'sospesa', expiry_date: '2030-01-01' }, TODAY)).toBe(false);
  });

  it('esclude se il certificato è scaduto per data (expiry_date nel passato)', () => {
    expect(svc.isQualificationOperationallyActive({
      status: 'valida',
      qualification_type: 'Coordinatore ISO 14731',
      expiry_date: '2026-01-01',
    }, TODAY)).toBe(false);
  });

  it('esclude un saldatore ISO 9606-1 con conferma semestrale scaduta, anche se il certificato è ancora valido', () => {
    expect(svc.isQualificationOperationallyActive({
      status: 'valida',
      qualification_type: 'Saldatore ISO 9606-1',
      expiry_date: '2030-01-01',
      next_confirmation_due: '2026-06-01',
    }, TODAY)).toBe(false);
  });

  it('esclude un operatore ISO 14732 con conferma semestrale scaduta, anche se il certificato è ancora valido', () => {
    expect(svc.isQualificationOperationallyActive({
      status: 'valida',
      qualification_type: 'Operatore ISO 14732',
      expiry_date: '2030-01-01',
      next_confirmation_due: '2026-01-01',
    }, TODAY)).toBe(false);
  });

  it('include un saldatore ISO 9606-1 con conferma semestrale ancora valida', () => {
    expect(svc.isQualificationOperationallyActive({
      status: 'valida',
      qualification_type: 'Saldatore ISO 9606-1',
      expiry_date: '2030-01-01',
      next_confirmation_due: '2027-01-01',
    }, TODAY)).toBe(true);
  });

  it('ignora next_confirmation_due per tipi che non richiedono conferma semestrale', () => {
    expect(svc.isQualificationOperationallyActive({
      status: 'valida',
      qualification_type: 'Coordinatore ISO 14731',
      expiry_date: '2030-01-01',
      next_confirmation_due: '2020-01-01',
    }, TODAY)).toBe(true);
  });

  it('include qualifiche senza approval_status/bozza: nessun gate di approvazione interna', () => {
    expect(svc.isQualificationOperationallyActive({
      status: 'valida',
      approval_status: 'bozza',
      qualification_type: 'Saldatore ISO 9606-1',
      expiry_date: '2030-01-01',
      next_confirmation_due: '2027-01-01',
    }, TODAY)).toBe(true);
  });

  it('restituisce false per input nullo', () => {
    expect(svc.isQualificationOperationallyActive(null, TODAY)).toBe(false);
  });
});
