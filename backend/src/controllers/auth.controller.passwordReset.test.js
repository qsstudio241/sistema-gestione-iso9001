/**
 * Test slice UAL-4 — isolamento e regressione login rispetto al reset password
 * self-service.
 *
 * Vincolo assoluto del piano: auth.controller.js (login) e la sua logica di
 * verifica password NON devono essere toccati da questa slice. Verifica:
 * 1) auth.controller.js non importa/dipende da userPasswordReset.service
 *    (nessun accoppiamento con il nuovo flusso di reset).
 * 2) il login di un utente normale continua a funzionare esattamente come
 *    prima (stesso comportamento già verificato per UAL-3, riconfermato qui
 *    dopo l'introduzione di UAL-4).
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
const userPasswordResetService = require('../services/userPasswordReset.service');

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

describe('isolamento file (verifica statica) — UAL-4', () => {
    it('auth.controller.js non importa né dipende da userPasswordReset.service', () => {
        const authControllerSrc = require('fs').readFileSync(require.resolve('./auth.controller.js'), 'utf8');
        expect(authControllerSrc).not.toMatch(/userPasswordReset\.service/);
        expect(userPasswordResetService).toBeDefined(); // il modulo esiste (UAL-4) ma non è referenziato qui
    });
});

describe('login — utente normale, comportamento invariato dopo UAL-4', () => {
    it('accede con successo con la password corretta, esattamente come prima dell\'introduzione del reset self-service', async () => {
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

    it('rifiuta credenziali errate esattamente come prima (401 Credenziali non valide)', async () => {
        const realHash = await bcrypt.hash('LaPasswordCorretta1!', 10);
        query.mockResolvedValueOnce({
            recordset: [{
                user_id: 2, email: 'utente2@b.it', password_hash: realHash,
                full_name: 'Utente Due', role: 'auditor', organization_id: 1001,
                auditor_org_id: null, is_active: 1,
                organization_code: 'ORG1', organization_name: 'Org Uno',
                organization_vat_number: null, organization_logo_url: null, org_active: 1,
            }],
        });

        const req = mockReq({ email: 'utente2@b.it', password: 'password-sbagliata' });
        const res = mockRes();

        await authController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false, error: 'Credenziali non valide',
        }));
    });
});
