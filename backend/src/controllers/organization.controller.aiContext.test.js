/**
 * @jest-environment node
 * L1 — organization.controller allega ai_context (CTX-1)
 */
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const { query } = require('../config/database');
const ctrl = require('./organization.controller');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('organization.controller ai_context (CTX-1)', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('GET /me include ai_context da scoreStudioContext', async () => {
    query.mockResolvedValue({
      recordset: [{
        organization_id: 1,
        organization_code: 'ALP',
        organization_name: 'Al.project',
        vat_number: null,
        logo_url: null,
        is_active: true,
        audit_report_prefix: null,
        ai_context_notes: null,
      }],
    });
    const req = { user: { organization_id: 1, role: 'admin' } };
    const res = mockRes();
    await ctrl.getMyOrganization(req, res);
    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.ai_context).toBeDefined();
    expect(body.data.ai_context.version).toBe('studio-v1');
    expect(body.data.ai_context.level).toBe('incompleto');
    expect(body.data.ai_context.score).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(body.data.ai_context.missing)).toBe(true);
    expect(body.data.ai_context.missing).toEqual(
      expect.arrayContaining(['vat_number', 'ai_context_notes', 'audit_report_prefix'])
    );
  });

  it('GET /me score pronto se campi pieni', async () => {
    query.mockResolvedValue({
      recordset: [{
        organization_id: 1,
        organization_code: 'ALP',
        organization_name: 'Al.project',
        vat_number: 'IT12345678901',
        logo_url: null,
        is_active: true,
        audit_report_prefix: 'ALP',
        ai_context_notes: 'Studio consulenza ISO 9001/3834; tono formale; focus saldatura e NC.',
      }],
    });
    const req = { user: { organization_id: 1, role: 'admin' } };
    const res = mockRes();
    await ctrl.getMyOrganization(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.ai_context.score).toBe(100);
    expect(body.data.ai_context.level).toBe('pronto');
    expect(body.data.ai_context.missing).toEqual([]);
  });
});
