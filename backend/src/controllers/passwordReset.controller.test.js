/**
 * Test slice UAL-4 — passwordReset.controller (endpoint pubblici forgot/reset password)
 *
 * Verifica in particolare la protezione anti user-enumeration a livello HTTP:
 * la risposta di POST /auth/forgot-password deve essere IDENTICA (stesso status,
 * stesso body) per un'email esistente e per una inesistente.
 */
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/userPasswordReset.service', () => ({
    requestPasswordReset: jest.fn(),
    verifyResetToken: jest.fn(),
    resetPassword: jest.fn(),
    resetErrorMessage: jest.fn((reason) => `errore leggibile: ${reason}`),
}));

const userPasswordResetService = require('../services/userPasswordReset.service');
const ctrl = require('./passwordReset.controller');

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

describe('forgotPassword — anti user-enumeration', () => {
    it('risponde con successo generico per un\'email esistente', async () => {
        userPasswordResetService.requestPasswordReset.mockResolvedValueOnce(undefined);
        const req = mockReq({ body: { email: 'esiste@test.it' } });
        const res = mockRes();

        await ctrl.forgotPassword(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: 'Se l\'indirizzo è registrato, riceverai un\'email con le istruzioni per reimpostare la password.',
        });
        expect(userPasswordResetService.requestPasswordReset).toHaveBeenCalledWith('esiste@test.it');
    });

    it('risponde con lo STESSO messaggio (identico status e body) per un\'email inesistente', async () => {
        userPasswordResetService.requestPasswordReset.mockResolvedValueOnce(undefined);
        const reqEsistente = mockReq({ body: { email: 'esiste@test.it' } });
        const resEsistente = mockRes();
        await ctrl.forgotPassword(reqEsistente, resEsistente);

        const reqInesistente = mockReq({ body: { email: 'nonesiste@test.it' } });
        const resInesistente = mockRes();
        await ctrl.forgotPassword(reqInesistente, resInesistente);

        // Confronto esplicito: stesso status (nessuno, cioè 200 di default) e stesso body.
        expect(resEsistente.status).not.toHaveBeenCalled();
        expect(resInesistente.status).not.toHaveBeenCalled();
        expect(resEsistente.json.mock.calls[0]).toEqual(resInesistente.json.mock.calls[0]);
    });

    it('risponde con lo stesso messaggio generico anche se il service lancia un errore interno', async () => {
        userPasswordResetService.requestPasswordReset.mockRejectedValueOnce(new Error('DB down'));
        const req = mockReq({ body: { email: 'qualsiasi@test.it' } });
        const res = mockRes();

        await ctrl.forgotPassword(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('risponde con lo stesso messaggio generico anche senza email nel body (nessuna validazione visibile)', async () => {
        const req = mockReq({ body: {} });
        const res = mockRes();

        await ctrl.forgotPassword(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        expect(userPasswordResetService.requestPasswordReset).not.toHaveBeenCalled();
    });
});

describe('checkResetToken', () => {
    it('ritorna 400 con messaggio leggibile per token non valido', async () => {
        userPasswordResetService.verifyResetToken.mockResolvedValueOnce({ valid: false, reason: 'TOKEN_EXPIRED' });
        const req = mockReq({ params: { token: 'abc' } });
        const res = mockRes();

        await ctrl.checkResetToken(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false, code: 'TOKEN_EXPIRED', error: 'errore leggibile: TOKEN_EXPIRED',
        }));
    });

    it('ritorna i dati email per un token valido', async () => {
        userPasswordResetService.verifyResetToken.mockResolvedValueOnce({
            valid: true, userId: 10, email: 'a@b.it',
        });
        const req = mockReq({ params: { token: 'abc' } });
        const res = mockRes();

        await ctrl.checkResetToken(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ success: true, data: { email: 'a@b.it' } });
    });
});

describe('resetPassword', () => {
    it('rifiuta se il token manca nel body', async () => {
        const req = mockReq({ body: { newPassword: 'password123' } });
        const res = mockRes();

        await ctrl.resetPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, code: 'VALIDATION_ERROR' }));
        expect(userPasswordResetService.resetPassword).not.toHaveBeenCalled();
    });

    it('propaga l\'errore del service (es. token scaduto) con status 400', async () => {
        userPasswordResetService.resetPassword.mockResolvedValueOnce({
            success: false, error: 'Il link è scaduto.', code: 'TOKEN_EXPIRED',
        });
        const req = mockReq({ body: { token: 'abc', newPassword: 'password123' } });
        const res = mockRes();

        await ctrl.resetPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Il link è scaduto.', code: 'TOKEN_EXPIRED' });
    });

    it('ritorna successo per un reset-password valido', async () => {
        userPasswordResetService.resetPassword.mockResolvedValueOnce({ success: true, userId: 10 });
        const req = mockReq({ body: { token: 'abc', newPassword: 'password123' } });
        const res = mockRes();

        await ctrl.resetPassword(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
});
