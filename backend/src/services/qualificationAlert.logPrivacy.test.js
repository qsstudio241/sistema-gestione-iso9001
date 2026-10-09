/**
 * @jest-environment node
 *
 * Privacy log: l'email del destinatario (persona) non compare nel log di invio alert qualifiche.
 * Fixture sintetiche.
 */

jest.mock('./alertMail.service', () => ({ sendAlertEmail: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const logger = require('../utils/logger');
const { sendAlertEmail } = require('./alertMail.service');
const { redactPersonForLog } = require('../utils/ingestErrorMessage');
const { runQualifEscalationForOrg } = require('./qualificationAlert.service');

const EMAIL = 'zzanna.zzbianchi@example.test';

function poolWith(rolesRows) {
    return {
        request: () => {
            const req = {
                input: () => req,
                query: async (sql) => {
                    if (sql.includes('FROM qualifications q')) {
                        return { recordset: [{
                            id: 1, organization_id: 10, company_id: 5, person_name: 'ZZROSSI ZZMARIO',
                            qualification_type: 'Saldatore ISO 9606-1', certificate_number: 'C-1',
                            expiry_date: '2020-01-01', next_confirmation_due: null, status: 'valida',
                        }] };
                    }
                    if (sql.includes('personnel_roles')) return { recordset: rolesRows };
                    return { recordset: [] };
                },
            };
            return req;
        },
    };
}

describe('runQualifEscalationForOrg: nessuna email di persona nei log', () => {
    beforeEach(() => jest.clearAllMocks());

    it('riga "Email inviata a": person#hash, resto invariato, destinatario reale usato per l\'invio', async () => {
        sendAlertEmail.mockResolvedValue(true);
        const out = await runQualifEscalationForOrg(
            poolWith([{ name: 'ZZAnna ZZBianchi', email: EMAIL }]),
            { organization_id: 10, organization_name: 'Org Test', alert_days_1: 30, alert_days_2: 7, recipients_email: null },
        );

        expect(out.sent).toBe(1);
        expect(sendAlertEmail.mock.calls[0][0]).toBe(EMAIL);
        const line = logger.info.mock.calls.map((c) => String(c[0])).find((l) => l.includes('Email inviata a'));
        expect(line).toBe(`[QualAlert] Email inviata a ${redactPersonForLog(EMAIL)} (org 10, company 5, 1 qualifiche, source=personnel_roles)`);

        const logged = ['info', 'warn', 'error', 'debug'].flatMap((m) => logger[m].mock.calls.map((c) => JSON.stringify(c))).join('\n');
        for (const leak of ['zzanna', 'zzbianchi', 'example.test', 'ZZROSSI']) expect(logged.toLowerCase()).not.toContain(leak.toLowerCase());
    });
});
