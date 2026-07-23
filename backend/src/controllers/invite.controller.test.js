/**
 * Test slice UAL-3 — invite.controller (endpoint pubblici accept-invite)
 */
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/userInvite.service', () => ({
    verifyInviteToken: jest.fn(),
    acceptInvite: jest.fn(),
    inviteErrorMessage: jest.fn((reason) => `errore leggibile: ${reason}`),
}));

const userInviteService = require('../services/userInvite.service');
const ctrl = require('./invite.controller');

function mockReq(overrides = {}) {
    return { params: {}, body: {}, ...overrides };
}
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

afterEach(() => jest.clearAllMocks());

describe('checkInviteToken', () => {
    it('ritorna 400 con messaggio leggibile per token non valido', async () => {
        userInviteService.verifyInviteToken.mockResolvedValueOnce({ valid: false, reason: 'TOKEN_EXPIRED' });
        const req = mockReq({ params: { token: 'abc' } });
        const res = mockRes();

        await ctrl.checkInviteToken(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false, code: 'TOKEN_EXPIRED', error: 'errore leggibile: TOKEN_EXPIRED',
        }));
    });

    it('ritorna i dati email/full_name per un token valido', async () => {
        userInviteService.verifyInviteToken.mockResolvedValueOnce({
            valid: true, userId: 10, email: 'a@b.it', fullName: 'Mario Rossi',
        });
        const req = mockReq({ params: { token: 'abc' } });
        const res = mockRes();

        await ctrl.checkInviteToken(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { email: 'a@b.it', full_name: 'Mario Rossi' },
        });
    });
});

describe('acceptInvite', () => {
    it('rifiuta se il token manca nel body', async () => {
        const req = mockReq({ body: { password: 'password123' } });
        const res = mockRes();

        await ctrl.acceptInvite(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, code: 'VALIDATION_ERROR' }));
        expect(userInviteService.acceptInvite).not.toHaveBeenCalled();
    });

    it('propaga l\'errore del service (es. token scaduto) con status 400', async () => {
        userInviteService.acceptInvite.mockResolvedValueOnce({
            success: false, error: 'Il link è scaduto.', code: 'TOKEN_EXPIRED',
        });
        const req = mockReq({ body: { token: 'abc', password: 'password123' } });
        const res = mockRes();

        await ctrl.acceptInvite(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Il link è scaduto.', code: 'TOKEN_EXPIRED' });
    });

    it('ritorna successo per un accept-invite valido', async () => {
        userInviteService.acceptInvite.mockResolvedValueOnce({ success: true, userId: 10 });
        const req = mockReq({ body: { token: 'abc', password: 'password123' } });
        const res = mockRes();

        await ctrl.acceptInvite(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
});
