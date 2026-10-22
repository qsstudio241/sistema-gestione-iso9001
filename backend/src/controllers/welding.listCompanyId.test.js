/**
 * listWPS / listWPQR: company_id non numerico (Ambito «studio») è 400,
 * non una lista vuota da parseInt.
 */
const { query } = require('../config/database');

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

jest.mock('../services/companyAccess.service', () => ({
    ensureCompanyAccessLoaded: jest.fn(async () => []),
    hasCompanyAccessRows: (list) => Array.isArray(list) && list.length > 0,
    companyAccessSqlFilter: () => ({ clause: '', params: {} }),
    assertMutatingAllowed: jest.fn(async () => null),
    assertCompanyRead: jest.fn(async () => null),
    getAllowedCompanyIds: () => null,
    sendAccessDenied: jest.fn((res, denied) => res.status(denied.status).json(denied.body)),
}));

jest.mock('../services/wpsWpqrLinks.service', () => ({
    insertLink: jest.fn(),
    listWpqrRecordsForWps: jest.fn(),
    wpqrLinkedToWpsCountSql: () => '0',
    linksAvailable: jest.fn(async () => false),
    ROLES: {},
}));

const { listWPS, listWPQR } = require('./welding.controller');

function mockRes() {
    const res = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
    return res;
}

const user = { organization_id: 1003, user_id: 1006, role: 'admin' };

beforeEach(() => {
    query.mockReset();
    query.mockImplementation(async (sql) => {
        if (/COUNT\(\*\) AS total/i.test(sql)) return { recordset: [{ total: 11 }] };
        return { recordset: [] };
    });
});

describe('listWPS / listWPQR — company_id', () => {
    it.each([
        ['studio'],
        ['abc'],
        ['12abc'],
        ['1.5'],
    ])('listWPS company_id %j → 400 senza query', async (bad) => {
        const res = mockRes();
        await listWPS({ user, query: { company_id: bad, page: '1', limit: '30' } }, res);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual(expect.objectContaining({ code: 'INVALID_COMPANY_ID' }));
        expect(query).not.toHaveBeenCalled();
    });

    it.each([
        ['studio'],
        ['abc'],
    ])('listWPQR company_id %j → 400 senza query', async (bad) => {
        const res = mockRes();
        await listWPQR({ user, query: { company_id: bad, page: '1', limit: '30' } }, res);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual(expect.objectContaining({ code: 'INVALID_COMPANY_ID' }));
        expect(query).not.toHaveBeenCalled();
    });

    it('company_id assente: lista WPQR senza filtro azienda', async () => {
        const res = mockRes();
        await listWPQR({ user, query: { page: '1', limit: '30' } }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.pagination.total).toBe(11);
        const sql = query.mock.calls.map((c) => c[0]).join('\n');
        expect(sql).not.toMatch(/wq\.company_id = @company_id/);
    });

    it('company_id numerico resta nel filtro WPS', async () => {
        const res = mockRes();
        await listWPS({ user, query: { company_id: '91', page: '1', limit: '30' } }, res);
        expect(res.statusCode).toBe(200);
        const params = query.mock.calls[0][1];
        expect(params.company_id).toBe(91);
        expect(query.mock.calls[0][0]).toMatch(/w\.company_id = @company_id/);
    });
});
