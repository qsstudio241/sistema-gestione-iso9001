/**
 * @jest-environment node
 *
 * Test L1 — getWPQRStats dopo rimozione expiry_date da wpqr_records.
 * I bucket restano solo su approval_status (da_approvare / approvate / rifiutate).
 * Nessuna scadenza calendario: ISO 15614/15613/14555.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../services/companyAccess.service', () => ({
    ensureCompanyAccessLoaded: jest.fn(async () => []),
    hasCompanyAccessRows: jest.fn(() => false),
    companyAccessSqlFilter: jest.fn(() => ({ clause: '', params: {} })),
    assertCompanyRead: jest.fn(async () => null),
    assertMutatingAllowed: jest.fn(async () => null),
    sendAccessDenied: jest.fn((res, denied) => res.status(denied.status).json(denied.body)),
}));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const { query } = require('../config/database');
const { getWPQRStats } = require('./welding.controller');

function createRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(function status(code) { this.statusCode = code; return this; });
    res.json = jest.fn(function json(payload) { this.body = payload; return this; });
    return res;
}

function mockStatsQueries(aggregate, rows = []) {
    query.mockImplementation(async (sql) => {
        if (/SUM\(CASE WHEN/.test(sql)) return { recordset: [aggregate] };
        if (/FROM wpqr_test_runs|FROM discrepancy_notices/i.test(sql)) return { recordset: [] };
        if (/FROM wpqr_records/i.test(sql)) return { recordset: rows };
        return { recordset: [] };
    });
}

describe('getWPQRStats — solo approval_status, nessuna expiry WPQR', () => {
    afterEach(() => jest.clearAllMocks());

    it('include i bucket approval_status e non usa wq.expiry_date', async () => {
        mockStatsQueries({ totale: 0, da_approvare: 0, rifiutate: 0, approvate: 0 });

        const req = { user: { organization_id: 1001 }, query: {} };
        const res = createRes();
        await getWPQRStats(req, res);

        const [sql] = query.mock.calls[0];
        expect(sql).toMatch(/approval_status = 'rifiutata'\s+THEN 1 ELSE 0 END\) AS rifiutate/);
        expect(sql).toMatch(/approval_status = 'approvata'\s+THEN 1 ELSE 0 END\) AS approvate/);
        expect(sql).toMatch(/approval_status = 'bozza'\s+THEN 1 ELSE 0 END\) AS da_approvare/);
        expect(sql).not.toMatch(/wq\.expiry_date/);
        expect(sql).not.toMatch(/AS scadute/);
        expect(sql).not.toMatch(/AS in_scadenza/);
        expect(res.body.data.da_rivedere).toBe(0);
    });

    it('un record approvato con avviso aperto è da rivedere e non conta fra le approvate verificate', async () => {
        mockStatsQueries(
            { totale: 1, da_approvare: 0, rifiutate: 0, approvate: 1 },
            [{
                id: 23,
                approval_status: 'approvata',
                wpqr_code: '16VE01735P02/A',
                certificate_number: '16VE01735PO2/A',
                examiner_body: 'RINA',
                welding_process: '135',
                standard_reference: 'UNI EN ISO 15614-1:2017',
            }],
        );

        const req = { user: { organization_id: 1001 }, query: {} };
        const res = createRes();
        await getWPQRStats(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.da_rivedere).toBe(1);
        expect(res.body.data.approvate).toBe(0);
        expect(res.body.data.da_approvare).toBe(0);
    });

    it('applica il filtro company_id quando presente in query', async () => {
        mockStatsQueries({ totale: 0, da_approvare: 0, rifiutate: 0, approvate: 0 });

        const req = { user: { organization_id: 1001 }, query: { company_id: '5' } };
        const res = createRes();
        await getWPQRStats(req, res);

        const [sql, params] = query.mock.calls[0];
        expect(sql).toMatch(/company_id/);
        expect(params.company_id).toBe(5);
    });
});
