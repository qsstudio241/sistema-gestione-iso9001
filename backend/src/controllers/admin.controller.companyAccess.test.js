/**
 * Test slice UAL-1 — endpoint user_company_access (list/add/remove)
 * Verifica scope organizzazione (admin vs superadmin) e validazioni base.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const ctrl = require('./admin.controller');

const ORG_ID = 1001;
const TARGET_USER_ID = 42;

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    ...overrides,
    user: {
      organization_id: ORG_ID,
      role: 'admin',
      ...(overrides.user || {}),
    },
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

afterEach(() => jest.clearAllMocks());

describe('listUserCompanyAccess', () => {
  it('ritorna 404 se l\'utente target non appartiene all\'organizzazione dell\'attore', async () => {
    query.mockResolvedValueOnce({ recordset: [] }); // resolveTargetUser: nessun match
    const req = mockReq({ params: { id: String(TARGET_USER_ID) } });
    const res = mockRes();

    await ctrl.listUserCompanyAccess(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, code: 'USER_NOT_FOUND' })
    );
  });

  it('ritorna la lista accessi azienda per un utente valido', async () => {
    query.mockResolvedValueOnce({ recordset: [{ user_id: TARGET_USER_ID, organization_id: ORG_ID }] });
    query.mockResolvedValueOnce({
      recordset: [{ id: 1, company_id: 7, permission: 'read', company_name: 'Azienda Test' }],
    });
    const req = mockReq({ params: { id: String(TARGET_USER_ID) } });
    const res = mockRes();

    await ctrl.listUserCompanyAccess(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: 1, company_id: 7, permission: 'read', company_name: 'Azienda Test' }],
    });
  });

  it('superadmin può leggere accessi di un utente di qualsiasi organizzazione', async () => {
    query.mockResolvedValueOnce({ recordset: [{ user_id: TARGET_USER_ID, organization_id: 9999 }] });
    query.mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({ params: { id: String(TARGET_USER_ID) }, user: { role: 'superadmin', organization_id: ORG_ID } });
    const res = mockRes();

    await ctrl.listUserCompanyAccess(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: [] }));
    // resolveTargetUser per superadmin non filtra su organization_id dell'attore
    const firstCallSql = query.mock.calls[0][0];
    expect(firstCallSql).not.toContain('organization_id = @organization_id');
  });
});

describe('addUserCompanyAccess', () => {
  it('rifiuta company_id mancante', async () => {
    query.mockResolvedValueOnce({ recordset: [{ user_id: TARGET_USER_ID, organization_id: ORG_ID }] });
    const req = mockReq({ params: { id: String(TARGET_USER_ID) }, body: { permission: 'read' } });
    const res = mockRes();

    await ctrl.addUserCompanyAccess(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, code: 'VALIDATION_ERROR' })
    );
  });

  it('rifiuta permission diversa da read/write', async () => {
    query.mockResolvedValueOnce({ recordset: [{ user_id: TARGET_USER_ID, organization_id: ORG_ID }] });
    const req = mockReq({ params: { id: String(TARGET_USER_ID) }, body: { company_id: 7, permission: 'admin' } });
    const res = mockRes();

    await ctrl.addUserCompanyAccess(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/read o write/);
  });

  it('rifiuta un\'azienda che non appartiene all\'organizzazione dell\'utente target', async () => {
    query.mockResolvedValueOnce({ recordset: [{ user_id: TARGET_USER_ID, organization_id: ORG_ID }] });
    query.mockResolvedValueOnce({ recordset: [] }); // validateCompanyInOrg: nessun match
    const req = mockReq({ params: { id: String(TARGET_USER_ID) }, body: { company_id: 7, permission: 'read' } });
    const res = mockRes();

    await ctrl.addUserCompanyAccess(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, code: 'INVALID_COMPANY' })
    );
  });

  it('concede l\'accesso (MERGE) con dati validi', async () => {
    query.mockResolvedValueOnce({ recordset: [{ user_id: TARGET_USER_ID, organization_id: ORG_ID }] });
    query.mockResolvedValueOnce({ recordset: [{ id: 7 }] }); // validateCompanyInOrg OK
    query.mockResolvedValueOnce({ recordset: [] }); // MERGE
    const req = mockReq({ params: { id: String(TARGET_USER_ID) }, body: { company_id: 7, permission: 'write' } });
    const res = mockRes();

    await ctrl.addUserCompanyAccess(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { company_id: 7, permission: 'write' } })
    );
    const mergeSql = query.mock.calls[2][0];
    expect(mergeSql).toContain('MERGE user_company_access');
  });
});

describe('removeUserCompanyAccess', () => {
  it('ritorna 404 se l\'utente target non è nell\'organizzazione dell\'attore', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({ params: { id: String(TARGET_USER_ID), companyId: '7' } });
    const res = mockRes();

    await ctrl.removeUserCompanyAccess(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rimuove l\'accesso con parametri validi', async () => {
    query.mockResolvedValueOnce({ recordset: [{ user_id: TARGET_USER_ID, organization_id: ORG_ID }] });
    query.mockResolvedValueOnce({ recordset: [] }); // DELETE
    const req = mockReq({ params: { id: String(TARGET_USER_ID), companyId: '7' } });
    const res = mockRes();

    await ctrl.removeUserCompanyAccess(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
    const deleteSql = query.mock.calls[1][0];
    expect(deleteSql).toContain('DELETE FROM user_company_access');
  });
});
