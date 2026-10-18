/**
 * Il superadmin di piattaforma continua a salvare le licenze di uno studio.
 * Il ruolo non è più un lasciapassare sui moduli: il salvataggio resta su questa route.
 */
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const ctrl = require('./admin.controller');

function res() {
    const out = {};
    out.status = jest.fn().mockReturnValue(out);
    out.json = jest.fn().mockReturnValue(out);
    return out;
}

afterEach(() => jest.clearAllMocks());

describe('updateAnyOrgLicenses', () => {
    test('il superadmin scrive l\'elenco moduli dello studio', async () => {
        query.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('SELECT organization_id')) {
                return { recordset: [{ organization_id: 1005 }] };
            }
            return { recordset: [] };
        });

        const out = res();
        await ctrl.updateAnyOrgLicenses({
            params: { organizationId: '1005' },
            body: { modules: ['audit', 'documents', 'saldatura'] },
            user: { user_id: 1, role: 'superadmin', organization_id: 1 },
        }, out);

        expect(out.status).not.toHaveBeenCalled();
        expect(out.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: { modules: ['audit', 'documents', 'saldatura'] },
        }));
        const update = query.mock.calls.find((c) => String(c[0]).includes('UPDATE organizations SET licensed_modules'));
        expect(update[1].organization_id).toBe(1005);
        expect(JSON.parse(update[1].json)).toEqual(['audit', 'documents', 'saldatura']);
    });
});
