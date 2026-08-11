/**
 * Test L1 — admin.controller::createUser — controllo univocità email GLOBALE.
 *
 * Bug reale riprodotto in produzione (11/08/2026) su un endpoint gemello
 * (auditorOrg.controller.js::inviteFirstStudioAdmin): il vincolo UNIQUE reale
 * nel database (UQ_users_email) è GLOBALE su tutta la piattaforma, non per
 * organizzazione. Il pre-check duplicati di createUser era scoped a
 * organization_id — corretto qui per lo stesso motivo, prima che lo stesso
 * bug si manifesti su questo endpoint (usato da ogni admin, non solo
 * superadmin): un admin che crea un utente con un'email già registrata in
 * un ALTRO tenant riceveva un errore SQL grezzo mappato a 500 generico
 * invece di un messaggio chiaro.
 */
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/userAudit.service', () => ({ logUserAuditEvent: jest.fn() }));
jest.mock('../services/userInvite.service', () => ({
    generatePlaceholderPasswordHash: jest.fn(),
    sendInviteEmail: jest.fn(),
}));

const { query } = require('../config/database');
const ctrl = require('./admin.controller');

const ORG_ID = 1001;
const ACTOR_ID = 5;

function mockReq(overrides = {}) {
    return {
        params: {}, query: {}, body: {},
        ...overrides,
        user: { organization_id: ORG_ID, user_id: ACTOR_ID, role: 'admin', ...(overrides.user || {}) },
    };
}
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

afterEach(() => jest.clearAllMocks());

describe('createUser — univocità email GLOBALE (non scoped a organization_id)', () => {
    it('409 "in questa organizzazione" se il duplicato è nella STESSA organizzazione dell\'attore', async () => {
        query.mockResolvedValueOnce({ recordset: [{ user_id: 10, organization_id: ORG_ID }] }); // duplicate check

        const req = mockReq({ body: { email: 'a@b.it', password: 'password123', full_name: 'Mario Rossi' } });
        const res = mockRes();
        await ctrl.createUser(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'EMAIL_DUPLICATE',
            error: expect.stringContaining('in questa organizzazione'),
        }));
    });

    it('409 "altra organizzazione" se il duplicato è in un\'organizzazione DIVERSA (bug reale — pre-check scoped non lo trovava)', async () => {
        query.mockResolvedValueOnce({ recordset: [{ user_id: 2023, organization_id: 9999 }] }); // duplicato in altra org

        const req = mockReq({ body: { email: 'fausto@fr-busato.it', password: 'password123', full_name: 'Fausto Busato' } });
        const res = mockRes();
        await ctrl.createUser(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'EMAIL_DUPLICATE',
            error: expect.stringContaining('altra organizzazione'),
        }));

        // Il pre-check deve essere globale: nessun filtro organization_id nella WHERE.
        const dupCheckSql = query.mock.calls[0][0];
        expect(dupCheckSql).toMatch(/WHERE email = @email\s*$/);
        expect(query.mock.calls.find(([sql]) => sql.includes('INSERT INTO users'))).toBeUndefined();
    });

    it('409 (non 500) se il DB rifiuta l\'INSERT per violazione UQ_users_email — race condition sul pre-check', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // pre-check: nessun duplicato trovato
        const uniqueViolation = new Error("Violation of UNIQUE KEY constraint 'UQ_users_email'");
        uniqueViolation.number = 2627;
        query.mockRejectedValueOnce(uniqueViolation); // INSERT fallisce

        const req = mockReq({ body: { email: 'a@b.it', password: 'password123', full_name: 'Mario Rossi' } });
        const res = mockRes();
        await ctrl.createUser(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMAIL_DUPLICATE' }));
    });

    it('201 se l\'email non esiste in nessuna organizzazione (comportamento invariato)', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // duplicate check
        query.mockResolvedValueOnce({ recordset: [{ user_id: 50 }] }); // INSERT
        query.mockResolvedValueOnce({ recordset: [{ id: 1 }] }); // document tree già presente

        const req = mockReq({ body: { email: 'nuovo@b.it', password: 'password123', full_name: 'Mario Rossi' } });
        const res = mockRes();
        await ctrl.createUser(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
    });
});
