/**
 * Privacy log: login e registrazione non scrivono l'email dell'utente nei log.
 * Solo il testo delle righe di log cambia: risposte API, token e logica auth invariati.
 */
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/moduleLicense.service', () => ({ getLicensedModuleKeysForOrg: jest.fn().mockResolvedValue([]) }));
jest.mock('../services/companyAccess.service', () => ({
    getUserCompanyAccess: jest.fn().mockResolvedValue([]),
    isCompanyClient: jest.fn().mockReturnValue(false),
}));
jest.mock('../services/documentTreeProvisioner.service', () => ({ provisionTree: jest.fn() }));

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { redactEmailForLog } = require('../utils/ingestErrorMessage');
const authController = require('./auth.controller');

const EMAIL = 'mario.rossi@example.test';

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function allLogs() {
    return ['info', 'warn', 'error', 'debug'].flatMap((m) => logger[m].mock.calls.map((c) => JSON.stringify(c))).join('\n').toLowerCase();
}

function expectNoEmailLeak() {
    const logged = allLogs();
    for (const leak of ['mario.rossi', 'mario', 'rossi', 'example.test']) expect(logged).not.toContain(leak);
}

afterEach(() => jest.clearAllMocks());

describe('auth.controller: nessuna email nei log', () => {
    it('login riuscito: riga di log con email#hash, risposta API con l\'email reale', async () => {
        const password_hash = await bcrypt.hash('Password-Fittizia-1', 4);
        query
            .mockResolvedValueOnce({
                recordset: [{
                    user_id: 7, email: EMAIL, password_hash, full_name: 'Mario Rossi', role: 'auditor',
                    organization_id: 1001, auditor_org_id: null, is_active: 1,
                    organization_code: 'ORG1', organization_name: 'Org Uno',
                    organization_vat_number: null, organization_logo_url: null, org_active: 1,
                }],
            })
            .mockResolvedValue({ recordset: [] });

        const res = mockRes();
        await authController.login({ body: { email: EMAIL, password: 'Password-Fittizia-1' } }, res);

        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(true);
        expect(body.user.email).toBe(EMAIL);
        expect(typeof body.token).toBe('string');
        expect(logger.info).toHaveBeenCalledWith(`✅ Login: ${redactEmailForLog(EMAIL)} (org: Org Uno)`);
        expectNoEmailLeak();
    });

    it('registrazione: riga di log con email#hash, risposta 201 con l\'email reale e query con l\'email reale', async () => {
        query
            .mockResolvedValueOnce({ recordset: [] })
            .mockResolvedValueOnce({ recordset: [{ organization_id: 1001 }] })
            .mockResolvedValueOnce({ recordset: [{ user_id: 99 }] })
            .mockResolvedValue({ recordset: [{ id: 1 }] });

        const res = mockRes();
        await authController.register({
            body: { email: EMAIL, password: 'Password-Fittizia-1', full_name: 'Mario Rossi', organization_id: 1001 },
            headers: {},
        }, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json.mock.calls[0][0].user.email).toBe(EMAIL);
        expect(query.mock.calls[0][1]).toEqual({ email: EMAIL, organization_id: 1001 });
        expect(logger.info).toHaveBeenCalledWith(`Utente registrato: ${redactEmailForLog(EMAIL)} (org: 1001)`);
        expectNoEmailLeak();
    });
});
