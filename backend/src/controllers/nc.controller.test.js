/**
 * @jest-environment node
 *
 * Test L1 — nc.controller (Slice 2+3)
 * Copre: root_cause in update, source_type manual in create, studioScopeClause su list/stats
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
const ctrl = require('./nc.controller');

const ORG_ID = 1001;
const USER_ID = 42;
const AUDITOR_ORG_ID = 10;

function mockReq(overrides = {}) {
    return {
        user: {
            organization_id: ORG_ID,
            user_id: USER_ID,
            role: 'auditor',
            auditor_org_id: AUDITOR_ORG_ID,
        },
        params: {},
        query: {},
        body: {},
        ...overrides,
    };
}

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

afterEach(() => jest.clearAllMocks());

describe('listNonConformities — RBAC studio', () => {
    it('applica studioScopeClause per auditor con studio', async () => {
        query
            .mockResolvedValueOnce({ recordset: [] })
            .mockResolvedValueOnce({ recordset: [{ total: 0 }] });

        const req = mockReq({ query: { page: 1, limit: 50 } });
        const res = mockRes();
        await ctrl.listNonConformities(req, res);

        const listSql = query.mock.calls[0][0];
        const listParams = query.mock.calls[0][1];
        expect(listSql).toContain('auditor_org_id = @auditor_org_id');
        expect(listParams).toMatchObject({
            organization_id: ORG_ID,
            auditor_org_id: AUDITOR_ORG_ID,
            user_id: USER_ID,
        });
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, data: [] }),
        );
    });

    it('applica filtro due_within_days nelle condizioni WHERE', async () => {
        query
            .mockResolvedValueOnce({ recordset: [] })
            .mockResolvedValueOnce({ recordset: [{ total: 0 }] });

        const req = mockReq({ query: { page: 1, limit: 50, due_within_days: '7' } });
        const res = mockRes();
        await ctrl.listNonConformities(req, res);

        const listSql = query.mock.calls[0][0];
        expect(listSql).toContain('DATEADD(day, 7');
        expect(listSql).toContain('nc.due_date >= CAST(GETDATE() AS DATE)');
    });
});

describe('getNonConformitiesStatistics — RBAC studio', () => {
    it('applica studioScopeClause nelle statistiche', async () => {
        query.mockResolvedValueOnce({
            recordset: [{ total: 0, open: 0, major: 0 }],
        });

        const req = mockReq();
        const res = mockRes();
        await ctrl.getNonConformitiesStatistics(req, res);

        const statsSql = query.mock.calls[0][0];
        expect(statsSql).toContain('auditor_org_id = @auditor_org_id');
        expect(query.mock.calls[0][1]).toMatchObject({
            organization_id: ORG_ID,
            auditor_org_id: AUDITOR_ORG_ID,
        });
    });
});

describe('updateNonConformity — root_cause', () => {
    it('persiste root_cause quando fornito', async () => {
        query
            .mockResolvedValueOnce({
                recordset: [{ nc_id: 5, current_status: 'open', audit_id: 99 }],
            })
            .mockResolvedValueOnce({ recordset: [] })
            .mockResolvedValueOnce({ recordset: [] });

        const req = mockReq({
            params: { id: '5' },
            body: { root_cause: 'Mancata formazione operatori' },
        });
        const res = mockRes();
        await ctrl.updateNonConformity(req, res);

        const updateSql = query.mock.calls[1][0];
        const updateParams = query.mock.calls[1][1];
        expect(updateSql).toContain('root_cause = @root_cause');
        expect(updateParams.root_cause).toBe('Mancata formazione operatori');
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true }),
        );
    });
});

describe('createNonConformity — source_type manual', () => {
    it('imposta source_type manual nella INSERT', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ audit_id: 99 }] })
            .mockResolvedValueOnce({ recordset: [{ standard_id: 1 }] })
            .mockResolvedValueOnce({ recordset: [] })
            .mockResolvedValueOnce({ recordset: [{ nc_id: 1, nc_uuid: 'uuid-1' }] })
            .mockResolvedValueOnce({ recordset: [] });

        const req = mockReq({
            body: {
                audit_id: 99,
                nc_number: 'NC-TEST-001',
                section_code: '4.1',
                description: 'NC di test',
                severity: 'minor',
            },
        });
        const res = mockRes();
        await ctrl.createNonConformity(req, res);

        const insertSql = query.mock.calls[3][0];
        expect(insertSql).toContain('source_type');
        expect(insertSql).toContain("'manual'");
        expect(res.status).toHaveBeenCalledWith(201);
    });
});
