jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));
jest.mock('../services/auditMaintenance.service', () => ({ hardDeleteAudit: jest.fn() }));
jest.mock('./auth.controller', () => ({ getAllowedStandardIds: jest.fn() }));
jest.mock('../services/auditNumberAllocation.service', () => ({ allocateAuditReportNumber: jest.fn() }));
jest.mock('../services/auditListRbac.service', () => ({
    studioScopeClause: jest.fn(),
    appendScopeSql: jest.fn(),
}));
jest.mock('../services/companyAccess.service', () => ({
    assertMutatingAllowed: jest.fn(),
    sendAccessDenied: jest.fn(),
}));
jest.mock('../services/auditLock.service', () => ({ resolveAuditForUser: jest.fn() }));
jest.mock('../utils/auditDateRange', () => ({
    validateAuditDateRange: jest.fn(() => ({ valid: true, audit_date: '2026-10-23', audit_date_end: null })),
}));

const { query } = require('../config/database');
const { resolveAuditForUser } = require('../services/auditLock.service');
const { upsertAudit } = require('./audit.controller');

function mockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

describe('upsertAudit status_only', () => {
    beforeEach(() => {
        query.mockReset();
        resolveAuditForUser.mockReset();
        resolveAuditForUser.mockResolvedValue({ audit_id: 9 });
    });

    it('aggiorna solo lo stato e non la scheda', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ audit_id: 9, status: 'draft' }] })
            .mockResolvedValueOnce({ recordset: [{ updated_at: '2026-10-23T18:00:00.000Z' }] });
        const res = mockRes();
        await upsertAudit({
            user: { organization_id: 4, user_id: 1 },
            body: { audit_uuid: 'abc', status: 'in_progress', status_only: true },
        }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.data.action).toBe('updated');
        expect(res.body.data.status).toBe('in_progress');
        const sql = query.mock.calls[1][0];
        expect(sql).toContain('SET status = @status');
        expect(sql).not.toContain('client_name');
        expect(sql).not.toContain('notes');
        expect(sql).not.toContain('audit_extra_data');
        expect(query.mock.calls[1][1]).toEqual({
            status: 'in_progress',
            audit_id: 9,
            organization_id: 4,
        });
    });

    it('lo stesso stato non riscrive la riga', async () => {
        query.mockResolvedValueOnce({ recordset: [{ audit_id: 9, status: 'in_progress' }] });
        const res = mockRes();
        await upsertAudit({
            user: { organization_id: 4, user_id: 1 },
            body: { audit_uuid: 'abc', status: 'in_progress', status_only: true },
        }, res);
        expect(res.body.data.action).toBe('unchanged');
        expect(query).toHaveBeenCalledTimes(1);
    });
});
