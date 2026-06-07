/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const { query } = require('../config/database');
const ctrl = require('./organization.controller');

function mockReq(overrides = {}) {
  return {
    user: { organization_id: 10, role: 'admin' },
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

describe('getDocTypeConfig', () => {
  it('restituisce wrapper { success, data } e migra etichette legacy', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [
          { doc_type: 'Procedura', prefix: 'PG', auto_number: 1, next_number: 3, default_expiry_months: 24 },
        ],
      })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] });

    const res = mockRes();
    await ctrl.getDocTypeConfig(mockReq(), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ doc_type: 'procedura', prefix: 'PG' }),
        ]),
      })
    );
    expect(query).toHaveBeenCalledTimes(3);
  });
});

describe('saveDocTypeConfig', () => {
  it('normalizza doc_type in salvataggio', async () => {
    query
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({
        recordset: [{ doc_type: 'modulo', prefix: 'MOD', auto_number: 1, next_number: 1, default_expiry_months: null }],
      });

    const req = mockReq({
      body: [{ doc_type: 'Modulo', prefix: 'MOD', auto_number: true }],
    });
    const res = mockRes();

    await ctrl.saveDocTypeConfig(req, res);

    const insertCall = query.mock.calls.find((c) => String(c[0]).includes('INSERT INTO dbo.doc_type_config'));
    expect(insertCall[1].doc_type).toBe('modulo');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Array) })
    );
  });
});
