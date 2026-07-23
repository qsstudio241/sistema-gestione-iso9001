/**
 * Test slice UAL-3 — userInvite.service (invito via email, orchestrazione)
 * Verifica: invio invito (token + email + audit log), verifica token (tutti i
 * casi di rifiuto), accept-invite (password valida/non valida, token invalido).
 */
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('./alertMail.service', () => ({ sendAlertEmail: jest.fn() }));
jest.mock('./userActionToken.service', () => ({
    createToken: jest.fn(),
    verifyToken: jest.fn(),
    consumeToken: jest.fn(),
    TOKEN_TTL_HOURS: { invite: 72, reset: 1 },
}));
jest.mock('./userAudit.service', () => ({ logUserAuditEvent: jest.fn() }));

const { query } = require('../config/database');
const { sendAlertEmail } = require('./alertMail.service');
const userActionTokenService = require('./userActionToken.service');
const userAuditService = require('./userAudit.service');
const userInviteService = require('./userInvite.service');

afterEach(() => jest.clearAllMocks());

describe('generatePlaceholderPasswordHash', () => {
    it('genera un hash bcrypt valido (nessuna password reale potrà mai corrispondere)', async () => {
        const hash = await userInviteService.generatePlaceholderPasswordHash();
        expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('genera un hash diverso ad ogni chiamata (basato su un valore casuale)', async () => {
        const h1 = await userInviteService.generatePlaceholderPasswordHash();
        const h2 = await userInviteService.generatePlaceholderPasswordHash();
        expect(h1).not.toBe(h2);
    });
});

describe('sendInviteEmail', () => {
    it('crea il token, invia l\'email con il link e logga invite_sent', async () => {
        userActionTokenService.createToken.mockResolvedValueOnce({
            rawToken: 'raw-token-123', expiresAt: new Date('2026-08-01T00:00:00Z'), tokenId: 1,
        });
        sendAlertEmail.mockResolvedValueOnce(true);

        const result = await userInviteService.sendInviteEmail({
            userId: 10, email: 'nuovo@test.it', fullName: 'Mario Rossi',
            organizationId: 1001, actorUserId: 5,
        });

        expect(userActionTokenService.createToken).toHaveBeenCalledWith(expect.objectContaining({
            userId: 10, organizationId: 1001, tokenType: 'invite', createdBy: 5,
        }));
        expect(sendAlertEmail).toHaveBeenCalledWith(
            'nuovo@test.it',
            expect.stringContaining('Invito'),
            expect.stringContaining('raw-token-123'),
        );
        expect(userAuditService.logUserAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: 1001, targetUserId: 10, actorUserId: 5, action: 'invite_sent',
        }));
        expect(result.sent).toBe(true);
    });

    it('logga invite_resent quando isResend è true', async () => {
        userActionTokenService.createToken.mockResolvedValueOnce({
            rawToken: 'tok', expiresAt: new Date(), tokenId: 2,
        });
        sendAlertEmail.mockResolvedValueOnce(true);

        await userInviteService.sendInviteEmail({
            userId: 10, email: 'a@b.it', fullName: 'X', organizationId: 1001, isResend: true,
        });

        expect(userAuditService.logUserAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'invite_resent' })
        );
    });

    it('non lancia eccezioni se l\'invio email fallisce (SMTP non configurato)', async () => {
        userActionTokenService.createToken.mockResolvedValueOnce({
            rawToken: 'tok', expiresAt: new Date(), tokenId: 3,
        });
        sendAlertEmail.mockResolvedValueOnce(false);

        await expect(userInviteService.sendInviteEmail({
            userId: 10, email: 'a@b.it', fullName: 'X', organizationId: 1001,
        })).resolves.toEqual(expect.objectContaining({ sent: false }));
    });
});

