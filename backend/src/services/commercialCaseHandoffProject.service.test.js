/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
    query: jest.fn(),
    getPool: jest.fn(),
    sql: {
        Transaction: jest.fn(),
        Request: jest.fn(),
    },
}));
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

const { query, getPool, sql } = require('../config/database');
const { linkApprovedCaseToProject } = require('./commercialCaseHandoffProject.service');

const ORG = 1005;
const CASE_ROW = {
    id: 10,
    company_id: 44,
    title: 'Tettoia capannone',
    commercial_customer_name: 'Cliente Nord',
    commercial_customer_id: 9,
};

function user(role, companyAccess = []) {
    return { user_id: 7, organization_id: ORG, role, company_access: companyAccess };
}

function installTx(route) {
    const state = { began: 0, committed: 0, rolled: 0, calls: [] };
    getPool.mockResolvedValue({});
    sql.Transaction.mockImplementation(() => ({
        begin: jest.fn(async () => { state.began += 1; }),
        commit: jest.fn(async () => { state.committed += 1; }),
        rollback: jest.fn(async () => { state.rolled += 1; }),
    }));
    sql.Request.mockImplementation(() => {
        const inputs = {};
        return {
            input(name, value) {
                inputs[name] = value;
                return this;
            },
            query: jest.fn(async (text) => {
                const snap = { ...inputs };
                state.calls.push({ sql: String(text), inputs: snap });
                return route(String(text), snap);
            }),
        };
    });
    return state;
}

function sqls(state) {
    return state.calls.map((c) => c.sql);
}

beforeEach(() => {
    query.mockReset();
    getPool.mockReset();
    sql.Transaction.mockReset();
    sql.Request.mockReset();
    query.mockResolvedValue({ recordset: [] });
});

