/**
 * @jest-environment node
 */
// Cestino: solo admin/superadmin, scope A4, audit di ripristino.
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../controllers/attachment.controller', () => ({
    attachmentScopeSync: () => ({
        joinSql: 'LEFT JOIN non_conformities nc ON att.nc_id = nc.nc_id LEFT JOIN audits a ON a.audit_id = att.audit_id',
        orgClause: 'COALESCE(a.organization_id, nc.organization_id) = @organization_id',
        rbacClause: '',
        scopeParams: {},
    }),
}));
jest.mock('./companyAccess.service', () => ({
    ensureCompanyAccessLoaded: jest.fn(async (user) => user.company_access || []),
    hasCompanyAccessRows: jest.fn((list) => Array.isArray(list) && list.length > 0),
    companyAccessSqlFilter: jest.fn((list, alias) => {
        if (!list || !list.length) return { clause: '', params: {} };
        return { clause: `${alias}.company_id IN (@co0)`, params: { co0: list[0].company_id } };
    }),
    assertCompanyRead: jest.fn(async (user, companyId) => {
        const ok = (user.company_access || []).some((row) => Number(row.company_id) === Number(companyId));
        return ok ? null : { status: 403, body: { error: 'Azienda non accessibile', code: 'FORBIDDEN' } };
    }),
    sendAccessDenied: jest.fn((res, denied) => res.status(denied.status).json(denied.body)),
}));

const { query } = require('../config/database');
const { listTrash, restoreTrash } = require('./trash.service');

function resMock() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(function status(code) { this.statusCode = code; return this; });
    res.json = jest.fn(function json(payload) { this.body = payload; return this; });
    return res;
}

describe('cestino', () => {
    beforeEach(() => jest.clearAllMocks());

    it('un ruolo non admin riceve 403 e non legge le righe', async () => {
        const res = resMock();
        await listTrash({ user: { role: 'auditor', organization_id: 1, user_id: 3 }, query: {} }, res);
        expect(res.statusCode).toBe(403);
        expect(query).not.toHaveBeenCalled();
    });

    it('admin della stessa organizzazione vede solo le righe cestinate della propria org', async () => {
        query.mockImplementation(async (sql) => {
            if (/FROM qualifications/.test(sql)) {
                expect(sql).toContain('deleted_at IS NOT NULL');
                expect(sql).toContain('organization_id = @organization_id');
                return { recordset: [{ id: 4, company_id: 5, deleted_at: '2026-10-17', title: 'Ada', code: 'C-1', status: 'valida' }] };
            }
            return { recordset: [] };
        });
        const res = resMock();
        await listTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            query: { entity: 'qualifications' },
        }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].entity).toBe('qualifications');
    });

    it('id non intero → 400', async () => {
        const res = resMock();
        await restoreTrash({
            user: { role: 'superadmin', organization_id: 1, user_id: 9 },
            params: { entity: 'qualifications', id: '12abc' },
        }, res);
        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('INVALID_ID');
    });

    it('altra organizzazione → 404', async () => {
        query.mockResolvedValue({ recordset: [] });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'projects', id: '8' },
        }, res);
        expect(res.statusCode).toBe(404);
        const sql = String(query.mock.calls[0][0]);
        expect(sql).toContain('organization_id = @organization_id');
    });

    it('azienda non consentita → 403', async () => {
        query.mockResolvedValue({
            recordset: [{ id: 8, company_id: 99, deleted_at: '2026-10-17', status: 'attiva', title: 'P-9' }],
        });
        const res = resMock();
        await restoreTrash({
            user: {
                role: 'admin',
                organization_id: 1,
                user_id: 9,
                company_access: [{ company_id: 5, permission: 'write' }],
            },
            params: { entity: 'projects', id: '8' },
        }, res);
        expect(res.statusCode).toBe(403);
        expect(query.mock.calls.some((call) => /SET deleted_at = NULL/.test(String(call[0])))).toBe(false);
    });

    it('admin della stessa organizzazione ripristina e scrive il log prima/dopo', async () => {
        query.mockImplementation(async (sql) => {
            if (/INSERT INTO entity_change_log/.test(sql)) return { recordset: [] };
            if (/SET deleted_at = NULL/.test(sql)) return { recordset: [] };
            return { recordset: [{ id: 8, company_id: 5, deleted_at: '2026-10-17T00:00:00Z', status: 'attiva', title: 'P-9' }] };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'projects', id: '8' },
        }, res);
        expect(res.statusCode).toBe(200);
        const insert = query.mock.calls.find((call) => /INSERT INTO entity_change_log/.test(String(call[0])));
        expect(insert[1].action_type).toBe('restored');
        expect(insert[1].actor_user_id).toBe(9);
        expect(insert[1].organization_id).toBe(1);
        expect(insert[1].old_value).toContain('2026-10-17');
        expect(insert[1].new_value).toContain('null');
    });
});
