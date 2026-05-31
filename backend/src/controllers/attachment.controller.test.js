/**
 * @jest-environment node
 *
 * Test L1 — attachment.controller RBAC studio (Slice C)
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
const ctrl = require('./attachment.controller');

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
    res.setHeader = jest.fn();
    return res;
}

afterEach(() => jest.clearAllMocks());

describe('listAttachments — RBAC studio', () => {
    it('applica studioScopeClause via join audit effettivo', async () => {
        query
            .mockResolvedValueOnce({ recordset: [] })
            .mockResolvedValueOnce({ recordset: [{ total: 0 }] });

        const req = mockReq({ query: { page: 1, limit: 50 } });
        const res = mockRes();
        await ctrl.listAttachments(req, res);

        const listSql = query.mock.calls[0][0];
        const listParams = query.mock.calls[0][1];
        expect(listSql).toContain('COALESCE(att.audit_id, nc.audit_id)');
        expect(listSql).toContain('auditor_org_id = @auditor_org_id');
        expect(listParams).toMatchObject({
            organization_id: ORG_ID,
            auditor_org_id: AUDITOR_ORG_ID,
            user_id: USER_ID,
        });
    });
});

describe('getAttachmentById — RBAC studio', () => {
    it('404 se allegato fuori scope studio', async () => {
        query.mockResolvedValueOnce({ recordset: [] });

        const req = mockReq({ params: { id: '99' } });
        const res = mockRes();
        await ctrl.getAttachmentById(req, res);

        const getSql = query.mock.calls[0][0];
        expect(getSql).toContain('auditor_org_id = @auditor_org_id');
        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe('uploadAttachment — RBAC studio', () => {
    it('rifiuta upload su audit fuori scope', async () => {
        query.mockResolvedValueOnce({ recordset: [] });

        const req = mockReq({
            file: { path: '/tmp/x.jpg', originalname: 'x.jpg', size: 100, mimetype: 'image/jpeg' },
            body: { audit_id: '555', category: 'photo' },
        });
        const res = mockRes();
        await ctrl.uploadAttachment(req, res);

        const auditSql = query.mock.calls[0][0];
        expect(auditSql).toContain('auditor_org_id = @auditor_org_id');
        expect(res.status).toHaveBeenCalledWith(404);
    });
});
