/**
 * @jest-environment node
 *
 * Test — ingestStaging.controller.js. Prima della generalizzazione WPQR
 * (08/08/2026) non esisteva copertura diretta per questo controller.
 * Copre in particolare il nuovo filtro `?module=saldatura` (coda di
 * rielaborazione WPQR, migrazione 143) accanto a quello già esistente
 * `?module=qualifiche`.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');

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

const { listStaging, getModuleForDocType, getStagingById, resolveStagingFilePath } = require('../services/ingestStaging.service');
const { getLicensedModuleKeysForOrg } = require('../services/moduleLicense.service');
const { listStaging: listStagingHandler, getStaging, getStagingFile } = require('./ingestStaging.controller');

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

describe('getStagingFile — anteprima documento sorgente (bug "fs" mancante, 09/08/2026)', () => {
    afterEach(() => jest.clearAllMocks());

    /**
     * Regressione: prima del fix del 09/08/2026 questo controller usava
     * `fs.createReadStream` senza `require('fs')` in testa al file —
     * ReferenceError a runtime mai coperto da test (nessun test precedente
     * chiamava getStagingFile), scoperto in produzione perché l'anteprima
     * mostrava sempre "Anteprima non disponibile" (sia per Qualifiche sia
     * per WPQR, qualunque tenant).
     */
    it('esegue lo streaming del file quando il record e il percorso sono validi', async () => {
        const tmpFile = path.join(os.tmpdir(), `staging-test-${Date.now()}.pdf`);
        fs.writeFileSync(tmpFile, 'PDF-CONTENT');
        try {
            getStagingById.mockResolvedValue({
                id: 1166,
                doc_type: 'wpqr',
                organization_id: 1003,
                storage_path: tmpFile,
                mime_type: 'application/pdf',
                original_name: 'test.pdf',
            });
            resolveStagingFilePath.mockReturnValue(tmpFile);

            const req = { params: { id: '1166' }, user: { organization_id: 1003, role: 'utente' } };
            const res = new PassThrough();
            res.setHeader = jest.fn();
            res.status = jest.fn().mockReturnValue(res);
            res.json = jest.fn().mockReturnValue(res);

            const chunks = [];
            res.on('data', (c) => chunks.push(c));

            await new Promise((resolve, reject) => {
                res.on('end', resolve);
                res.on('error', reject);
                getStagingFile(req, res).catch(reject);
            });

            expect(Buffer.concat(chunks).toString()).toBe('PDF-CONTENT');
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
            expect(res.status).not.toHaveBeenCalled();
        } finally {
            fs.unlinkSync(tmpFile);
        }
    });

    it('record non trovato -> 404 (nessuna eccezione fs)', async () => {
        getStagingById.mockResolvedValue(null);
        const req = { params: { id: '999' }, user: { organization_id: 1003, role: 'utente' } };
        const res = mockRes();
        await getStagingFile(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});
