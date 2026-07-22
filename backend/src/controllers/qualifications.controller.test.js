/**
 * @jest-environment node
 */

/**
 * Test L1 — qualifications.controller
 * Copre: effectiveExpiryDate / semaforoForRow (data guida scadenza + semaforo)
 * per qualifiche ISO 9606-1 (saldatori) e ISO 14732 (operatori) — entrambe con
 * conferma semestrale, a differenza degli altri tipi (solo expiry_date).
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

const { effectiveExpiryDate, semaforoForRow } = require('./qualifications.controller');

describe('qualifications.controller — effectiveExpiryDate', () => {
  it('per ISO 9606-1 usa la data più imminente tra expiry e conferma semestrale', () => {
    const q = {
      qualification_type: 'Saldatore ISO 9606-1',
      expiry_date: '2030-01-01',
      next_confirmation_due: '2026-06-01',
    };
    expect(effectiveExpiryDate(q)).toBe('2026-06-01');
  });

  it('per ISO 14732 usa la data più imminente tra expiry e conferma semestrale (come 9606)', () => {
    const q = {
      qualification_type: 'Operatore ISO 14732',
      expiry_date: '2032-01-01',
      next_confirmation_due: '2026-05-01',
    };
    expect(effectiveExpiryDate(q)).toBe('2026-05-01');
  });

  it('per tipi non 9606/14732 usa solo expiry_date, ignora next_confirmation_due', () => {
    const q = {
      qualification_type: 'Coordinatore ISO 14731',
      expiry_date: '2030-01-01',
      next_confirmation_due: '2026-01-01',
    };
    expect(effectiveExpiryDate(q)).toBe('2030-01-01');
  });

  it('per ISO 14732 senza next_confirmation_due ricade su expiry_date', () => {
    const q = {
      qualification_type: 'Operatore ISO 14732',
      expiry_date: '2031-01-01',
      next_confirmation_due: null,
    };
    expect(effectiveExpiryDate(q)).toBe('2031-01-01');
  });

  it('per ISO 14732 senza expiry_date ricade su next_confirmation_due', () => {
    const q = {
      qualification_type: 'Operatore ISO 14732',
      expiry_date: null,
      next_confirmation_due: '2026-08-01',
    };
    expect(effectiveExpiryDate(q)).toBe('2026-08-01');
  });
});

describe('qualifications.controller — semaforoForRow', () => {
  it('segnala rosso se la conferma semestrale ISO 14732 è già scaduta anche con certificato valido', () => {
    const q = {
      qualification_type: 'Operatore ISO 14732',
      status: 'valida',
      expiry_date: '2030-01-01',
      next_confirmation_due: '2020-01-01',
    };
    expect(semaforoForRow(q)).toBe('rosso');
  });
});
