/**
 * Test RBAC Fase 4 — companyAccess.service
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');
const svc = require('./companyAccess.service');

afterEach(() => jest.clearAllMocks());

describe('companyAccess.service', () => {
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

  it('assertCompanyAccess consente read su company assegnata', async () => {
    const user = {
      user_id: 1,
      company_access: [{ company_id: 11, permission: 'read' }],
    };
    expect(await svc.assertCompanyAccess(user, 11, 'read')).toBeNull();
  });

  it('assertCompanyWriteAccess nega read-only su company_access', async () => {
    const user = {
      user_id: 2,
      company_access: [{ company_id: 11, permission: 'read' }],
    };
    const denied = await svc.assertCompanyWriteAccess(user, 11);
    expect(denied).toEqual(
      expect.objectContaining({ status: 403, body: expect.objectContaining({ code: 'AUTH_FORBIDDEN' }) }),
    );
  });

  it('assertCompanyWriteAccess consente write su company_access', async () => {
    const user = {
      user_id: 3,
      company_access: [{ company_id: 11, permission: 'write' }],
    };
    expect(await svc.assertCompanyWriteAccess(user, 11)).toBeNull();
  });

  it('assertCompanyWriteAccess nega viewer studio senza company_access', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const user = { user_id: 4, role: 'viewer' };
    const denied = await svc.assertCompanyWriteAccess(user, 11);
    expect(denied?.status).toBe(403);
  });

  it('getUserCompanyAccess carica righe dal DB', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ company_id: 11, permission: 'write' }],
    });
    const rows = await svc.getUserCompanyAccess(9);
    expect(rows).toEqual([{ company_id: 11, permission: 'write' }]);
  });
});
