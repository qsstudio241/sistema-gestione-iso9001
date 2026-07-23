/**
 * Test slice UAL-4 — userPasswordReset.service (reset password self-service).
 *
 * Verifica in particolare il vincolo di sicurezza anti user-enumeration:
 * requestPasswordReset non deve mai lanciare un'eccezione né comportarsi in
 * modo osservabilmente diverso (dal punto di vista del chiamante) tra email
 * esistente ed email inesistente — l'unica differenza è "internamente" se
 * viene generato un token e inviata un'email, ma il valore di ritorno
 * (sempre undefined, mai un'eccezione) è identico in ogni caso.
 */
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('./alertMail.service', () => ({ sendAlertEmail: jest.fn() }));
jest.mock('./userActionToken.service', () => ({
    TOKEN_TTL_HOURS: { invite: 72, reset: 1 },
    createToken: jest.fn(),
    verifyToken: jest.fn(),
    consumeToken: jest.fn(),
}));
jest.mock('./userAudit.service', () => ({ logUserAuditEvent: jest.fn() }));

const { query } = require('../config/database');
const { sendAlertEmail } = require('./alertMail.service');
const userActionTokenService = require('./userActionToken.service');
const userAuditService = require('./userAudit.service');
const userPasswordResetService = require('./userPasswordReset.service');

afterEach(() => jest.clearAllMocks());

function userRow(overrides = {}) {
    return {
        user_id: 42,
        email: 'utente@test.it',
        full_name: 'Mario Rossi',
        organization_id: 1001,
        is_active: 1,
        pending_activation: 0,
        org_active: 1,
        ...overrides,
    };
}

describe('requestPasswordReset — protezione anti user-enumeration', () => {
    it('email inesistente: non genera token, non invia email, non lancia eccezioni', async () => {
        query.mockResolvedValueOnce({ recordset: [] });

        await expect(userPasswordResetService.requestPasswordReset('sconosciuto@test.it')).resolves.toBeUndefined();

        expect(userActionTokenService.createToken).not.toHaveBeenCalled();
        expect(sendAlertEmail).not.toHaveBeenCalled();
        expect(userAuditService.logUserAuditEvent).not.toHaveBeenCalled();
    });

    it('email esistente e attiva: genera token, invia email, registra evento audit — MA la funzione ritorna comunque undefined come nel caso "email inesistente"', async () => {
        query.mockResolvedValueOnce({ recordset: [userRow()] });
        userActionTokenService.createToken.mockResolvedValueOnce({
            rawToken: 'raw-token-abc', expiresAt: new Date('2026-01-01T01:00:00Z'), tokenId: 1,
        });
        sendAlertEmail.mockResolvedValueOnce(true);

        const resultExisting = await userPasswordResetService.requestPasswordReset('utente@test.it');

        expect(userActionTokenService.createToken).toHaveBeenCalledWith(expect.objectContaining({
            userId: 42, organizationId: 1001, tokenType: 'reset',
        }));
        expect(sendAlertEmail).toHaveBeenCalledWith('utente@test.it', expect.any(String), expect.any(String));
        expect(userAuditService.logUserAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'password_reset_requested', targetUserId: 42, organizationId: 1001,
        }));

        // Riprova con email inesistente: il valore di ritorno del service verso il
        // chiamante è identico (undefined) in entrambi i casi — è il controller a
        // costruire sempre lo stesso messaggio generico, indipendentemente da questo.
        jest.clearAllMocks();
        query.mockResolvedValueOnce({ recordset: [] });
        const resultMissing = await userPasswordResetService.requestPasswordReset('sconosciuto@test.it');

        expect(resultExisting).toBe(resultMissing); // entrambi undefined
    });

    it('utente pending_activation (invito mai accettato): non genera token, nessuna password reale da resettare', async () => {
        query.mockResolvedValueOnce({ recordset: [userRow({ pending_activation: 1 })] });

        await userPasswordResetService.requestPasswordReset('utente@test.it');

        expect(userActionTokenService.createToken).not.toHaveBeenCalled();
        expect(sendAlertEmail).not.toHaveBeenCalled();
    });

    it('utente disattivato: non genera token, non invia email', async () => {
        query.mockResolvedValueOnce({ recordset: [userRow({ is_active: 0 })] });

        await userPasswordResetService.requestPasswordReset('utente@test.it');

        expect(userActionTokenService.createToken).not.toHaveBeenCalled();
        expect(sendAlertEmail).not.toHaveBeenCalled();
    });

    it('organizzazione disattivata: non genera token, non invia email', async () => {
        query.mockResolvedValueOnce({ recordset: [userRow({ org_active: 0 })] });

        await userPasswordResetService.requestPasswordReset('utente@test.it');

        expect(userActionTokenService.createToken).not.toHaveBeenCalled();
        expect(sendAlertEmail).not.toHaveBeenCalled();
    });

    it('errore interno del DB non viene mai propagato al chiamante', async () => {
        query.mockRejectedValueOnce(new Error('DB down'));

        await expect(userPasswordResetService.requestPasswordReset('utente@test.it')).resolves.toBeUndefined();
    });

    it('errore durante invio email per un candidato non blocca la funzione (nessuna eccezione)', async () => {
        query.mockResolvedValueOnce({ recordset: [userRow()] });
        userActionTokenService.createToken.mockRejectedValueOnce(new Error('SMTP down'));

        await expect(userPasswordResetService.requestPasswordReset('utente@test.it')).resolves.toBeUndefined();
    });

    it('email vuota o non stringa: nessuna query eseguita, nessuna eccezione', async () => {
        await expect(userPasswordResetService.requestPasswordReset('')).resolves.toBeUndefined();
        await expect(userPasswordResetService.requestPasswordReset(null)).resolves.toBeUndefined();
        expect(query).not.toHaveBeenCalled();
    });
});

