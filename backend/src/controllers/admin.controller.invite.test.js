/**
 * Test slice UAL-3 — admin.controller: modalità invito in createUser + resendUserInvite.
 * Verifica: (1) il flusso classico (password impostata dall'admin) resta invariato quando
 * send_invite non è passato; (2) la modalità invito non richiede password, genera un
 * placeholder e invia l'email; (3) resendUserInvite rispetta lo stato pending_activation.
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
const userInviteService = require('../services/userInvite.service');
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

describe('createUser — flusso classico (password impostata dall\'admin, invariato)', () => {
    it('rifiuta se manca la password quando send_invite non è passato', async () => {
        const req = mockReq({ body: { email: 'a@b.it', full_name: 'Mario Rossi' } });
        const res = mockRes();

        await ctrl.createUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false, code: 'VALIDATION_ERROR', error: expect.stringContaining('password'),
        }));
        expect(userInviteService.generatePlaceholderPasswordHash).not.toHaveBeenCalled();
        expect(userInviteService.sendInviteEmail).not.toHaveBeenCalled();
    });

    it('crea l\'utente con la password fornita, senza toccare il flusso invito', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // duplicate email check
        query.mockResolvedValueOnce({ recordset: [{ user_id: 50 }] }); // INSERT
        query.mockResolvedValueOnce({ recordset: [{ id: 1 }] }); // document tree già presente

        const req = mockReq({ body: { email: 'a@b.it', password: 'password123', full_name: 'Mario Rossi' } });
        const res = mockRes();

        await ctrl.createUser(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        const insertCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO users'));
        expect(insertCall[1]).toEqual(expect.objectContaining({ pending_activation: 0 }));
        expect(insertCall[1].password_hash).toMatch(/^\$2[aby]\$/); // bcrypt reale, non placeholder
        expect(userInviteService.generatePlaceholderPasswordHash).not.toHaveBeenCalled();
        expect(userInviteService.sendInviteEmail).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true, data: expect.objectContaining({ pending_activation: false }),
        }));
    });
});

describe('createUser — modalità invito (send_invite: true, UAL-3)', () => {
    it('rifiuta se manca full_name, ma NON richiede la password', async () => {
        const req = mockReq({ body: { email: 'a@b.it', send_invite: true } });
        const res = mockRes();

        await ctrl.createUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].error).not.toMatch(/password/i);
    });

    it('crea l\'utente pending, con hash placeholder, e invia l\'invito via email', async () => {
        userInviteService.generatePlaceholderPasswordHash.mockResolvedValueOnce('$2a$10$placeholderHashNeverMatches');
        userInviteService.sendInviteEmail.mockResolvedValueOnce({ sent: true });
        query.mockResolvedValueOnce({ recordset: [] }); // duplicate email check
        query.mockResolvedValueOnce({ recordset: [{ user_id: 60 }] }); // INSERT
        query.mockResolvedValueOnce({ recordset: [{ id: 1 }] }); // document tree già presente

        const req = mockReq({ body: { email: 'invitato@b.it', full_name: 'Nuovo Utente', send_invite: true } });
        const res = mockRes();

        await ctrl.createUser(req, res);

        expect(userInviteService.generatePlaceholderPasswordHash).toHaveBeenCalledTimes(1);
        const insertCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO users'));
        expect(insertCall[1]).toEqual(expect.objectContaining({
            password_hash: '$2a$10$placeholderHashNeverMatches',
            pending_activation: 1,
        }));
        expect(userInviteService.sendInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
            userId: 60, email: 'invitato@b.it', fullName: 'Nuovo Utente', organizationId: ORG_ID, actorUserId: ACTOR_ID,
        }));
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true, data: expect.objectContaining({ pending_activation: true }),
        }));
    });

    it('la creazione utente riesce comunque anche se l\'invio email fallisce (non bloccante)', async () => {
        userInviteService.generatePlaceholderPasswordHash.mockResolvedValueOnce('$2a$10$hash');
        userInviteService.sendInviteEmail.mockRejectedValueOnce(new Error('SMTP down'));
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [{ user_id: 61 }] });
        query.mockResolvedValueOnce({ recordset: [{ id: 1 }] });

        const req = mockReq({ body: { email: 'x@b.it', full_name: 'X Y', send_invite: true } });
        const res = mockRes();

        await ctrl.createUser(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
});

describe('resendUserInvite', () => {
    it('ritorna 404 se l\'utente non appartiene all\'organizzazione dell\'attore', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // resolveTargetUser
        const req = mockReq({ params: { id: '60' } });
        const res = mockRes();

        await ctrl.resendUserInvite(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('ritorna 400 NOT_PENDING se l\'utente ha già attivato l\'account', async () => {
        query.mockResolvedValueOnce({ recordset: [{ user_id: 60, organization_id: ORG_ID }] }); // resolveTargetUser
        query.mockResolvedValueOnce({ recordset: [{ email: 'a@b.it', full_name: 'X', pending_activation: 0, is_active: 1 }] });
        const req = mockReq({ params: { id: '60' } });
        const res = mockRes();

        await ctrl.resendUserInvite(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_PENDING' }));
        expect(userInviteService.sendInviteEmail).not.toHaveBeenCalled();
    });

    it('ritorna 400 USER_INACTIVE se l\'utente è disattivato', async () => {
        query.mockResolvedValueOnce({ recordset: [{ user_id: 60, organization_id: ORG_ID }] });
        query.mockResolvedValueOnce({ recordset: [{ email: 'a@b.it', full_name: 'X', pending_activation: 1, is_active: 0 }] });
        const req = mockReq({ params: { id: '60' } });
        const res = mockRes();

        await ctrl.resendUserInvite(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'USER_INACTIVE' }));
    });

    it('reinvia l\'invito per un utente pending e attivo', async () => {
        query.mockResolvedValueOnce({ recordset: [{ user_id: 60, organization_id: ORG_ID }] });
        query.mockResolvedValueOnce({ recordset: [{ email: 'a@b.it', full_name: 'X', pending_activation: 1, is_active: 1 }] });
        userInviteService.sendInviteEmail.mockResolvedValueOnce({ sent: true });

        const req = mockReq({ params: { id: '60' } });
        const res = mockRes();

        await ctrl.resendUserInvite(req, res);

        expect(userInviteService.sendInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
            userId: 60, email: 'a@b.it', fullName: 'X', organizationId: ORG_ID, actorUserId: ACTOR_ID, isResend: true,
        }));
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Invito reinviato' });
    });
});
