/**
 * @jest-environment node
 */
// Un salvataggio o una copertura non usano un padre già nel cestino.
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
const welding = require('./welding.controller');
const projects = require('./projects.controller');

function createRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(function status(code) { this.statusCode = code; return this; });
    res.json = jest.fn(function json(payload) { this.body = payload; return this; });
    return res;
}

const user = { organization_id: 1, user_id: 2, role: 'admin', company_access: [] };

describe('padri nel cestino', () => {
    afterEach(() => jest.clearAllMocks());

    it('crea un WPQR senza cercare la WPS', async () => {
        query.mockImplementation(async (sql) => {
            if (/FROM companies/.test(sql)) return { recordset: [{ id: 5 }] };
            if (/INSERT INTO wpqr_records/.test(sql)) return { recordset: [{ id: 77 }] };
            return { recordset: [] };
        });
        const res = createRes();
        await welding.createWPQR({ user, body: { company_id: 5, wps_id: 4, wpqr_code: 'Q-1', wps_ref: 'pWPS-1' } }, res);
        expect(res.statusCode).toBe(201);
        const sqls = query.mock.calls.map((call) => String(call[0]));
        expect(sqls.some((sql) => /FROM welding_procedures/.test(sql))).toBe(false);
        expect(sqls.find((sql) => /INSERT INTO wpqr_records/.test(sql))).not.toMatch(/\bwps_id\b/);
    });

    it('un wps_id in modifica non sposta la scheda e non viene scritto', async () => {
        query.mockImplementation(async (sql) => {
            if (/FROM wpqr_records/.test(sql)) return { recordset: [{ id: 3, company_id: 5 }] };
            return { recordset: [] };
        });
        const res = createRes();
        await welding.updateWPQR({ user, params: { id: '3' }, body: { wps_id: '8', notes: 'n' } }, res);
        expect(res.statusCode).toBe(200);
        const update = query.mock.calls.find((call) => /UPDATE wpqr_records/.test(String(call[0])));
        expect(update[0]).not.toMatch(/wps_id/);
        expect(update[1].notes).toBe('n');
        expect(update[1].wps_id).toBeUndefined();
    });

    it('non assegna una qualifica cestinata a una WPS', async () => {
        query.mockImplementation(async (sql) => {
            if (/FROM welding_procedures/.test(sql)) return { recordset: [{ id: 4, company_id: 5 }] };
            return { recordset: [] };
        });
        const res = createRes();
        await welding.assignWpsWelder({
            user,
            params: { id: '4' },
            body: { qualification_id: 9 },
        }, res);
        const qualSql = query.mock.calls.map((call) => String(call[0])).find((sql) => /FROM qualifications/.test(sql));
        expect(qualSql).toContain('deleted_at IS NULL');
        expect(res.statusCode).toBe(404);
    });

    it('la coverage non legge una commessa cestinata', async () => {
        query.mockResolvedValue({ recordset: [] });
        const res = createRes();
        await welding.getWpsCoverage({ user, query: { project_id: '6' } }, res);
        expect(String(query.mock.calls[0][0])).toContain('deleted_at IS NULL');
        expect(res.statusCode).toBe(404);
    });

    it('non aggiunge un saldatore a una commessa cestinata', async () => {
        query.mockResolvedValue({ recordset: [] });
        const res = createRes();
        await projects.addProjectWelder({
            user,
            params: { id: '6' },
            body: { qualification_id: 9 },
        }, res);
        expect(String(query.mock.calls[0][0])).toContain('deleted_at IS NULL');
        expect(res.statusCode).toBe(404);
    });

    it('non collega una WPS cestinata al saldatore di commessa', async () => {
        query.mockImplementation(async (sql) => {
            if (/FROM projects/.test(sql)) return { recordset: [{ id: 6, company_id: 5 }] };
            if (/FROM qualifications/.test(sql)) {
                return {
                    recordset: [{
                        id: 9,
                        company_id: 5,
                        approval_status: 'approvata',
                        status: 'valida',
                        expiry_date: '2099-01-01',
                        person_name: 'Ada',
                    }],
                };
            }
            return { recordset: [] };
        });
        const res = createRes();
        await projects.addProjectWelder({
            user,
            params: { id: '6' },
            body: { qualification_id: 9, wps_id: '4' },
        }, res);
        const wpsSql = query.mock.calls.map((call) => String(call[0])).find((sql) => /FROM welding_procedures/.test(sql));
        expect(wpsSql).toContain('deleted_at IS NULL');
        expect(res.statusCode).toBe(404);
    });
});