describe('verifyResetToken', () => {
    it('ritorna invalid con la stessa reason del token service per token scaduto/non trovato', async () => {
        userActionTokenService.verifyToken.mockResolvedValueOnce({ valid: false, reason: 'TOKEN_EXPIRED' });

        const result = await userPasswordResetService.verifyResetToken('tok-scaduto');

        expect(result).toEqual({ valid: false, reason: 'TOKEN_EXPIRED' });
        expect(query).not.toHaveBeenCalled();
    });

    it('ritorna invalid USER_INACTIVE se l\'utente collegato al token non è più attivo', async () => {
        userActionTokenService.verifyToken.mockResolvedValueOnce({ valid: true, row: { id: 5, user_id: 42 } });
        query.mockResolvedValueOnce({ recordset: [{ user_id: 42, is_active: 0 }] });

        const result = await userPasswordResetService.verifyResetToken('tok-valido');

        expect(result).toEqual({ valid: false, reason: 'USER_INACTIVE' });
    });

    it('ritorna i dati utente per un token valido e un utente attivo', async () => {
        userActionTokenService.verifyToken.mockResolvedValueOnce({ valid: true, row: { id: 5, user_id: 42 } });
        query.mockResolvedValueOnce({
            recordset: [{ user_id: 42, email: 'utente@test.it', full_name: 'Mario Rossi', organization_id: 1001, is_active: 1 }],
        });

        const result = await userPasswordResetService.verifyResetToken('tok-valido');

        expect(result).toEqual({
            valid: true, tokenId: 5, userId: 42, email: 'utente@test.it',
            fullName: 'Mario Rossi', organizationId: 1001,
        });
    });
});

describe('resetPassword', () => {
    it('rifiuta una password troppo corta senza verificare il token', async () => {
        const result = await userPasswordResetService.resetPassword({ token: 'tok', newPassword: 'corta' });

        expect(result).toEqual({ success: false, error: 'Password: minimo 8 caratteri', code: 'VALIDATION_ERROR' });
        expect(userActionTokenService.verifyToken).not.toHaveBeenCalled();
    });

    it('propaga un messaggio leggibile per un token non valido', async () => {
        userActionTokenService.verifyToken.mockResolvedValueOnce({ valid: false, reason: 'TOKEN_ALREADY_USED' });

        const result = await userPasswordResetService.resetPassword({ token: 'tok-usato', newPassword: 'password123' });

        expect(result.success).toBe(false);
        expect(result.code).toBe('TOKEN_ALREADY_USED');
        expect(result.error).toMatch(/già stato utilizzato/);
    });

    it('imposta la nuova password, consuma il token e registra l\'evento audit per un token valido', async () => {
        userActionTokenService.verifyToken.mockResolvedValueOnce({ valid: true, row: { id: 7, user_id: 42 } });
        query.mockResolvedValueOnce({
            recordset: [{ user_id: 42, email: 'utente@test.it', full_name: 'Mario Rossi', organization_id: 1001, is_active: 1 }],
        }); // verifyResetToken -> SELECT utente
        query.mockResolvedValueOnce({ recordset: [] }); // UPDATE password_hash

        const result = await userPasswordResetService.resetPassword({ token: 'tok-valido', newPassword: 'nuovaPassword123' });

        expect(result).toEqual({ success: true, userId: 42 });
        expect(userActionTokenService.consumeToken).toHaveBeenCalledWith(7);
        expect(userAuditService.logUserAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'password_reset_completed', targetUserId: 42, organizationId: 1001, actorUserId: 42,
        }));

        // Verifica che l'UPDATE abbia impostato un hash bcrypt valido per la nuova password
        // (secondo INSERT/UPDATE eseguito con query: controlliamo i parametri passati).
        const updateCallArgs = query.mock.calls[1];
        expect(updateCallArgs[0]).toMatch(/UPDATE users SET password_hash/);
        expect(updateCallArgs[1].password_hash).toEqual(expect.any(String));
        expect(updateCallArgs[1].password_hash).not.toBe('nuovaPassword123');
    });
});
