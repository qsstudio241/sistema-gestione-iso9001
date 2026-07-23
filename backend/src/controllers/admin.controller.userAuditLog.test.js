/**
 * Test slice UAL-2 — audit trail gestione utenti.
 * Verifica che le operazioni CRUD esistenti (createUser, deactivateUser) scrivano
 * un evento in user_audit_log tramite userAudit.service (reale, non mockato, per
 * verificare l'integrazione end-to-end sulla stessa connessione `query` mockata),
 * e soprattutto che l'operazione principale riesca comunque se il log fallisce.
 * Verifica anche il nuovo endpoint di sola lettura GET /admin/users/:id/audit-log.
 */
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/documentTreeProvisioner.service', () => ({
    provisionTree: jest.fn(),
}));
jest.mock('../services/billing.service', () => ({
    onLicensesUpdated: jest.fn(),
}));

const { query } = require('../config/database');
const logger = require('../utils/logger');
const ctrl = require('./admin.controller');

const ORG_ID = 1001;
const ACTOR_ID = 5;

function mockReq(overrides = {}) {
    return {
        params: {},
        query: {},
        body: {},
        ...overrides,
        user: {
            organization_id: ORG_ID,
            user_id: ACTOR_ID,
            role: 'admin',
            ...(overrides.user || {}),
        },
    };
}

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

afterEach(() => jest.clearAllMocks());

describe('createUser — audit trail (user_created)', () => {
    it('scrive un evento user_created in user_audit_log dopo la creazione', async () => {
        query
            .mockResolvedValueOnce({ recordset: [] }) // email non duplicata
            .mockResolvedValueOnce({ recordset: [{ user_id: 42 }] }) // INSERT users
            .mockResolvedValueOnce({ recordset: [] }) // INSERT user_audit_log (dal service)
            .mockResolvedValueOnce({ recordset: [{ id: 1 }] }); // rootCheck: albero già esiste, skip provisioning

        const req = mockReq({
            body: { email: 'nuovo@test.it', password: 'password123', full_name: 'Nuovo Utente', role: 'auditor' },
        });
        const res = mockRes();

        await ctrl.createUser(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        const auditLogCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO user_audit_log'));
        expect(auditLogCall).toBeDefined();
        const [, params] = auditLogCall;
        expect(params).toEqual(expect.objectContaining({
            organization_id: ORG_ID,
            target_user_id: 42,
            actor_user_id: ACTOR_ID,
            action_type: 'user_created',
        }));
    });

    it('REGOLA VINCOLANTE: se la scrittura del log fallisce, la creazione utente riesce comunque (201)', async () => {
        query
            .mockResolvedValueOnce({ recordset: [] }) // email non duplicata
            .mockResolvedValueOnce({ recordset: [{ user_id: 43 }] }) // INSERT users
            .mockRejectedValueOnce(new Error('DB down')) // INSERT user_audit_log fallisce
            .mockResolvedValueOnce({ recordset: [{ id: 1 }] }); // rootCheck

        const req = mockReq({
            body: { email: 'nuovo2@test.it', password: 'password123', full_name: 'Altro Utente', role: 'auditor' },
        });
        const res = mockRes();

        await ctrl.createUser(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, data: expect.objectContaining({ user_id: 43 }) })
        );
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Scrittura log fallita'),
            expect.anything(),
        );
    });
});

describe('deactivateUser — audit trail (deactivated)', () => {
    it('scrive un evento deactivated dopo la disattivazione', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ user_id: 42, is_active: 1, organization_id: ORG_ID }] }) // userCheck
            .mockResolvedValueOnce({ recordset: [] }) // userIsAdminRole (role select)
            .mockResolvedValueOnce({ recordset: [] }) // UPDATE users SET is_active = 0
            .mockResolvedValueOnce({ recordset: [] }); // INSERT user_audit_log

        const req = mockReq({ params: { id: '42' } });
        const res = mockRes();

        await ctrl.deactivateUser(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        const auditLogCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO user_audit_log'));
        expect(auditLogCall).toBeDefined();
        expect(auditLogCall[1]).toEqual(expect.objectContaining({ action_type: 'deactivated', target_user_id: 42 }));
    });

    it('REGOLA VINCOLANTE: se il log fallisce, la disattivazione utente riesce comunque', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ user_id: 42, is_active: 1, organization_id: ORG_ID }] })
            .mockResolvedValueOnce({ recordset: [] })
            .mockResolvedValueOnce({ recordset: [] })
            .mockRejectedValueOnce(new Error('DB down'));

        const req = mockReq({ params: { id: '42' } });
        const res = mockRes();

        await ctrl.deactivateUser(req, res);

        expect(res.status).not.toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'Utente disattivato' }));
    });
});

describe('getUserAuditLog (GET /admin/users/:id/audit-log)', () => {
    it('ritorna 404 se l\'utente target non appartiene all\'organizzazione dell\'attore', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // resolveTargetUser: nessun match
        const req = mockReq({ params: { id: '42' } });
        const res = mockRes();

        await ctrl.getUserAuditLog(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('ritorna lo storico in ordine cronologico inverso per un utente valido', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ user_id: 42, organization_id: ORG_ID }] }) // resolveTargetUser
            .mockResolvedValueOnce({
                recordset: [
                    { id: 2, action_type: 'deactivated', created_at: '2026-07-23T10:00:00Z', actor_name: 'Admin Uno' },
                    { id: 1, action_type: 'user_created', created_at: '2026-07-01T10:00:00Z', actor_name: 'Admin Uno' },
                ],
            }); // SELECT user_audit_log

        const req = mockReq({ params: { id: '42' } });
        const res = mockRes();

        await ctrl.getUserAuditLog(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: [
                expect.objectContaining({ action_type: 'deactivated' }),
                expect.objectContaining({ action_type: 'user_created' }),
            ],
        }));
        const selectSql = query.mock.calls[1][0];
        expect(selectSql).toContain('ORDER BY ual.created_at DESC');
    });
});
