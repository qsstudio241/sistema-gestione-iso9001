/**
 * @jest-environment node
 *
 * Test L1 — getWPQRStats dopo rimozione expiry_date da wpqr_records.
 * I bucket restano solo su approval_status (da_approvare / approvate / rifiutate).
 * Nessuna scadenza calendario: ISO 15614/15613/14555.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const { query } = require('../config/database');
const { getWPQRStats } = require('./welding.controller');

function createRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(function status(code) { this.statusCode = code; return this; });
    res.json = jest.fn(function json(payload) { this.body = payload; return this; });
    return res;
}

describe('getWPQRStats — solo approval_status, nessuna expiry WPQR', () => {
    afterEach(() => jest.clearAllMocks());

    it('include i bucket approval_status e non usa wq.expiry_date', async () => {
        query.mockResolvedValueOnce({ recordset: [{}] });

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
    });

    it('restituisce i dati aggregati dal DB così come sono (nessuna trasformazione aggiuntiva)', async () => {
        const row = { totale: 10, da_approvare: 2, rifiutate: 1, approvate: 7 };
        query.mockResolvedValueOnce({ recordset: [row] });

        const req = { user: { organization_id: 1001 }, query: {} };
        const res = createRes();
        await getWPQRStats(req, res);

        expect(res.body).toEqual({ success: true, data: row });
    });

    it('applica il filtro company_id quando presente in query', async () => {
        query.mockResolvedValueOnce({ recordset: [{}] });

        const req = { user: { organization_id: 1001 }, query: { company_id: '5' } };
        const res = createRes();
        await getWPQRStats(req, res);

        const [sql, params] = query.mock.calls[0];
        expect(sql).toMatch(/company_id/);
        expect(params.company_id).toBe(5);
    });
});
