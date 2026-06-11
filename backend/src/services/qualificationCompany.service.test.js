jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');
const svc = require('./qualificationCompany.service');

afterEach(() => jest.clearAllMocks());

describe('qualificationCompany.service', () => {
  it('parseCompanyId rifiuta valori non validi', () => {
    expect(svc.parseCompanyId(null)).toBeNull();
    expect(svc.parseCompanyId('')).toBeNull();
    expect(svc.parseCompanyId('abc')).toBeNull();
    expect(svc.parseCompanyId('12')).toBe(12);
  });

  it('validateQualificationCompany richiede company_id', async () => {
    const r = await svc.validateQualificationCompany({ organizationId: 1001, companyId: null });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('COMPANY_REQUIRED');
  });

  it('validateQualificationCompany verifica tenant', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const r = await svc.validateQualificationCompany({ organizationId: 1001, companyId: 5 });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('COMPANY_NOT_IN_ORG');
  });

  it('validateQualificationCompany blocca cambio azienda se approvata', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 5 }] });
    const r = await svc.validateQualificationCompany({
      organizationId: 1001,
      companyId: 99,
      existing: { company_id: 5, approval_status: 'approvata' },
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('COMPANY_LOCKED_APPROVED');
  });

  it('assertNoCrossCompanyDuplicate rileva certificato su altra azienda', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 1, company_id: 2 }] });
    const r = await svc.assertNoCrossCompanyDuplicate({
      organizationId: 1001,
      companyId: 5,
      certificateNumber: 'CERT-001',
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('DUPLICATE_CERT_OTHER_COMPANY');
  });
});
