/**
 * Privacy log: l'email di test non scrive i destinatari nei log; risposta API e invio invariati.
 */
jest.mock('../config/database', () => ({ getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/alertMail.service', () => ({
    getEmailSuppression: jest.fn().mockReturnValue({ suppressed: false, reason: null }),
}));
jest.mock('../services/ncAlertEscalation.service', () => ({ runNcEscalationForOrg: jest.fn() }));
const mockSendMail = jest.fn().mockResolvedValue({});
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: mockSendMail })) }));

const { getPool } = require('../config/database');
const logger = require('../utils/logger');
const { redactEmailsForLog } = require('../utils/ingestErrorMessage');
const { sendTestEmail } = require('./notifications.controller');

const RECIPIENTS = 'mario.rossi@example.test, anna.bianchi@example.test';

describe('notifications.sendTestEmail: nessun destinatario nei log', () => {
    const savedEnv = { host: process.env.SMTP_HOST, user: process.env.SMTP_USER };
    beforeAll(() => {
        process.env.SMTP_HOST = 'smtp.example.test';
        process.env.SMTP_USER = 'sender@example.test';
    });
    afterAll(() => {
        for (const [k, v] of [['SMTP_HOST', savedEnv.host], ['SMTP_USER', savedEnv.user]]) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    });
    afterEach(() => jest.clearAllMocks());

    it('riga con email#hash; sendMail e risposta API con i destinatari reali', async () => {
        getPool.mockResolvedValue({
            request: () => ({
                input: jest.fn().mockReturnThis(),
                query: jest.fn().mockResolvedValue({ recordset: [{ recipients_email: RECIPIENTS }] }),
            }),
        });
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await sendTestEmail({ user: { organization_id: 7 } }, res);

        expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: RECIPIENTS }));
        expect(res.json).toHaveBeenCalledWith({ success: true, message: `Email di test inviata a: ${RECIPIENTS}` });
        expect(logger.info).toHaveBeenCalledWith(`[Notifications] Email di test inviata a ${redactEmailsForLog(RECIPIENTS)} per org 7`);
        const logged = ['info', 'warn', 'error', 'debug'].flatMap((m) => logger[m].mock.calls.map((c) => JSON.stringify(c))).join('\n').toLowerCase();
        for (const leak of ['mario', 'rossi', 'anna', 'bianchi', 'example.test']) expect(logged).not.toContain(leak);
    });
});
