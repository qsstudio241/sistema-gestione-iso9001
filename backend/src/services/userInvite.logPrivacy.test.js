/**
 * Privacy log: invito utente e reset password non scrivono l'email nei log.
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
const logger = require('../utils/logger');
const { sendAlertEmail } = require('./alertMail.service');
const userActionTokenService = require('./userActionToken.service');
const userInviteService = require('./userInvite.service');
const userPasswordResetService = require('./userPasswordReset.service');
const { redactEmailForLog } = require('../utils/ingestErrorMessage');

const EMAIL = 'mario.rossi@example.test';

function allLogs() {
    return ['info', 'warn', 'error', 'debug'].flatMap((m) => logger[m].mock.calls.map((c) => JSON.stringify(c))).join('\n').toLowerCase();
}

afterEach(() => jest.clearAllMocks());

describe('userInvite: invio invito fallito', () => {
    it('log warn con email#hash (meta compresi), invio con destinatario reale', async () => {
        userActionTokenService.createToken.mockResolvedValueOnce({
            rawToken: 'raw-token-123', expiresAt: new Date('2026-08-01T00:00:00Z'), tokenId: 1,
        });
        sendAlertEmail.mockResolvedValueOnce(false);

        const result = await userInviteService.sendInviteEmail({
            userId: 10, email: EMAIL, fullName: 'Mario Rossi', organizationId: 1001, actorUserId: 5,
        });

        expect(result.sent).toBe(false);
        expect(sendAlertEmail).toHaveBeenCalledWith(EMAIL, expect.stringContaining('Invito'), expect.stringContaining('raw-token-123'));
        expect(logger.warn).toHaveBeenCalledWith(
            '[UserInvite] Email invito non inviata (SMTP non configurato o errore)',
            { userId: 10, email: redactEmailForLog(EMAIL) },
        );
        const logged = allLogs();
        for (const leak of ['mario.rossi', 'example.test']) expect(logged).not.toContain(leak);
    });
});

describe('userPasswordReset: invio reset fallito', () => {
    it('nessuna email nei log, invio con destinatario reale', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                user_id: 42, email: EMAIL, full_name: 'Mario Rossi', organization_id: 1001,
                is_active: 1, pending_activation: 0, org_active: 1,
            }],
        });
        userActionTokenService.createToken.mockResolvedValueOnce({
            rawToken: 'raw-reset-1', expiresAt: new Date('2026-08-01T00:00:00Z'), tokenId: 2,
        });
        sendAlertEmail.mockResolvedValueOnce(false);

        await userPasswordResetService.requestPasswordReset(EMAIL);

        expect(sendAlertEmail).toHaveBeenCalledWith(EMAIL, expect.stringContaining('password'), expect.any(String));
        expect(logger.warn).toHaveBeenCalledWith(
            '[UserPasswordReset] Email reset non inviata (SMTP non configurato o errore)',
            { userId: 42 },
        );
        const logged = allLogs();
        for (const leak of ['mario.rossi', 'mario', 'rossi', 'example.test']) expect(logged).not.toContain(leak);
    });
});
