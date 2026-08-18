/**
 * @jest-environment node
 *
 * Test L1  -  nc.controller (Slice 2+3)
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
    const baseUser = {
        organization_id: ORG_ID,
        user_id: USER_ID,
        role: 'auditor',
        auditor_org_id: AUDITOR_ORG_ID,
        // Evita query extra company_access nei test (assertMutatingAllowed)
        company_access: [],
    };
    const { user: userOverride, ...rest } = overrides;
    return {
        user: { ...baseUser, ...(userOverride || {}) },
        params: {},
        query: {},
        body: {},
        ...rest,
    };
}

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

afterEach(() => jest.clearAllMocks());

describe('listNonConformities  -  RBAC studio', () => {
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
        expect(listSql).toContain('LEFT JOIN projects');
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

describe('getNonConformitiesStatistics  -  RBAC studio', () => {
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

describe('updateNonConformity  -  root_cause', () => {
    it('persiste root_cause quando fornito', async () => {
        query
            .mockResolvedValueOnce({
                recordset: [{ nc_id: 5, current_status: 'open', verification_notes: null, approved_at: null, audit_id: 99 }],
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

describe('updateNonConformity - campi verifica NC', () => {
    it('persiste verification_notes e verification_responsible', async () => {
        query
            .mockResolvedValueOnce({
                recordset: [{ nc_id: 5, current_status: 'in_progress', verification_notes: null, approved_at: null, audit_id: 99 }],
            })
            .mockResolvedValueOnce({ recordset: [] })
            .mockResolvedValueOnce({ recordset: [] });

        const req = mockReq({
            params: { id: '5' },
            body: {
                verification_notes: 'Azioni efficaci verificate',
                verification_responsible: 'Luigi Verdi',
            },
        });
        const res = mockRes();
        await ctrl.updateNonConformity(req, res);

        const updateSql = query.mock.calls[1][0];
        const updateParams = query.mock.calls[1][1];
        expect(updateSql).toContain('verification_notes = @verification_notes');
        expect(updateSql).toContain('verification_responsible = @verification_responsible');
        expect(updateParams.verification_notes).toBe('Azioni efficaci verificate');
        expect(updateParams.verification_responsible).toBe('Luigi Verdi');
    });
});

describe('createNonConformity  -  source_type manual', () => {
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

    it('verifica audit_id in scope prima dell INSERT', async () => {
        query.mockResolvedValueOnce({ recordset: [] });

        const req = mockReq({
            body: {
                audit_id: 99,
                nc_number: 'NC-SCOPE-001',
                section_code: '4.1',
                description: 'NC fuori scope',
                severity: 'minor',
            },
        });
        const res = mockRes();
        await ctrl.createNonConformity(req, res);

        const auditCheckSql = query.mock.calls[0][0];
        expect(auditCheckSql).toContain('auditor_org_id = @auditor_org_id');
        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe('listNcResponsibleOptionsHandler', () => {
    it('ritorna 400 se manca company_id', async () => {
        const req = mockReq({ query: { scope: 'attuazione' } });
        const res = mockRes();
        await ctrl.listNcResponsibleOptionsHandler(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'MISSING_COMPANY_ID' }),
        );
    });

    it('ritorna 400 se scope non valido', async () => {
        const req = mockReq({ query: { company_id: '11', scope: 'invalid' } });
        const res = mockRes();
        await ctrl.listNcResponsibleOptionsHandler(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'INVALID_SCOPE' }),
        );
    });
});

describe('deleteNonConformity  -  RBAC studio', () => {
    it('applica studioScopeClause nella verifica pre-delete', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ nc_id: 5, audit_id: 99 }] })
            .mockResolvedValueOnce({ recordset: [] })
            .mockResolvedValueOnce({ recordset: [] });

        const req = mockReq({ params: { id: '5' } });
        const res = mockRes();
        await ctrl.deleteNonConformity(req, res);

        const checkSql = query.mock.calls[0][0];
        expect(checkSql).toContain('auditor_org_id = @auditor_org_id');
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true }),
        );
    });
});

describe('updateNonConformity  -  gate chiusura semplificata', () => {
    it('closed senza valutazione AC ritorna 400 CORRECTIVE_ACTION_EVALUATION_REQUIRED', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                nc_id: 5,
                current_status: 'open',
                verification_notes: 'OK',
                approved_at: null,
                audit_id: 99,
                corrective_action_needed: null,
                corrective_action_evaluation_notes: null,
                root_cause: null,
                verification_contact_id: 3,
            }],
        });

        const req = mockReq({
            params: { id: '5' },
            body: { status: 'closed' },
        });
        const res = mockRes();
        await ctrl.updateNonConformity(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'CORRECTIVE_ACTION_EVALUATION_REQUIRED' }),
        );
    });

    it('closed senza responsabile verifica ritorna 400 VERIFICATION_RESPONSIBLE_REQUIRED', async () => {
        query
            .mockResolvedValueOnce({
                recordset: [{
                    nc_id: 5,
                    current_status: 'open',
                    verification_notes: 'OK',
                    approved_at: null,
                    audit_id: 99,
                    corrective_action_needed: 'no',
                    corrective_action_evaluation_notes: 'Isolata',
                    root_cause: null,
                    verification_contact_id: null,
                }],
            })
            .mockResolvedValueOnce({ recordset: [{ cnt: 1 }] });

        const req = mockReq({
            params: { id: '5' },
            body: { status: 'closed' },
        });
        const res = mockRes();
        await ctrl.updateNonConformity(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'VERIFICATION_RESPONSIBLE_REQUIRED' }),
        );
    });
});

describe('updateNonConformity  -  riapertura NC chiusa', () => {
    it('admin pu\u00f2 riaprire closed \u2192 open e revoca approvazione legacy', async () => {
        query
            .mockResolvedValueOnce({
                recordset: [{
                    nc_id: 5,
                    current_status: 'closed',
                    verification_notes: 'Verifica OK',
                    approved_at: '2026-05-01',
                    audit_id: 99,
                    corrective_action_needed: 'no',
                    corrective_action_evaluation_notes: 'x',
                    root_cause: null,
                    verification_contact_id: 1,
                }],
            })
            .mockResolvedValueOnce({ recordset: [] })
            .mockResolvedValueOnce({ recordset: [] });

        const req = mockReq({
            params: { id: '5' },
            user: { role: 'admin', organization_id: ORG_ID, user_id: USER_ID, auditor_org_id: null },
            body: { status: 'open', reopen_reason: 'Nuova evidenza' },
        });
        const res = mockRes();
        await ctrl.updateNonConformity(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true }),
        );
        const updateSql = query.mock.calls[1][0];
        expect(updateSql).toContain('approved_at = NULL');
        expect(updateSql).toContain('verification_notes = @reopen_verification_notes');
        expect(query.mock.calls[1][1].reopen_verification_notes).toMatch(/Riapertura/);
        expect(query.mock.calls[1][1].reopen_verification_notes).toMatch(/Nuova evidenza/);
    });

    it('auditor non pu\u00f2 riaprire NC chiusa', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                nc_id: 5,
                current_status: 'closed',
                verification_notes: 'Verifica OK',
                approved_at: '2026-05-01',
                audit_id: 99,
                corrective_action_needed: 'no',
                corrective_action_evaluation_notes: 'x',
                root_cause: null,
                verification_contact_id: 1,
            }],
        });

        const req = mockReq({
            params: { id: '5' },
            body: { status: 'open' },
        });
        const res = mockRes();
        await ctrl.updateNonConformity(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'NC_REOPEN_FORBIDDEN' }),
        );
    });
});

describe('approveNcClosure (endpoint legacy, flusso UI usa Chiudi diretto)', () => {
    it('auditor non pu\u00f2 approvare', async () => {
        const req = mockReq({ params: { id: '5' }, user: { role: 'auditor' } });
        const res = mockRes();
        await ctrl.approveNcClosure(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('admin pu\u00f2 ancora approvare NC verified (compat)', async () => {
        query
            .mockResolvedValueOnce({
                recordset: [{ nc_id: 5, status: 'verified', approved_at: null }],
            })
            .mockResolvedValueOnce({ recordset: [] });

        const req = mockReq({
            params: { id: '5' },
            user: { role: 'admin', auditor_org_id: null },
        });
        const res = mockRes();
        await ctrl.approveNcClosure(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, nc_id: 5 }),
        );
    });
});

describe('resolveNcProjectId  -  ISO-6', () => {
    it('skip se project_id assente', async () => {
        const r = await ctrl.resolveNcProjectId({
            organizationId: ORG_ID, projectId: undefined, companyId: 7,
        });
        expect(r).toEqual({ skip: true });
        expect(query).not.toHaveBeenCalled();
    });

    it('null se stringa vuota (scollega commessa)', async () => {
        const r = await ctrl.resolveNcProjectId({
            organizationId: ORG_ID, projectId: '', companyId: 7,
        });
        expect(r).toEqual({ value: null });
        expect(query).not.toHaveBeenCalled();
    });

    it('404 se la commessa non è in organizzazione', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        const r = await ctrl.resolveNcProjectId({
            organizationId: ORG_ID, projectId: 12, companyId: 7,
        });
        expect(r).toMatchObject({ code: 'PROJECT_NOT_FOUND', status: 404 });
    });

    it('400 se la commessa è di un\'altra azienda', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 12, company_id: 99 }] });
        const r = await ctrl.resolveNcProjectId({
            organizationId: ORG_ID, projectId: 12, companyId: 7,
        });
        expect(r).toMatchObject({ code: 'PROJECT_COMPANY_MISMATCH', status: 400 });
    });

    it('accetta la commessa della stessa azienda', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 12, company_id: 7 }] });
        const r = await ctrl.resolveNcProjectId({
            organizationId: ORG_ID, projectId: '12', companyId: 7,
        });
        expect(r).toEqual({ value: 12 });
    });
});

describe('createNonConformity  -  project_id opzionale', () => {
    it('inserisce project_id se la commessa è dell\'azienda audit', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ audit_id: 99, company_id: 7 }] })
            .mockResolvedValueOnce({ recordset: [{ standard_id: 1 }] })
            .mockResolvedValueOnce({ recordset: [{ id: 12, company_id: 7 }] })
            .mockResolvedValueOnce({ recordset: [] })
            .mockResolvedValueOnce({ recordset: [{ nc_id: 1, nc_uuid: 'uuid-1' }] })
            .mockResolvedValueOnce({ recordset: [] });

        const req = mockReq({
            body: {
                audit_id: 99,
                nc_number: 'NC-PROJ-001',
                section_code: '4.1',
                description: 'NC con commessa',
                severity: 'minor',
                project_id: 12,
            },
        });
        const res = mockRes();
        await ctrl.createNonConformity(req, res);

        const insertSql = query.mock.calls[4][0];
        const insertParams = query.mock.calls[4][1];
        expect(insertSql).toContain('project_id');
        expect(insertParams.project_id).toBe(12);
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('400 se la commessa non è dell\'azienda audit', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ audit_id: 99, company_id: 7 }] })
            .mockResolvedValueOnce({ recordset: [{ standard_id: 1 }] })
            .mockResolvedValueOnce({ recordset: [{ id: 12, company_id: 99 }] });

        const req = mockReq({
            body: {
                audit_id: 99,
                nc_number: 'NC-PROJ-002',
                section_code: '4.1',
                description: 'NC mismatch',
                severity: 'minor',
                project_id: 12,
            },
        });
        const res = mockRes();
        await ctrl.createNonConformity(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'PROJECT_COMPANY_MISMATCH' }),
        );
    });
});
