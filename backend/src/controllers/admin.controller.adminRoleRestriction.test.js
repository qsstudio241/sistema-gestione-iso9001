/**
 * Test L1 — admin.controller: il ruolo 'admin' non si crea/promuove più da
 * createUser/updateUser (richiesta committente 12/08/2026: "la creazione di
 * un nuovo utente non può assumere il ruolo di admin dello studio perché può
 * essere definito o modificato solo nella sezione di gestione degli studi").
 *
 * Unica fonte di verità per l'assegnazione del ruolo admin:
 * auditorOrg.controller.js::inviteFirstStudioAdmin ("Licenze moduli per
 * studio" → "+ Invita admin"). Prima, isElevatedAdmin(reqUser) permetteva a
 * QUALSIASI admin (anche uno scoped a un singolo studio, nonostante il testo
 * mostrato in UI suggerisse "solo l'amministratore principale") di creare o
 * promuovere altri admin da questi due endpoint generici.
 */
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/userAudit.service', () => ({ logUserAuditEvent: jest.fn() }));
jest.mock('../services/userInvite.service', () => ({
    generatePlaceholderPasswordHash: jest.fn(),
    sendInviteEmail: jest.fn(),
}));

const { query } = require('../config/database');
const ctrl = require('./admin.controller');

const ORG_ID = 1001;
const ACTOR_ID = 5;

function mockReq(overrides = {}) {
    return {
        params: {}, query: {}, body: {},
        ...overrides,
        user: { organization_id: ORG_ID, user_id: ACTOR_ID, role: 'admin', ...(overrides.user || {}) },
    };
}
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

afterEach(() => jest.clearAllMocks());

describe('createUser — role=admin sempre rifiutato (solo via invite-admin dedicato)', () => {
    it('403 se un admin (org-wide, elevatedAdmin di prima) tenta di creare un utente con role=admin', async () => {
        const req = mockReq({
            user: { role: 'admin', organization_id: ORG_ID, user_id: ACTOR_ID, auditor_org_id: null },
            body: { email: 'nuovo@b.it', password: 'password123', full_name: 'Nuovo Admin', role: 'admin' },
        });
        const res = mockRes();
        await ctrl.createUser(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_FORBIDDEN' }));
        expect(query).not.toHaveBeenCalled();
    });

    it('403 anche se l\'attore è superadmin (nessuna eccezione: unica fonte di verità è invite-admin)', async () => {
        const req = mockReq({
            user: { role: 'superadmin', organization_id: ORG_ID, user_id: ACTOR_ID },
            body: { email: 'nuovo@b.it', password: 'password123', full_name: 'Nuovo Admin', role: 'admin' },
        });
        const res = mockRes();
        await ctrl.createUser(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_FORBIDDEN' }));
    });

    it('201 invariato per role=auditor/viewer (comportamento non toccato)', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // duplicate check
        query.mockResolvedValueOnce({ recordset: [{ user_id: 50 }] }); // INSERT
        query.mockResolvedValueOnce({ recordset: [{ id: 1 }] }); // document tree già presente

        const req = mockReq({ body: { email: 'nuovo@b.it', password: 'password123', full_name: 'Mario Rossi', role: 'auditor' } });
        const res = mockRes();
        await ctrl.createUser(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
    });
});

describe('updateUser — promozione a role=admin sempre rifiutata (solo via invite-admin dedicato)', () => {
    it('403 se si tenta di promuovere un auditor a admin, anche da parte di un admin org-wide', async () => {
        query.mockResolvedValueOnce({ recordset: [{
            user_id: 60, role: 'auditor', is_active: true, organization_id: ORG_ID, full_name: 'Mario Rossi', auditor_org_id: 10,
        }] }); // userCheck

        const req = mockReq({
            params: { id: '60' },
            user: { role: 'admin', organization_id: ORG_ID, user_id: ACTOR_ID, auditor_org_id: null },
            body: { role: 'admin' },
        });
        const res = mockRes();
        await ctrl.updateUser(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_FORBIDDEN' }));
    });

    it('403 anche se l\'attore è superadmin (nessuna eccezione)', async () => {
        query.mockResolvedValueOnce({ recordset: [{
            user_id: 60, role: 'viewer', is_active: true, organization_id: ORG_ID, full_name: 'Mario Rossi', auditor_org_id: null,
        }] });

        const req = mockReq({
            params: { id: '60' },
            user: { role: 'superadmin', organization_id: ORG_ID, user_id: ACTOR_ID },
            body: { role: 'admin' },
        });
        const res = mockRes();
        await ctrl.updateUser(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('200 se si demota un admin esistente ad auditor (direzione permessa)', async () => {
        query.mockResolvedValueOnce({ recordset: [{
            user_id: 61, role: 'admin', is_active: true, organization_id: ORG_ID, full_name: 'Ex Admin', auditor_org_id: null,
        }] }); // userCheck
        query.mockResolvedValueOnce({ recordset: [{ c: 2 }] }); // countActiveAdminsInOrg (>1, non è l'ultimo admin)
        query.mockResolvedValueOnce({ recordset: [] }); // UPDATE

        const req = mockReq({
            params: { id: '61' },
            user: { role: 'admin', organization_id: ORG_ID, user_id: ACTOR_ID, auditor_org_id: null },
            body: { role: 'auditor' },
        });
        const res = mockRes();
        await ctrl.updateUser(req, res);

        expect(res.status).not.toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('200 se si aggiorna un admin esistente senza cambiare il ruolo (no-op sul ruolo, nessuna regressione)', async () => {
        query.mockResolvedValueOnce({ recordset: [{
            user_id: 62, role: 'admin', is_active: true, organization_id: ORG_ID, full_name: 'Admin Esistente', auditor_org_id: null,
        }] }); // userCheck
        query.mockResolvedValueOnce({ recordset: [] }); // UPDATE

        const req = mockReq({
            params: { id: '62' },
            user: { role: 'admin', organization_id: ORG_ID, user_id: ACTOR_ID, auditor_org_id: null },
            body: { role: 'admin', full_name: 'Admin Esistente Rinominato' },
        });
        const res = mockRes();
        await ctrl.updateUser(req, res);

        expect(res.status).not.toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
});
