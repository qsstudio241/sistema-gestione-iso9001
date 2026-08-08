/**
 * @jest-environment node
 *
 * Test — ingestStaging.controller.js. Prima della generalizzazione WPQR
 * (08/08/2026) non esisteva copertura diretta per questo controller.
 * Copre in particolare il nuovo filtro `?module=saldatura` (coda di
 * rielaborazione WPQR, migrazione 143) accanto a quello già esistente
 * `?module=qualifiche`.
 */

jest.mock('../services/ingestStaging.service', () => ({
    confirmStaging: jest.fn(),
    rejectStaging: jest.fn(),
    getStagingById: jest.fn(),
    listStaging: jest.fn(),
    getModuleForDocType: jest.fn(),
    resolveStagingFilePath: jest.fn(),
    parseJson: (v, fallback) => (v == null ? fallback : v),
}));
jest.mock('../services/moduleLicense.service', () => ({ getLicensedModuleKeysForOrg: jest.fn() }));
jest.mock('../services/ingestFeedback.service', () => ({ getLearningStats: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const { listStaging, getModuleForDocType } = require('../services/ingestStaging.service');
const { getLicensedModuleKeysForOrg } = require('../services/moduleLicense.service');
const { listStaging: listStagingHandler, getStaging } = require('./ingestStaging.controller');

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('listStagingHandler — filtro ?module=', () => {
    afterEach(() => jest.clearAllMocks());

    it('module=qualifiche mappa sui doc_type patentino_saldatore/qualifica_14732', async () => {
        getModuleForDocType.mockReturnValue('qualifiche');
        getLicensedModuleKeysForOrg.mockResolvedValue(['qualifiche']);
        listStaging.mockResolvedValue([]);

        const req = { query: { module: 'qualifiche' }, user: { organization_id: 1001, role: 'utente' } };
        const res = mockRes();
        await listStagingHandler(req, res);

        expect(listStaging).toHaveBeenCalledWith(expect.objectContaining({
            docTypes: ['patentino_saldatore', 'qualifica_14732'],
        }));
        expect(res.status).not.toHaveBeenCalledWith(400);
    });

    it('module=saldatura mappa sul doc_type wpqr (generalizzazione 08/08/2026)', async () => {
        getModuleForDocType.mockReturnValue('saldatura');
        getLicensedModuleKeysForOrg.mockResolvedValue(['saldatura']);
        listStaging.mockResolvedValue([]);

        const req = { query: { module: 'saldatura' }, user: { organization_id: 1001, role: 'utente' } };
        const res = mockRes();
        await listStagingHandler(req, res);

        expect(listStaging).toHaveBeenCalledWith(expect.objectContaining({
            docTypes: ['wpqr'],
        }));
        expect(res.status).not.toHaveBeenCalledWith(400);
    });

    it('module=saldatura con reprocess_only=true passa il filtro alla coda WPQR', async () => {
        getModuleForDocType.mockReturnValue('saldatura');
        getLicensedModuleKeysForOrg.mockResolvedValue(['saldatura']);
        listStaging.mockResolvedValue([
            { id: 1, doc_type: 'wpqr', target_wpqr_id: 7, field_scope: 'preheat_temp', is_reprocess: true },
        ]);

        const req = { query: { module: 'saldatura', reprocess_only: 'true' }, user: { organization_id: 1001, role: 'utente' } };
        const res = mockRes();
        await listStagingHandler(req, res);

        expect(listStaging).toHaveBeenCalledWith(expect.objectContaining({ reprocessOnly: true, docTypes: ['wpqr'] }));
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
    });

    it('modulo/doc_type mancanti -> 400', async () => {
        const req = { query: {}, user: { organization_id: 1001, role: 'utente' } };
        const res = mockRes();
        await listStagingHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(listStaging).not.toHaveBeenCalled();
    });

    it('modulo non licenziato per un utente non admin -> 403', async () => {
        getModuleForDocType.mockReturnValue('saldatura');
        getLicensedModuleKeysForOrg.mockResolvedValue(['qualifiche']); // saldatura NON incluso

        const req = { query: { module: 'saldatura' }, user: { organization_id: 1001, role: 'utente' } };
        const res = mockRes();
        await listStagingHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(listStaging).not.toHaveBeenCalled();
    });

    it('superadmin bypassa il controllo licenza modulo', async () => {
        listStaging.mockResolvedValue([]);
        const req = { query: { module: 'saldatura' }, user: { organization_id: 1001, role: 'superadmin' } };
        const res = mockRes();
        await listStagingHandler(req, res);

        expect(getLicensedModuleKeysForOrg).not.toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalledWith(403);
    });
});

describe('getStaging — espone target_wpqr_id oltre a target_qualification_id', () => {
    afterEach(() => jest.clearAllMocks());

    it('include target_wpqr_id nella risposta per una proposta di rielaborazione WPQR', async () => {
        const { getStagingById } = require('../services/ingestStaging.service');
        getStagingById.mockResolvedValue({
            id: 60, doc_type: 'wpqr', original_name: 'wpqr.pdf', review_status: 'pending',
            staged_fields_json: '{}', field_confidence_json: '{}', warnings_json: '[]',
            target_qualification_id: null, target_wpqr_id: 7, field_scope: 'preheat_temp',
        });
        getModuleForDocType.mockReturnValue('saldatura');
        getLicensedModuleKeysForOrg.mockResolvedValue(['saldatura']);

        const req = { params: { id: '60' }, user: { organization_id: 1001, role: 'utente' } };
        const res = mockRes();
        await getStaging(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ target_wpqr_id: 7 }));
    });
});