describe('verifyInviteToken', () => {
    it('ritorna invalid se il token non è valido (delega a userActionToken.service)', async () => {
        userActionTokenService.verifyToken.mockResolvedValueOnce({ valid: false, reason: 'TOKEN_EXPIRED' });
        const result = await userInviteService.verifyInviteToken('abc');
        expect(result).toEqual({ valid: false, reason: 'TOKEN_EXPIRED' });
        expect(query).not.toHaveBeenCalled();
    });

    it('ritorna USER_INACTIVE se l\'utente non è più attivo', async () => {
        userActionTokenService.verifyToken.mockResolvedValueOnce({ valid: true, row: { id: 1, user_id: 10 } });
        query.mockResolvedValueOnce({ recordset: [{ user_id: 10, email: 'a@b.it', full_name: 'X', is_active: 0, pending_activation: 1 }] });
        const result = await userInviteService.verifyInviteToken('abc');
        expect(result).toEqual({ valid: false, reason: 'USER_INACTIVE' });
    });

    it('ritorna ALREADY_ACTIVATED se l\'utente ha già impostato la password', async () => {
        userActionTokenService.verifyToken.mockResolvedValueOnce({ valid: true, row: { id: 1, user_id: 10 } });
        query.mockResolvedValueOnce({ recordset: [{ user_id: 10, email: 'a@b.it', full_name: 'X', is_active: 1, pending_activation: 0 }] });
        const result = await userInviteService.verifyInviteToken('abc');
        expect(result).toEqual({ valid: false, reason: 'ALREADY_ACTIVATED' });
    });

    it('ritorna i dati utente per un token valido e utente pending', async () => {
        userActionTokenService.verifyToken.mockResolvedValueOnce({ valid: true, row: { id: 7, user_id: 10 } });
        query.mockResolvedValueOnce({ recordset: [{ user_id: 10, email: 'a@b.it', full_name: 'Mario Rossi', is_active: 1, pending_activation: 1 }] });
        const result = await userInviteService.verifyInviteToken('abc');
        expect(result).toEqual({ valid: true, tokenId: 7, userId: 10, email: 'a@b.it', fullName: 'Mario Rossi' });
    });
});

describe('acceptInvite', () => {
    it('rifiuta una password troppo corta senza consultare il token', async () => {
        const result = await userInviteService.acceptInvite({ token: 'abc', password: '123' });
        expect(result).toEqual(expect.objectContaining({ success: false, code: 'VALIDATION_ERROR' }));
        expect(userActionTokenService.verifyToken).not.toHaveBeenCalled();
    });

    it('rifiuta un token invalido/scaduto con messaggio comprensibile', async () => {
        userActionTokenService.verifyToken.mockResolvedValueOnce({ valid: false, reason: 'TOKEN_EXPIRED' });
        const result = await userInviteService.acceptInvite({ token: 'abc', password: 'password123' });
        expect(result.success).toBe(false);
        expect(result.code).toBe('TOKEN_EXPIRED');
        expect(result.error).toMatch(/scaduto/i);
    });

    it('imposta la password, consuma il token e logga invite_accepted per un token valido', async () => {
        userActionTokenService.verifyToken.mockResolvedValueOnce({ valid: true, row: { id: 5, user_id: 10 } });
        query.mockResolvedValueOnce({ recordset: [{ user_id: 10, email: 'a@b.it', full_name: 'X', is_active: 1, pending_activation: 1 }] }); // verifyInviteToken lookup
        query.mockResolvedValueOnce({ recordset: [] }); // UPDATE password_hash
        query.mockResolvedValueOnce({ recordset: [{ organization_id: 1001 }] }); // lookup organization_id

        const result = await userInviteService.acceptInvite({ token: 'abc', password: 'password123' });

        expect(result).toEqual({ success: true, userId: 10 });
        expect(userActionTokenService.consumeToken).toHaveBeenCalledWith(5);
        const updateCall = query.mock.calls.find(([sql]) => sql.includes('UPDATE users SET password_hash'));
        expect(updateCall[1]).toEqual(expect.objectContaining({ user_id: 10 }));
        expect(userAuditService.logUserAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            targetUserId: 10, action: 'invite_accepted', organizationId: 1001,
        }));
    });
});
