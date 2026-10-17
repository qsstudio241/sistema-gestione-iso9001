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
        const restoreSql = String(query.mock.calls.find((call) => /SET deleted_at = NULL/.test(String(call[0])))[0]);
        expect(restoreSql).toContain('organization_id = @organization_id');
    });

    it('il ripristino di un allegato porta lo scope organizzazione nello stesso UPDATE', async () => {
        query.mockImplementation(async (sql) => {
            if (/INSERT INTO entity_change_log/.test(sql)) return { recordset: [] };
            if (/SET deleted_at = NULL/.test(sql)) return { recordset: [] };
            return {
                recordset: [{
                    id: 4,
                    company_id: 5,
                    deleted_at: '2026-10-17T00:00:00Z',
                    title: 'foto.pdf',
                    organization_id: 1,
                }],
            };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'attachments', id: '4' },
        }, res);
        expect(res.statusCode).toBe(200);
        const restoreSql = String(query.mock.calls.find((call) => /SET deleted_at = NULL/.test(String(call[0])))[0]);
        expect(restoreSql).toContain('organization_id');
        expect(restoreSql).toContain('@organization_id');
        expect(restoreSql).not.toMatch(/WHERE attachment_id = @id AND deleted_at IS NOT NULL\s*$/);
    });

    it('il ripristino di una WPS riporta anche WPQR, passate, link e saldatori', async () => {
        query.mockImplementation(async (sql) => {
            if (/INSERT INTO entity_change_log/.test(sql) || /SET deleted_at = NULL/.test(sql)) return { recordset: [] };
            return { recordset: [{ id: 6, company_id: 5, deleted_at: '2026-10-17T00:00:00Z', status: 'attiva', title: 'WPS-1' }] };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'welding_procedures', id: '6' },
        }, res);
        expect(res.statusCode).toBe(200);
        const sqls = query.mock.calls.map((call) => String(call[0]));
        expect(sqls.some((sql) => /UPDATE wpqr_records SET deleted_at = NULL/.test(sql) && sql.includes('organization_id = @organization_id'))).toBe(true);
        expect(sqls.some((sql) => /UPDATE r SET deleted_at = NULL/.test(sql))).toBe(true);
        expect(sqls.some((sql) => /UPDATE wps_wpqr_links SET deleted_at = NULL/.test(sql))).toBe(true);
        expect(sqls.some((sql) => /UPDATE wps_welders SET deleted_at = NULL/.test(sql))).toBe(true);
    });

    it('non ripristina una WPQR se la WPS è ancora nel cestino', async () => {
        query.mockImplementation(async (sql) => {
            if (/parent_deleted/.test(sql)) return { recordset: [{ parent_deleted: '2026-10-17T00:00:00Z' }] };
            return { recordset: [{ id: 3, company_id: 5, deleted_at: '2026-10-17T00:00:00Z', status: 'approvata', title: 'WPQR-1' }] };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'wpqr_records', id: '3' },
        }, res);
        expect(res.statusCode).toBe(409);
        expect(res.body.code).toBe('PARENT_IN_TRASH');
        expect(query.mock.calls.some((call) => /SET deleted_at = NULL/.test(String(call[0])))).toBe(false);
    });

    it('la NC da audit compare nel cestino con organizzazione e azienda dell\'audit', async () => {
        query.mockImplementation(async (sql) => {
            expect(sql).toContain('COALESCE(t.organization_id, au.organization_id) = @organization_id');
            expect(sql).toContain('LEFT JOIN audits au');
            expect(sql).toContain('COALESCE(t.company_id, au.company_id)');
            expect(sql).toContain('deleted_at IS NOT NULL');
            return { recordset: [{ id: 12, company_id: 5, deleted_at: '2026-10-17', title: 'NC-1', code: 'NC-1', status: 'open' }] };
        });
        const res = resMock();
        await listTrash({
            user: {
                role: 'admin',
                organization_id: 1,
                user_id: 9,
                company_access: [{ company_id: 5, permission: 'read' }],
            },
            query: { entity: 'non_conformities' },
        }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].entity).toBe('non_conformities');
        const sql = String(query.mock.calls[0][0]);
        expect(sql).toContain('COALESCE(t.company_id, au.company_id) IN (@co0)');
        expect(sql).not.toContain('t.organization_id = @organization_id');
    });

    it('il ripristino di una NC da audit usa COALESCE e riporta azioni e allegati', async () => {
        query.mockImplementation(async (sql) => {
            if (/INSERT INTO entity_change_log/.test(sql) || /SET deleted_at = NULL/.test(sql)) return { recordset: [] };
            return {
                recordset: [{
                    id: 12,
                    company_id: 5,
                    deleted_at: '2026-10-17T00:00:00Z',
                    status: 'open',
                    title: 'NC-1',
                    organization_id: 1,
                }],
            };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'non_conformities', id: '12' },
        }, res);
        expect(res.statusCode).toBe(200);
        const sqls = query.mock.calls.map((call) => String(call[0]));
        const parent = sqls.find((sql) => /UPDATE nc\s+SET deleted_at = NULL/.test(sql));
        expect(parent).toContain('COALESCE(nc.organization_id, au.organization_id) = @organization_id');
        expect(parent).toContain('LEFT JOIN audits au');
        expect(sqls.some((sql) => /UPDATE a SET deleted_at = NULL/.test(sql) && sql.includes('FROM nc_actions'))).toBe(true);
        expect(sqls.some((sql) => /UPDATE att SET deleted_at = NULL/.test(sql))).toBe(true);
        const insert = query.mock.calls.find((call) => /INSERT INTO entity_change_log/.test(String(call[0])));
        expect(insert[1].action_type).toBe('restored');
    });

    it('una NC di un\'altra organizzazione non si ripristina', async () => {
        query.mockResolvedValue({
            recordset: [{ id: 12, company_id: 5, deleted_at: '2026-10-17', organization_id: 2, title: 'NC-1' }],
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'non_conformities', id: '12' },
        }, res);
        expect(res.statusCode).toBe(404);
        expect(query.mock.calls.some((call) => /SET deleted_at = NULL/.test(String(call[0])))).toBe(false);
    });

    it('il ripristino di una NC da audit ricalcola il contatore sull\'audit', async () => {
        query.mockImplementation(async (sql) => {
            if (/INSERT INTO entity_change_log/.test(sql) || /SET deleted_at = NULL/.test(sql) || /non_conformities_count/.test(sql)) {
                return { recordset: [] };
            }
            return {
                recordset: [{
                    id: 12,
                    audit_id: 44,
                    company_id: 5,
                    deleted_at: '2026-10-17T00:00:00Z',
                    status: 'open',
                    title: 'NC-1',
                    organization_id: 1,
                }],
            };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'non_conformities', id: '12' },
        }, res);
        expect(res.statusCode).toBe(200);
        const counter = query.mock.calls.find((call) => /non_conformities_count/.test(String(call[0])));
        expect(String(counter[0])).toContain('deleted_at IS NULL');
        expect(String(counter[0])).toContain('organization_id = @organization_id');
        expect(counter[1].audit_id).toBe(44);
        expect(counter[1].organization_id).toBe(1);
    });

    it('non ripristina una NC se la stessa domanda ha già una NC attiva', async () => {
        query.mockImplementation(async (sql) => {
            if (/AS conflict/.test(sql)) {
                expect(sql).toContain('source_question_id');
                expect(sql).toContain('source_custom_item_id');
                expect(sql).toContain('deleted_at IS NULL');
                return { recordset: [{ conflict: 1 }] };
            }
            return {
                recordset: [{
                    id: 12, audit_id: 44, company_id: 5, deleted_at: '2026-10-17',
                    status: 'open', title: 'NC-1', organization_id: 1,
                }],
            };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'non_conformities', id: '12' },
        }, res);
        expect(res.statusCode).toBe(409);
        expect(res.body.code).toBe('RESTORE_CONFLICT');
        expect(query.mock.calls.some((call) => /SET deleted_at = NULL/.test(String(call[0])))).toBe(false);
        expect(query.mock.calls.some((call) => /non_conformities_count/.test(String(call[0])))).toBe(false);
    });

    it('non ripristina una qualifica se lo slot attivo del certificato è occupato', async () => {
        query.mockImplementation(async (sql) => {
            if (/AS conflict/.test(sql)) {
                expect(sql).toContain('certificate_number');
                expect(sql).toContain("status <> 'revocata'");
                expect(sql).toContain('deleted_at IS NULL');
                return { recordset: [{ conflict: 1 }] };
            }
            return { recordset: [{ id: 4, company_id: 5, deleted_at: '2026-10-17', status: 'valida', title: 'Ada' }] };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'qualifications', id: '4' },
        }, res);
        expect(res.statusCode).toBe(409);
        expect(res.body.code).toBe('RESTORE_CONFLICT');
        expect(query.mock.calls.some((call) => /SET deleted_at = NULL/.test(String(call[0])))).toBe(false);
    });

    it('non ripristina un legame WPS-WPQR se la coppia attiva esiste già', async () => {
        query.mockImplementation(async (sql) => {
            if (/AS conflict/.test(sql)) {
                expect(sql).toContain('o.wps_id = t.wps_id');
                expect(sql).toContain('o.wpqr_id = t.wpqr_id');
                expect(sql).toContain('deleted_at IS NULL');
                return { recordset: [{ conflict: 1 }] };
            }
            if (/parent_deleted/.test(sql)) return { recordset: [{ parent_deleted: null }] };
            return { recordset: [{ id: 9, company_id: 5, deleted_at: '2026-10-17', title: '6' }] };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'wps_wpqr_links', id: '9' },
        }, res);
        expect(res.statusCode).toBe(409);
        expect(res.body.code).toBe('RESTORE_CONFLICT');
        expect(query.mock.calls.some((call) => /SET deleted_at = NULL/.test(String(call[0])))).toBe(false);
    });

    it('non ripristina un saldatore su WPS se l\'assegnazione attiva esiste già', async () => {
        query.mockImplementation(async (sql) => {
            if (/AS conflict/.test(sql)) {
                expect(sql).toContain('qualification_id');
                expect(sql).toContain('deleted_at IS NULL');
                return { recordset: [{ conflict: 1 }] };
            }
            if (/parent_deleted/.test(sql)) return { recordset: [{ parent_deleted: null }] };
            return { recordset: [{ id: 2, company_id: 5, deleted_at: '2026-10-17', title: '9' }] };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'wps_welders', id: '2' },
        }, res);
        expect(res.statusCode).toBe(409);
        expect(res.body.code).toBe('RESTORE_CONFLICT');
    });

    it('non ripristina un saldatore di commessa se l\'assegnazione attiva esiste già', async () => {
        query.mockImplementation(async (sql) => {
            if (/AS conflict/.test(sql)) {
                expect(sql).toContain('project_id');
                expect(sql).toContain('deleted_at IS NULL');
                return { recordset: [{ conflict: 1 }] };
            }
            if (/parent_deleted/.test(sql)) return { recordset: [{ parent_deleted: null }] };
            return { recordset: [{ id: 3, company_id: 5, deleted_at: '2026-10-17', title: '9' }] };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'project_welders', id: '3' },
        }, res);
        expect(res.statusCode).toBe(409);
        expect(res.body.code).toBe('RESTORE_CONFLICT');
        expect(query.mock.calls.some((call) => /SET deleted_at = NULL/.test(String(call[0])))).toBe(false);
    });

    it('il ripristino di una WPS non riporta i figli che occuperebbero uno slot attivo', async () => {
        query.mockImplementation(async (sql) => {
            if (/INSERT INTO entity_change_log/.test(sql) || /SET deleted_at = NULL/.test(sql)) return { recordset: [] };
            return { recordset: [{ id: 6, company_id: 5, deleted_at: '2026-10-17T00:00:00Z', status: 'attiva', title: 'WPS-1' }] };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'welding_procedures', id: '6' },
        }, res);
        expect(res.statusCode).toBe(200);
        const sqls = query.mock.calls.map((call) => String(call[0]));
        const links = sqls.find((sql) => /UPDATE wps_wpqr_links SET deleted_at = NULL/.test(sql) && /wps_id = @id/.test(sql));
        const welders = sqls.find((sql) => /UPDATE wps_welders SET deleted_at = NULL/.test(sql));
        expect(links).toContain('NOT EXISTS');
        expect(links).toContain('active.deleted_at IS NULL');
        expect(welders).toContain('NOT EXISTS');
    });

    it('il ripristino di una commessa non riporta un saldatore già assegnato', async () => {
        query.mockImplementation(async (sql) => {
            if (/INSERT INTO entity_change_log/.test(sql) || /SET deleted_at = NULL/.test(sql)) return { recordset: [] };
            return { recordset: [{ id: 8, company_id: 5, deleted_at: '2026-10-17T00:00:00Z', status: 'attiva', title: 'P-9' }] };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'projects', id: '8' },
        }, res);
        expect(res.statusCode).toBe(200);
        const projectSql = query.mock.calls.map((call) => String(call[0])).find((sql) => /UPDATE project_welders SET deleted_at = NULL/.test(sql));
        expect(projectSql).toContain('NOT EXISTS');
        expect(projectSql).toContain('active.deleted_at IS NULL');
    });

    it('il ripristino di un WPQR non riporta un legame la cui coppia è già attiva', async () => {
        query.mockImplementation(async (sql) => {
            if (/parent_deleted/.test(sql)) return { recordset: [{ parent_deleted: null }] };
            if (/INSERT INTO entity_change_log/.test(sql) || /SET deleted_at = NULL/.test(sql)) return { recordset: [] };
            return { recordset: [{ id: 3, company_id: 5, deleted_at: '2026-10-17T00:00:00Z', status: 'approvata', title: 'WPQR-1' }] };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'wpqr_records', id: '3' },
        }, res);
        expect(res.statusCode).toBe(200);
        const links = query.mock.calls.map((call) => String(call[0])).find((sql) => /UPDATE wps_wpqr_links SET deleted_at = NULL/.test(sql));
        expect(links).toContain('wpqr_id = @id');
        expect(links).toContain('NOT EXISTS');
        expect(links).toContain('active.deleted_at IS NULL');
    });

    it('una violazione di indice unico in corsa risponde 409', async () => {
        query.mockImplementation(async (sql) => {
            if (/SET deleted_at = NULL/.test(sql)) {
                const err = new Error('Cannot insert duplicate key row in object UNIQUE');
                err.number = 2601;
                throw err;
            }
            return { recordset: [{ id: 8, company_id: 5, deleted_at: '2026-10-17', status: 'attiva', title: 'P-9' }] };
        });
        const res = resMock();
        await restoreTrash({
            user: { role: 'admin', organization_id: 1, user_id: 9, company_access: [] },
            params: { entity: 'projects', id: '8' },
        }, res);
        expect(res.statusCode).toBe(409);
        expect(res.body.code).toBe('RESTORE_CONFLICT');
    });
});