describe('linkApprovedCaseToProject', () => {
    it('il viewer di studio non crea la commessa', async () => {
        const result = await linkApprovedCaseToProject({
            organizationId: ORG,
            user: user('viewer'),
            caseRow: CASE_ROW,
            handoffRef: 'COMM-1',
        });
        expect(result.ok).toBe(false);
        expect(result.status).toBe(403);
        expect(result.code).toBe('AUTH_FORBIDDEN');
        expect(query).not.toHaveBeenCalled();
        expect(getPool).not.toHaveBeenCalled();
    });

    it('il cliente in sola lettura sulla azienda non collega', async () => {
        const result = await linkApprovedCaseToProject({
            organizationId: ORG,
            user: user('auditor', [{ company_id: 44, permission: 'read' }]),
            caseRow: CASE_ROW,
            handoffRef: 'COMM-1',
        });
        expect(result.status).toBe(403);
        expect(getPool).not.toHaveBeenCalled();
    });

    it('elenco licenze senza Commesse blocca il collegamento', async () => {
        query.mockResolvedValueOnce({
            recordset: [{ licensed_modules: JSON.stringify(['ai_review', 'audit']) }],
        });
        const result = await linkApprovedCaseToProject({
            organizationId: ORG,
            user: user('auditor'),
            caseRow: CASE_ROW,
            handoffRef: 'COMM-1',
        });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('MODULE_NOT_LICENSED');
        expect(getPool).not.toHaveBeenCalled();
    });

    it('due passaggi dello stesso caso prendono il lock prima di creare la commessa', async () => {
        query.mockImplementation(async (text) => {
            if (String(text).includes('licensed_modules')) {
                return { recordset: [{ licensed_modules: '[]' }] };
            }
            return { recordset: [] };
        });
        const state = installTx((text) => {
            if (text.includes('sp_getapplock')) return { recordset: [{ lock_result: 0 }] };
            if (text.includes('FROM projects') && text.includes('commercial_case_id = @caseId')) {
                return { recordset: [] };
            }
            if (text.includes('project_code = @projectCode')) return { recordset: [] };
            if (text.includes('INSERT INTO projects')) {
                return { recordset: [{ id: 81, project_code: 'COMM-1', commercial_case_id: 10, company_id: 44 }] };
            }
            return { recordset: [] };
        });

        const result = await linkApprovedCaseToProject({
            organizationId: ORG,
            user: user('auditor'),
            caseRow: CASE_ROW,
            handoffRef: '  COMM-1  ',
        });

        expect(result).toMatchObject({ ok: true, action: 'created', project: { id: 81 } });
        expect(state.began).toBe(1);
        expect(state.committed).toBe(1);
        expect(state.rolled).toBe(0);
        const texts = sqls(state);
        const lockAt = texts.findIndex((s) => s.includes('sp_getapplock'));
        const insertAt = texts.findIndex((s) => s.includes('INSERT INTO projects'));
        expect(lockAt).toBeGreaterThanOrEqual(0);
        expect(insertAt).toBeGreaterThan(lockAt);
        expect(texts.some((s) => s.includes('UPDLOCK'))).toBe(true);
        const insert = state.calls.find((c) => c.sql.includes('INSERT INTO projects'));
        expect(insert.sql).toContain("'offerta'");
        expect(insert.inputs).toMatchObject({
            organizationId: ORG,
            companyId: 44,
            projectCode: 'COMM-1',
            clientName: 'Cliente Nord',
            endCustomerId: 9,
            description: 'Tettoia capannone',
            caseId: 10,
            userId: 7,
        });
    });

    it('se il lock non arriva non crea una seconda commessa', async () => {
        query.mockResolvedValue({ recordset: [{ licensed_modules: null }] });
        const state = installTx((text) => {
            if (text.includes('sp_getapplock')) return { recordset: [{ lock_result: -1 }] };
            if (text.includes('INSERT INTO projects')) {
                return { recordset: [{ id: 99 }] };
            }
            return { recordset: [] };
        });
        const result = await linkApprovedCaseToProject({
            organizationId: ORG,
            user: user('auditor'),
            caseRow: CASE_ROW,
            handoffRef: 'COMM-1',
        });
        expect(result).toMatchObject({ ok: false, status: 409, code: 'HANDOFF_BUSY' });
        expect(sqls(state).some((s) => s.includes('INSERT INTO projects'))).toBe(false);
        expect(state.committed).toBe(0);
        expect(state.rolled).toBe(1);
    });

    it('collega la commessa già presente con lo stesso codice e la stessa azienda', async () => {
        query.mockResolvedValue({ recordset: [{ licensed_modules: null }] });
        const state = installTx((text) => {
            if (text.includes('sp_getapplock')) return { recordset: [{ lock_result: 0 }] };
            if (text.includes('FROM projects') && text.includes('commercial_case_id = @caseId')) {
                return { recordset: [] };
            }
            if (text.includes('project_code = @projectCode')) {
                return { recordset: [{ id: 5, project_code: 'COMM-1', company_id: 44, commercial_case_id: null }] };
            }
            if (text.includes('UPDATE projects')) {
                return { recordset: [{ id: 5, project_code: 'COMM-1', commercial_case_id: 10, company_id: 44 }] };
            }
            return { recordset: [] };
        });

        const result = await linkApprovedCaseToProject({
            organizationId: ORG,
            user: user('auditor'),
            caseRow: CASE_ROW,
            handoffRef: 'COMM-1',
        });
        expect(result).toMatchObject({ ok: true, action: 'linked', project: { id: 5, commercial_case_id: 10 } });
        const texts = sqls(state);
        expect(texts.some((s) => s.includes('INSERT INTO projects'))).toBe(false);
        const update = texts.find((s) => s.includes('UPDATE projects'));
        expect(update).toContain('commercial_case_id = @caseId');
        expect(update).toContain('requirements_review_date');
        expect(state.committed).toBe(1);
    });

    it('non ruba una commessa già collegata a un altro caso', async () => {
        query.mockResolvedValue({ recordset: [] });
        const state = installTx((text) => {
            if (text.includes('sp_getapplock')) return { recordset: [{ lock_result: 0 }] };
            if (text.includes('FROM projects') && text.includes('commercial_case_id = @caseId')) {
                return { recordset: [] };
            }
            if (text.includes('project_code = @projectCode')) {
                return { recordset: [{ id: 5, project_code: 'COMM-1', company_id: 44, commercial_case_id: 99 }] };
            }
            return { recordset: [] };
        });
        const result = await linkApprovedCaseToProject({
            organizationId: ORG,
            user: user('auditor'),
            caseRow: CASE_ROW,
            handoffRef: 'COMM-1',
        });
        expect(result.code).toBe('PROJECT_ALREADY_LINKED');
        expect(sqls(state).some((s) => s.includes('UPDATE projects') || s.includes('INSERT INTO projects'))).toBe(false);
        expect(state.rolled).toBe(1);
    });

    it("non collega una commessa di un'altra azienda", async () => {
        query.mockResolvedValue({ recordset: [] });
        installTx((text) => {
            if (text.includes('sp_getapplock')) return { recordset: [{ lock_result: 0 }] };
            if (text.includes('FROM projects') && text.includes('commercial_case_id = @caseId')) {
                return { recordset: [] };
            }
            if (text.includes('project_code = @projectCode')) {
                return { recordset: [{ id: 5, project_code: 'COMM-1', company_id: 88, commercial_case_id: null }] };
            }
            return { recordset: [] };
        });
        const result = await linkApprovedCaseToProject({
            organizationId: ORG,
            user: user('auditor'),
            caseRow: CASE_ROW,
            handoffRef: 'COMM-1',
        });
        expect(result.code).toBe('PROJECT_COMPANY_MISMATCH');
    });

    it('se la commessa è già di questo caso non ne crea un’altra', async () => {
        query.mockResolvedValue({ recordset: [] });
        const state = installTx((text) => {
            if (text.includes('sp_getapplock')) return { recordset: [{ lock_result: 0 }] };
            if (text.includes('FROM projects') && text.includes('commercial_case_id = @caseId')) {
                return { recordset: [{ id: 5, project_code: 'COMM-1', company_id: 44, commercial_case_id: 10 }] };
            }
            return { recordset: [] };
        });
        const result = await linkApprovedCaseToProject({
            organizationId: ORG,
            user: user('auditor'),
            caseRow: CASE_ROW,
            handoffRef: 'COMM-ALTRO',
        });
        expect(result).toMatchObject({ ok: true, action: 'already_linked', project: { id: 5 } });
        expect(sqls(state).some((s) => s.includes('INSERT INTO projects'))).toBe(false);
        expect(state.committed).toBe(1);
    });
});
