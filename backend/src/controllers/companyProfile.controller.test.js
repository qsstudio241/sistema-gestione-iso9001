/**
 * L1 — companyProfile.controller (ADR-018 S2a)
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/moduleLicense.service', () => ({
    hasSalLegalConformityCapability: jest.fn(),
}));
jest.mock('../services/companyAccess.service', () => {
    const actual = jest.requireActual('../services/companyAccess.service');
    return {
        ...actual,
        ensureCompanyAccessLoaded: jest.fn(async (user) => {
            if (user?.company_access !== undefined) return user.company_access;
            user.company_access = [];
            return [];
        }),
    };
});

const { query } = require('../config/database');
const { hasSalLegalConformityCapability } = require('../services/moduleLicense.service');
const ctrl = require('./companyProfile.controller');

const AUDITOR_ORG_ID = 10;
const ORG_ID = 1001;
const COMPANY_ID = 42;

function mockReq(overrides = {}) {
    return {
        params: { id: String(COMPANY_ID) },
        query: {},
        body: {},
        ...overrides,
        user: {
            user_id: 7,
            auditor_org_id: AUDITOR_ORG_ID,
            organization_id: ORG_ID,
            role: 'auditor',
            company_access: [],
            ...(overrides.user || {}),
        },
    };
}

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function mockScope(extra = {}) {
    query.mockResolvedValueOnce({
        recordset: [{
            company_id: COMPANY_ID,
            organization_id: ORG_ID,
            name: 'Acme Srl',
            vat_number: '01234567890',
            address: 'Via Roma 1, Modena',
            ...extra,
        }],
    });
}

beforeEach(() => {
    hasSalLegalConformityCapability.mockResolvedValue(true);
});

afterEach(() => jest.clearAllMocks());

describe('companyProfile GET', () => {
    it('403 se capability OFF', async () => {
        hasSalLegalConformityCapability.mockResolvedValue(false);
        const req = mockReq();
        const res = mockRes();
        await ctrl.getProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'FEATURE_NOT_ENABLED' })
        );
        expect(query).not.toHaveBeenCalled();
    });

    it('403 cross-tenant se azienda non nello studio', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        const req = mockReq();
        const res = mockRes();
        await ctrl.getProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'FORBIDDEN' })
        );
    });

    it('200 + defaults se riga assente, con seed nome/P.IVA da anagrafica', async () => {
        mockScope();
        query.mockResolvedValueOnce({ recordset: [] });
        const req = mockReq();
        const res = mockRes();
        await ctrl.getProfile(req, res);
        expect(res.status).not.toHaveBeenCalled();
        const payload = res.json.mock.calls[0][0];
        expect(payload.success).toBe(true);
        expect(payload.data.exists).toBe(false);
        expect(payload.data.legal_name).toBe('Acme Srl');
        expect(payload.data.vat_number).toBe('01234567890');
        expect(payload.data.seededFromAnagrafica).toEqual(['legal_name', 'vat_number']);
        expect(payload.data.address_anagrafica).toBe('Via Roma 1, Modena');
        expect(payload.data.ateco_primary).toBeNull();
        expect(payload.data.has_dvr).toBeNull();
    });
});

describe('companyProfile PUT', () => {
    it('403 se capability OFF', async () => {
        hasSalLegalConformityCapability.mockResolvedValue(false);
        const req = mockReq({ body: { ateco_primary: '25.11.00' } });
        const res = mockRes();
        await ctrl.putProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'FEATURE_NOT_ENABLED' })
        );
    });

    it('403 write cross-tenant', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        const req = mockReq({ body: { ateco_primary: '25.11.00' } });
        const res = mockRes();
        await ctrl.putProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'FORBIDDEN' })
        );
    });

    it('upsert idempotente: secondo PUT con stessi campi non fallisce', async () => {
        const savedRow = {
            company_id: COMPANY_ID,
            organization_id: ORG_ID,
            ateco_primary: '25.11.00',
            legal_name: 'Acme Srl',
            source_meta: '{"ateco_primary":{"source":"manual"}}',
        };

        mockScope();
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [savedRow] });

        const req1 = mockReq({ body: { ateco_primary: '25.11.00', legal_name: 'Acme Srl' } });
        const res1 = mockRes();
        await ctrl.putProfile(req1, res1);
        expect(res1.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({ exists: true, ateco_primary: '25.11.00' }),
            })
        );
        const insertSql = query.mock.calls.find((c) => String(c[0]).includes('INSERT INTO company_profile'));
        expect(insertSql).toBeTruthy();

        jest.clearAllMocks();
        hasSalLegalConformityCapability.mockResolvedValue(true);

        mockScope();
        query.mockResolvedValueOnce({ recordset: [savedRow] });
        query.mockResolvedValueOnce({ recordset: [], rowsAffected: [1] });
        query.mockResolvedValueOnce({ recordset: [savedRow] });

        const req2 = mockReq({ body: { ateco_primary: '25.11.00', legal_name: 'Acme Srl' } });
        const res2 = mockRes();
        await ctrl.putProfile(req2, res2);
        expect(res2.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({ exists: true, ateco_primary: '25.11.00' }),
            })
        );
        const updateSql = query.mock.calls.find((c) => String(c[0]).includes('UPDATE company_profile'));
        expect(updateSql).toBeTruthy();
        expect(query.mock.calls.some((c) => String(c[0]).includes('INSERT INTO company_profile'))).toBe(false);
    });

    it('409 se UPDATE non tocca alcuna riga', async () => {
        mockScope();
        query.mockResolvedValueOnce({
            recordset: [{ company_id: COMPANY_ID, organization_id: ORG_ID, ateco_primary: '25.11.00' }],
        });
        query.mockResolvedValueOnce({ recordset: [], rowsAffected: [0] });
        const req = mockReq({ body: { ateco_primary: '25.11.00' } });
        const res = mockRes();
        await ctrl.putProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'PROFILE_UPDATE_MISMATCH' })
        );
    });

    it('non tocca companies se sync_anagrafica assente', async () => {
        mockScope();
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({
            recordset: [{ company_id: COMPANY_ID, organization_id: ORG_ID, legal_name: 'Acme Srl' }],
        });
        const req = mockReq({ body: { legal_name: 'Acme Srl' } });
        const res = mockRes();
        await ctrl.putProfile(req, res);
        expect(query.mock.calls.some((c) => String(c[0]).includes('UPDATE companies'))).toBe(false);
    });

    it('sync opzionale aggiorna name e P.IVA in companies', async () => {
        mockScope();
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({
            recordset: [{
                company_id: COMPANY_ID,
                organization_id: ORG_ID,
                legal_name: 'Nuova Srl',
                vat_number: '09998887766',
            }],
        });
        query.mockResolvedValueOnce({ recordset: [], rowsAffected: [1] });
        const req = mockReq({
            body: {
                legal_name: 'Nuova Srl',
                vat_number: '09998887766',
                sync_anagrafica: { name: true, vat_number: true },
            },
        });
        const res = mockRes();
        await ctrl.putProfile(req, res);
        const syncCall = query.mock.calls.find((c) => String(c[0]).includes('UPDATE companies'));
        expect(syncCall).toBeTruthy();
        expect(syncCall[1]).toEqual(expect.objectContaining({
            name: 'Nuova Srl',
            vat_number: '09998887766',
            company_id: COMPANY_ID,
        }));
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    synced_anagrafica: expect.arrayContaining(['name', 'vat_number']),
                }),
            })
        );
    });

    it('400 se body senza campi catalogo', async () => {
        mockScope();
        const req = mockReq({ body: { unknown: 'x' } });
        const res = mockRes();
        await ctrl.putProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'EMPTY_PROFILE_BODY' })
        );
    });
});

describe('companyProfile detect-import', () => {
    it('403 se capability OFF', async () => {
        hasSalLegalConformityCapability.mockResolvedValue(false);
        const req = mockReq({ file: { buffer: Buffer.from('x'), originalname: 'a.xlsx' } });
        const res = mockRes();
        await ctrl.detectProfileImport(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('400 se file mancante', async () => {
        mockScope();
        const req = mockReq();
        const res = mockRes();
        await ctrl.detectProfileImport(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'MISSING_FILE' })
        );
    });
});

describe('companyProfile import Excel', () => {
    it('403 se capability OFF', async () => {
        hasSalLegalConformityCapability.mockResolvedValue(false);
        const req = mockReq({ body: { fields: { ateco_primary: '25.11.00' }, fileName: 'a.xlsx' } });
        const res = mockRes();
        await ctrl.importProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('re-import idempotente (secondo import fa UPDATE)', async () => {
        const savedRow = {
            company_id: COMPANY_ID,
            organization_id: ORG_ID,
            ateco_primary: '25.11.00',
            has_dvr: 1,
        };
        mockScope();
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [savedRow] });

        const req1 = mockReq({
            body: { fields: { ateco_primary: '25.11.00', has_dvr: 'si' }, fileName: 'visura.xlsx' },
        });
        const res1 = mockRes();
        await ctrl.importProfile(req1, res1);
        expect(res1.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({ ateco_primary: '25.11.00' }),
            })
        );

        jest.clearAllMocks();
        hasSalLegalConformityCapability.mockResolvedValue(true);
        mockScope();
        query.mockResolvedValueOnce({ recordset: [savedRow] });
        query.mockResolvedValueOnce({ recordset: [], rowsAffected: [1] });
        query.mockResolvedValueOnce({ recordset: [savedRow] });

        const req2 = mockReq({
            body: { fields: { ateco_primary: '25.11.00', has_dvr: 'si' }, fileName: 'visura.xlsx' },
        });
        const res2 = mockRes();
        await ctrl.importProfile(req2, res2);
        expect(query.mock.calls.some((c) => String(c[0]).includes('UPDATE company_profile'))).toBe(true);
        const metaArg = query.mock.calls.find((c) => String(c[0]).includes('UPDATE'))[1];
        expect(String(metaArg.source_meta)).toContain('"excel"');
    });
});
