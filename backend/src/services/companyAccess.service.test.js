/**
 * Test RBAC Fase 4.1 — companyAccess.service guard centralizzate
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');
const svc = require('./companyAccess.service');

afterEach(() => jest.clearAllMocks());

describe('companyAccess.service Fase 4.1', () => {
  it('isCompanyClient true con company_access', () => {
    expect(svc.isCompanyClient({ company_access: [{ company_id: 11, permission: 'read' }] })).toBe(true);
    expect(svc.isCompanyClient({ role: 'auditor' })).toBe(false);
  });

  it('assertCompanyAccess nega company non in elenco', async () => {
    const user = {
      user_id: 1,
      company_access: [{ company_id: 11, permission: 'write' }],
    };
    const denied = await svc.assertCompanyAccess(user, 12, 'read');
    expect(denied).toEqual(
      expect.objectContaining({ status: 403, body: expect.objectContaining({ code: 'FORBIDDEN' }) }),
    );
  });

  it('assertCompanyRead consente read su company assegnata', async () => {
    const user = {
      user_id: 1,
      company_access: [{ company_id: 11, permission: 'read' }],
    };
    expect(await svc.assertCompanyRead(user, 11)).toBeNull();
  });

  it('assertCompanyWrite nega read-only su company_access', async () => {
    const user = {
      user_id: 2,
      company_access: [{ company_id: 11, permission: 'read' }],
    };
    expect(await svc.assertCompanyWrite(user, 11)).toEqual(
      expect.objectContaining({ status: 403, body: expect.objectContaining({ code: 'AUTH_FORBIDDEN' }) }),
    );
  });

  it('assertMutatingAllowed nega viewer read su qualsiasi mutazione', async () => {
    const user = {
      user_id: 5,
      role: 'viewer',
      company_access: [{ company_id: 11, permission: 'read' }],
    };
    const denied = await svc.assertMutatingAllowed(user, { companyId: 11 });
    expect(denied?.status).toBe(403);
  });

  it('assertMutatingAllowed consente cliente write sulla propria company', async () => {
    const user = {
      user_id: 6,
      role: 'viewer',
      company_access: [{ company_id: 11, permission: 'write' }],
    };
    expect(await svc.assertMutatingAllowed(user, { companyId: 11 })).toBeNull();
  });

  it('assertMutatingAllowed consente auditor studio senza company_access', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const user = { user_id: 7, role: 'auditor' };
    expect(await svc.assertMutatingAllowed(user, {})).toBeNull();
  });

  it('assertCompanyWriteAccess nega viewer studio senza company_access', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const user = { user_id: 4, role: 'viewer' };
    const denied = await svc.assertCompanyWriteAccess(user, 11);
    expect(denied?.status).toBe(403);
  });

  it('companyAccessSqlFilter genera IN clause', () => {
    const f = svc.companyAccessSqlFilter([{ company_id: 11 }, { company_id: 12 }], 'q');
    expect(f.clause).toContain('q.company_id IN');
    expect(Object.keys(f.params)).toHaveLength(2);
  });

  it('getUserCompanyAccess carica righe dal DB', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ company_id: 11, permission: 'write' }],
    });
    const rows = await svc.getUserCompanyAccess(9);
    expect(rows).toEqual([{ company_id: 11, permission: 'write' }]);
  });
});
