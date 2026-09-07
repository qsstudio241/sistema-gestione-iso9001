/**
 * L1 — wrapper score contesto AI (CTX-0)
 */
const {
  scoreStudioContext,
  scoreCompanyContext,
  scoreContext,
} = require('./aiContextScore.service');

describe('aiContextScore.service', () => {
  it('scoreStudioContext allinea a studio-v1', () => {
    const r = scoreStudioContext({
      organization_name: 'Studio',
      vat_number: '1',
      ai_context_notes: 'x'.repeat(40),
      audit_report_prefix: 'ST',
    });
    expect(r.version).toBe('studio-v1');
    expect(r.scope).toBe('studio');
    expect(r.score).toBe(100);
  });

  it('scoreCompanyContext allinea a company-v1', () => {
    const r = scoreCompanyContext({
      name: 'A',
      vat_number: '1',
      sector: 'S',
      address: 'Via Lunga 12',
    });
    expect(r.version).toBe('company-v1');
    expect(r.score).toBe(100);
  });

  it('scoreContext scope invalido', () => {
    const r = scoreContext('nope', {});
    expect(r.score).toBe(0);
    expect(r.error).toBe('scope_non_valido');
  });

  it('scoreContext studio|company', () => {
    expect(scoreContext('studio', {}).version).toBe('studio-v1');
    expect(scoreContext('company', { name: 'X' }).score).toBeGreaterThan(0);
  });
});
