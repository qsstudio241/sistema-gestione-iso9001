/**
 * Test CRUD notificationContacts.controller (Slice 2)
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const ctrl = require('./notificationContacts.controller');

const ORG_ID = 1001;

function mockReq(overrides = {}) {
  return {
    user: { organization_id: ORG_ID },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

afterEach(() => jest.clearAllMocks());

describe('notificationContacts CRUD', () => {
  it('createContact valida email', async () => {
    const req = mockReq({
      body: { name: 'Mario', email: 'bad', role_type: 'attuazione' },
    });
    const res = mockRes();
    await ctrl.createContact(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('createContact inserisce referente', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 1, name: 'Mario', email: 'm@x.it' }] });
    const req = mockReq({
      body: { name: 'Mario', email: 'm@x.it', role_type: 'attuazione' },
    });
    const res = mockRes();
    await ctrl.createContact(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(query.mock.calls[0][1].email).toBe('m@x.it');
  });

  it('listContacts filtra per org', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({ query: { active: 'true' } });
    const res = mockRes();
    await ctrl.listContacts(req, res);
    expect(query.mock.calls[0][0]).toContain('organization_id = @org');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  it('deleteContact 404 se assente', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await ctrl.deleteContact(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('validateEmail', () => {
  it('accetta email valida', () => {
    expect(ctrl.validateEmail('test@studio.it')).toBe(true);
  });
});
