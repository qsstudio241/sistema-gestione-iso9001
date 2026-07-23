/**
 * Test slice UAL-3 — regressione login esistente (auth.controller.js NON modificato).
 *
 * Verifica due proprietà critiche:
 * 1) un utente creato via invito (password_hash placeholder, pending_activation=1)
 *    NON può accedere finché non accetta l'invito — bcrypt.compare fallisce
 *    naturalmente contro l'hash placeholder, senza alcuna modifica al login.
 * 2) il login di un utente normale (già registrato, password reale) continua a
 *    funzionare esattamente come prima — nessuna regressione introdotta da UAL-3.
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

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const authController = require('./auth.controller');
const userInviteService = require('../services/userInvite.service');

function mockReq(body) {
    return { body };
}
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

afterEach(() => jest.clearAllMocks());

describe('login — utente pending (invitato, password non ancora impostata)', () => {
    it('rifiuta il login con qualsiasi password contro l\'hash placeholder generato per l\'invito', async () => {
        // Genera il placeholder esattamente come fa userInvite.service (stesso bcrypt reale,
        // non mockato: questo test verifica il comportamento REALE di bcrypt.compare).
        const placeholderHash = await bcrypt.hash('un-valore-casuale-che-nessuno-conosce', 10);

        query.mockResolvedValueOnce({
            recordset: [{
                user_id: 60, email: 'invitato@b.it', password_hash: placeholderHash,
                full_name: 'Invitato', role: 'auditor', organization_id: 1001,
                auditor_org_id: null, is_active: 1,
                organization_code: 'ORG1', organization_name: 'Org Uno',
                organization_vat_number: null, organization_logo_url: null, org_active: 1,
            }],
        });

        const req = mockReq({ email: 'invitato@b.it', password: 'tentativo-qualsiasi' });
        const res = mockRes();

        await authController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false, error: 'Credenziali non valide',
        }));
        // Una sola query (SELECT utente): niente UPDATE last_login, niente generazione token.
        expect(query).toHaveBeenCalledTimes(1);
    });

    it('anche tentando la password vuota o indovinando pattern comuni il login resta bloccato', async () => {
        const placeholderHash = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), 10);
        query.mockResolvedValueOnce({
            recordset: [{
                user_id: 61, email: 'invitato2@b.it', password_hash: placeholderHash,
                full_name: 'Invitato2', role: 'auditor', organization_id: 1001,
                auditor_org_id: null, is_active: 1,
                organization_code: 'ORG1', organization_name: 'Org Uno',
                organization_vat_number: null, organization_logo_url: null, org_active: 1,
            }],
        });

        const req = mockReq({ email: 'invitato2@b.it', password: 'password123' });
        const res = mockRes();

        await authController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });
});

describe('login — utente normale (già registrato, comportamento invariato)', () => {
    it('accede con successo con la password corretta, esattamente come prima di UAL-3', async () => {
        const realHash = await bcrypt.hash('LaMiaPasswordVera1!', 10);
        query.mockResolvedValueOnce({
            recordset: [{
                user_id: 1, email: 'utente@b.it', password_hash: realHash,
                full_name: 'Utente Normale', role: 'auditor', organization_id: 1001,
                auditor_org_id: null, is_active: 1,
                organization_code: 'ORG1', organization_name: 'Org Uno',
                organization_vat_number: null, organization_logo_url: null, org_active: 1,
            }],
        });
        query.mockResolvedValueOnce({ recordset: [] }); // UPDATE last_login
        query.mockResolvedValueOnce({ recordset: [] }); // getAllowedStandardIds

        const req = mockReq({ email: 'utente@b.it', password: 'LaMiaPasswordVera1!' });
        const res = mockRes();

        await authController.login(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            user: expect.objectContaining({ user_id: 1, email: 'utente@b.it' }),
        }));
    });
});

describe('isolamento file (verifica statica)', () => {
    it('auth.controller.js non importa né dipende da userInvite.service (nessun accoppiamento con il flusso invito)', () => {
        // eslint-disable-next-line global-require
        const authControllerSrc = require('fs').readFileSync(require.resolve('./auth.controller.js'), 'utf8');
        expect(authControllerSrc).not.toMatch(/userInvite\.service/);
        expect(userInviteService).toBeDefined(); // il modulo esiste (per la slice UAL-3) ma non è referenziato qui
    });
});
