/**
 * @jest-environment node
 */
// Dopo il soft delete la riga non entra in lista, card e badge (stesso predicato).
jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../services/companyAccess.service', () => ({
    ensureCompanyAccessLoaded: jest.fn().mockResolvedValue([]),
    companyAccessSqlFilter: jest.fn().mockReturnValue({ clause: '', params: {} }),
    assertMutatingAllowed: jest.fn().mockResolvedValue(null),
    assertCompanyRead: jest.fn().mockResolvedValue(null),
    hasCompanyAccessRows: jest.fn().mockReturnValue(false),
    sendAccessDenied: jest.fn((res, denied) => res.status(denied.status).json(denied.body)),
}));
jest.mock('../services/qualificationIngest.service', () => ({ extractQualificationFromPdf: jest.fn() }));
jest.mock('../services/ingestStaging.service', () => ({ createStagingRecord: jest.fn() }));

const { getPool } = require('../config/database');
const { listQualifications, getStats, getOne } = require('./qualifications.controller');

function poolWith(queryImpl) {
    const request = { input: jest.fn().mockReturnThis(), query: jest.fn(queryImpl) };
    return { request: jest.fn(() => request), query: request.query };
}

describe('qualifiche — cestino fuori da conteggi e dettaglio', () => {
    beforeEach(() => jest.clearAllMocks());

    it('lista e card usano deleted_at IS NULL, così la riga cestinata non entra in scadute o urgenti', async () => {
        const pool = poolWith(async (sql) => {
            if (/COUNT\(\*\)/.test(sql) && /scadute/.test(sql)) {
                return { recordset: [{ total: 2, valide: 1, in_scadenza_60: 0, in_scadenza_30: 0, scadute: 1, non_attive: 0 }] };
            }
            if (/COUNT\(\*\)/.test(sql)) return { recordset: [{ total: 2 }] };
            return { recordset: [] };
        });
        getPool.mockResolvedValue(pool);
        const resList = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        await listQualifications({ query: { situazione: 'scadute' }, user: { organization_id: 1, user_id: 2, role: 'admin' } }, resList);
        const listSql = pool.query.mock.calls.map((c) => c[0]).find((sql) => /FROM qualifications q/.test(sql) && /SELECT q\.\*/.test(sql));
        expect(listSql).toContain('q.deleted_at IS NULL');
        expect(listSql).toContain('next_confirmation_due');

        const resStats = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        await getStats({ query: {}, user: { organization_id: 1, user_id: 2, role: 'admin' } }, resStats);
        const statsSql = pool.query.mock.calls.map((c) => c[0]).find((sql) => /in_scadenza_30/.test(sql));
        expect(statsSql).toContain('q.deleted_at IS NULL');
        expect(statsSql).toContain('AS scadute');
        expect(resStats.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2, scadute: 1 }));
    });

    it('il dettaglio di una riga cestinata è 404 per chi non è admin e resta visibile all\'admin', async () => {
        const row = { id: 3, company_id: 5, deleted_at: '2026-10-17', status: 'valida', person_name: 'Ada' };
        getPool.mockResolvedValue(poolWith(async () => ({ recordset: [row] })));
        const hidden = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        await getOne({ params: { id: '3' }, user: { organization_id: 1, user_id: 2, role: 'auditor' } }, hidden);
        expect(hidden.status).toHaveBeenCalledWith(404);

        const visible = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        await getOne({ params: { id: '3' }, user: { organization_id: 1, user_id: 2, role: 'admin' } }, visible);
        expect(visible.status).not.toHaveBeenCalledWith(404);
        expect(visible.json).toHaveBeenCalled();
    });
});

describe('migrazione 176 — slot unico e cestino', () => {
    it('l\'indice unico delle qualifiche e dei legami WPS esclude deleted_at', () => {
        const fs = require('fs');
        const path = require('path');
        const sql = fs.readFileSync(path.resolve(__dirname, '../../../database/migrations/176_soft_delete_columns.sql'), 'utf8');
        expect(sql).toContain('UX_qualif_org_company_cert_person_active');
        expect(sql).toContain("AND deleted_at IS NULL");
        expect(sql).toContain('UX_wps_wpqr_links_pair_active');
        expect(sql).toContain('WHERE deleted_at IS NULL');
    });
});
