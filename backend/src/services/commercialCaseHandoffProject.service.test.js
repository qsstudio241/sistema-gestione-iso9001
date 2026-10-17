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
    debug: jest.fn(),
}));

const { query } = require('../config/database');
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

function sqlOf(call) {
    return String(call[0]);
}

beforeEach(() => {
    query.mockReset();
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
    });

    it('il cliente in sola lettura sulla azienda non collega', async () => {
        const result = await linkApprovedCaseToProject({
            organizationId: ORG,
            user: user('auditor', [{ company_id: 44, permission: 'read' }]),
            caseRow: CASE_ROW,
            handoffRef: 'COMM-1',
        });
        expect(result.status).toBe(403);
        expect(query).not.toHaveBeenCalled();
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
        expect(query).toHaveBeenCalledTimes(1);
    });

    it('licenza vuota vale come tutti i moduli e crea la commessa', async () => {
        query.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('licensed_modules')) {
                return { recordset: [{ licensed_modules: '[]' }] };
            }
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
        const insert = query.mock.calls.map(sqlOf).find((s) => s.includes('INSERT INTO projects'));
        expect(insert).toContain('status, requirements_review_date');
        expect(insert).toContain("'offerta'");
        expect(insert).toContain('commercial_case_id');
        expect(query.mock.calls.map(sqlOf).some((s) => s.includes('deleted_at IS NULL'))).toBe(true);
        const insertParams = query.mock.calls.find((c) => String(c[0]).includes('INSERT INTO projects'))[1];
        expect(insertParams).toMatchObject({
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

    it('collega la commessa già presente con lo stesso codice e la stessa azienda', async () => {
        query.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('licensed_modules')) return { recordset: [{ licensed_modules: null }] };
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
        expect(query.mock.calls.map(sqlOf).some((s) => s.includes('INSERT INTO projects'))).toBe(false);
        const update = query.mock.calls.map(sqlOf).find((s) => s.includes('UPDATE projects'));
        expect(update).toContain('commercial_case_id = @caseId');
        expect(update).toContain('requirements_review_date');
    });

    it('non ruba una commessa già collegata a un altro caso', async () => {
        query.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('licensed_modules')) return { recordset: [] };
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
        expect(query.mock.calls.map(sqlOf).some((s) => s.includes('UPDATE projects') || s.includes('INSERT INTO projects'))).toBe(false);
    });

    it("non collega una commessa di un'altra azienda", async () => {
        query.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('licensed_modules')) return { recordset: [] };
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
        query.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('licensed_modules')) return { recordset: [] };
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
        expect(query.mock.calls.map(sqlOf).some((s) => s.includes('INSERT INTO projects'))).toBe(false);
    });
});
