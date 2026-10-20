/**
 * @jest-environment node
 *
 * L1 — createWPS persiste il legame D9 verso la WPQR della bozza generata.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../services/entityChangeLog.service', () => ({
    logEntityChange: jest.fn().mockResolvedValue(undefined),
    trashedDetailHidden: jest.fn().mockReturnValue(false),
    softDeleteSql: jest.fn((table, col) => `UPDATE ${table} SET deleted_at = SYSUTCDATETIME() WHERE ${col} = @id`),
}));
jest.mock('../services/companyAccess.service', () => ({
    ensureCompanyAccessLoaded: jest.fn().mockResolvedValue([]),
    companyAccessSqlFilter: jest.fn(),
    assertMutatingAllowed: jest.fn().mockResolvedValue(null),
    assertCompanyRead: jest.fn().mockResolvedValue(null),
    hasCompanyAccessRows: jest.fn().mockReturnValue(false),
    sendAccessDenied: jest.fn(),
}));

jest.mock('../services/wpsWpqrLinks.service', () => {
    const actual = jest.requireActual('../services/wpsWpqrLinks.service');
    return {
        ...actual,
        insertLink: jest.fn(),
        linksAvailable: jest.fn().mockResolvedValue(true),
        listWpqrRecordsForWps: jest.fn().mockResolvedValue([]),
    };
});

const { query } = require('../config/database');
const { insertLink } = require('../services/wpsWpqrLinks.service');
const ctrl = require('./welding.controller');

function createRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(function status(code) { this.statusCode = code; return this; });
    res.json = jest.fn(function json(payload) { this.body = payload; return this; });
    return res;
}

describe('createWPS — legame WPQR', () => {
    afterEach(() => jest.clearAllMocks());

    it('con wpqr_id chiama insertLink primary dopo l\'INSERT', async () => {
        query.mockResolvedValue({ recordset: [{ id: 77 }] });
        insertLink.mockResolvedValue({ created: true, available: true });
        const res = createRes();
        await ctrl.createWPS({
            user: { organization_id: 1005, user_id: 9 },
            body: {
                company_id: 50,
                wps_code: 'WPS-BW-S355',
                welding_process: '135',
                wpqr_id: 31,
            },
        }, res);
        expect(res.statusCode).toBe(201);
        expect(insertLink).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: 1005,
            companyId: 50,
            wpsId: 77,
            wpqrId: 31,
            role: 'primary',
            userId: 9,
        }));
        expect(res.body.data.wpqr_id).toBe(31);
        expect(res.body.data.wpqr_link.created).toBe(true);
    });

    it('senza wpqr_id non chiama insertLink', async () => {
        query.mockResolvedValue({ recordset: [{ id: 78 }] });
        const res = createRes();
        await ctrl.createWPS({
            user: { organization_id: 1005, user_id: 9 },
            body: { company_id: 50, wps_code: 'WPS-MANUALE' },
        }, res);
        expect(res.statusCode).toBe(201);
        expect(insertLink).not.toHaveBeenCalled();
        expect(res.body.data.wpqr_id).toBeNull();
    });
});
