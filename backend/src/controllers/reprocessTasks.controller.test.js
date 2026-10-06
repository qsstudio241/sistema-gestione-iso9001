/**
 * Test — reprocessTasks.controller.js (pannello superadmin "Rielaborazioni disponibili")
 * Verifica: conteggio candidati per voce di registro, riuso della logica
 * condivisa (qualificationReprocess.service.js — mai duplicata), gestione
 * errori quando la rielaborazione fallisce. L'autorizzazione "solo
 * superadmin" è verificata separatamente a livello di routing/integrazione
 * (vedi src/tests/integration/reprocessTasks.routes.test.js), qui si testa
 * solo la logica del controller assumendo che il middleware l'abbia già
 * lasciato passare.
 */
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

jest.mock('../data/reprocessableFields', () => ({
    listReprocessableFields: jest.fn(),
    getReprocessableField: jest.fn(),
}));

jest.mock('../services/qualificationReprocess.service', () => ({
    countReprocessCandidates: jest.fn(),
    runReprocessForField: jest.fn(),
}));

const { listReprocessableFields, getReprocessableField } = require('../data/reprocessableFields');
const { countReprocessCandidates, runReprocessForField } = require('../services/qualificationReprocess.service');
const { listReprocessTasks, runReprocessTask } = require('./reprocessTasks.controller');

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

const TRANSFER_MODE_FIELD = { key: 'transfer_mode', label: 'Metodo di trasferimento', module: 'qualifiche', table: 'qualifications' };
const SHIELDING_GAS_FIELD = { key: 'shielding_gas', label: 'Gas di protezione', module: 'qualifiche', table: 'qualifications' };

afterEach(() => jest.clearAllMocks());

describe('listReprocessTasks — GET /admin/reprocess-tasks', () => {
    it('ritorna una riga per ogni voce del registro con il conteggio candidati corrispondente', async () => {
        listReprocessableFields.mockReturnValue([TRANSFER_MODE_FIELD, SHIELDING_GAS_FIELD]);
        countReprocessCandidates
            .mockResolvedValueOnce({ total: 15, byOrganization: [{ organization_id: 1001, count: 15 }] })
            .mockResolvedValueOnce({ total: 0, byOrganization: [] });

        const req = { query: {} };
        const res = mockRes();
        await listReprocessTasks(req, res);

        expect(countReprocessCandidates).toHaveBeenCalledWith('transfer_mode', { orgId: null });
        expect(countReprocessCandidates).toHaveBeenCalledWith('shielding_gas', { orgId: null });
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            total_candidates: 15,
            tasks: [
                expect.objectContaining({ key: 'transfer_mode', label: 'Metodo di trasferimento', candidate_count: 15 }),
                expect.objectContaining({ key: 'shielding_gas', candidate_count: 0 }),
            ],
        }));
    });

    it('applica il filtro organization_id quando richiesto (superadmin cross-tenant)', async () => {
        listReprocessableFields.mockReturnValue([TRANSFER_MODE_FIELD]);
        countReprocessCandidates.mockResolvedValueOnce({ total: 3, byOrganization: [] });

        const req = { query: { organization_id: '1001' } };
        const res = mockRes();
        await listReprocessTasks(req, res);

        expect(countReprocessCandidates).toHaveBeenCalledWith('transfer_mode', { orgId: 1001 });
    });

    it('un errore su una singola voce non blocca le altre (candidate_count 0 + error, non 500)', async () => {
        listReprocessableFields.mockReturnValue([TRANSFER_MODE_FIELD, SHIELDING_GAS_FIELD]);
        countReprocessCandidates
            .mockRejectedValueOnce(new Error('DB down'))
            .mockResolvedValueOnce({ total: 2, byOrganization: [] });

        const req = { query: {} };
        const res = mockRes();
        await listReprocessTasks(req, res);

        expect(res.status).not.toHaveBeenCalledWith(500);
        const payload = res.json.mock.calls[0][0];
        expect(payload.tasks[0]).toEqual(expect.objectContaining({ key: 'transfer_mode', candidate_count: 0, error: 'DB down' }));
        expect(payload.tasks[1]).toEqual(expect.objectContaining({ key: 'shielding_gas', candidate_count: 2 }));
    });
});

describe('runReprocessTask — POST /admin/reprocess-tasks/:key/run', () => {
    it('404 se la chiave non è nel registro (nessuna chiamata al servizio)', async () => {
        getReprocessableField.mockReturnValue(null);
        const req = { params: { key: 'campo_inesistente' }, body: {}, user: { user_id: 1 } };
        const res = mockRes();

        await runReprocessTask(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(runReprocessForField).not.toHaveBeenCalled();
    });

    it('riusa runReprocessForField (stessa logica dello script CLI) e ritorna il riepilogo', async () => {
        getReprocessableField.mockReturnValue(TRANSFER_MODE_FIELD);
        runReprocessForField.mockResolvedValueOnce({
            field: 'transfer_mode',
            candidatesFound: 15,
            candidatesProcessed: 15,
            proposalsCreated: 12,
            skippedAlreadyProposed: 2,
            skippedNoFile: 0,
            skippedNoValueExtracted: 1,
            errors: 0,
            errorDetails: [],
            hasMore: false,
        });

        const req = { params: { key: 'transfer_mode' }, body: {}, user: { user_id: 7 } };
        const res = mockRes();
        await runReprocessTask(req, res);

        expect(runReprocessForField).toHaveBeenCalledWith('transfer_mode', { orgId: null, limit: undefined });
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            proposalsCreated: 12,
            candidatesFound: 15,
        }));
    });

    it('passa organization_id e limit dal body al servizio', async () => {
        getReprocessableField.mockReturnValue(TRANSFER_MODE_FIELD);
        runReprocessForField.mockResolvedValueOnce({ field: 'transfer_mode', candidatesFound: 0, candidatesProcessed: 0, proposalsCreated: 0, skippedAlreadyProposed: 0, skippedNoFile: 0, skippedNoValueExtracted: 0, errors: 0, errorDetails: [], hasMore: false });

        const req = { params: { key: 'transfer_mode' }, body: { organization_id: '1001', limit: '5' }, user: { user_id: 7 } };
        const res = mockRes();
        await runReprocessTask(req, res);

        expect(runReprocessForField).toHaveBeenCalledWith('transfer_mode', { orgId: 1001, limit: 5 });
    });

    it('500 con messaggio esplicito se la rielaborazione fallisce (es. errore pipeline AI)', async () => {
        getReprocessableField.mockReturnValue(TRANSFER_MODE_FIELD);
        runReprocessForField.mockRejectedValueOnce(new Error('Pipeline AI non disponibile'));

        const req = { params: { key: 'transfer_mode' }, body: {}, user: { user_id: 7 } };
        const res = mockRes();
        await runReprocessTask(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'Pipeline AI non disponibile' }));
    });
});

describe('voci kind:verify (sola lettura)', () => {
    const VERIFY_FIELD = {
        key: 'verify_9606_1',
        kind: 'verify',
        label: 'Verifica qualifiche ISO 9606-1 vs norma',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        verifyFamily: '9606-1',
    };

    it('GET espone kind (backfill di default) e NON somma le voci verify in total_candidates', async () => {
        listReprocessableFields.mockReturnValue([TRANSFER_MODE_FIELD, VERIFY_FIELD]);
        countReprocessCandidates
            .mockResolvedValueOnce({ total: 4, byOrganization: [] })
            .mockResolvedValueOnce({ total: 9, byOrganization: [{ organization_id: 1001, count: 9 }] });

        const res = mockRes();
        await listReprocessTasks({ query: {} }, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.total_candidates).toBe(4);
        expect(payload.tasks[0]).toEqual(expect.objectContaining({ key: 'transfer_mode', kind: 'backfill', candidate_count: 4 }));
        expect(payload.tasks[1]).toEqual(expect.objectContaining({ key: 'verify_9606_1', kind: 'verify', candidate_count: 9 }));
    });

    it('errore di conteggio su una voce verify: candidate_count 0 + error, kind mantenuto, totale invariato', async () => {
        listReprocessableFields.mockReturnValue([TRANSFER_MODE_FIELD, VERIFY_FIELD]);
        countReprocessCandidates
            .mockResolvedValueOnce({ total: 2, byOrganization: [] })
            .mockRejectedValueOnce(new Error('schema non leggibile'));

        const res = mockRes();
        await listReprocessTasks({ query: {} }, res);

        const payload = res.json.mock.calls[0][0];
        expect(res.status).not.toHaveBeenCalledWith(500);
        expect(payload.total_candidates).toBe(2);
        expect(payload.tasks[1]).toEqual(expect.objectContaining({ key: 'verify_9606_1', kind: 'verify', candidate_count: 0, error: 'schema non leggibile' }));
    });

    it('il filtro organization_id (multi-tenant) arriva alla voce verify', async () => {
        listReprocessableFields.mockReturnValue([VERIFY_FIELD]);
        countReprocessCandidates.mockResolvedValueOnce({ total: 1, byOrganization: [] });
        await listReprocessTasks({ query: { organization_id: '1001' } }, mockRes());
        expect(countReprocessCandidates).toHaveBeenCalledWith('verify_9606_1', { orgId: 1001 });
    });

    it('POST run su una voce verify restituisce il report kind:verify (stessa funzione del servizio)', async () => {
        getReprocessableField.mockReturnValue(VERIFY_FIELD);
        const report = {
            success: true,
            kind: 'verify',
            field: 'verify_9606_1',
            recordsChecked: 10,
            recordsWithWarnings: 1,
            findingsByCode: { 'WQ9606_1.CORR.THK_BW': 1 },
            notVerifiable: { dato_mancante: 3, fonte_mancante: 0 },
            items: [{ id: 5, organization_id: 1001, person_name: 'Mario Rossi', certificate_number: 'C-5', findings: [] }],
            hasMore: false,
        };
        runReprocessForField.mockResolvedValueOnce(report);

        const res = mockRes();
        await runReprocessTask({ params: { key: 'verify_9606_1' }, body: { organization_id: '1001' }, user: { user_id: 1 } }, res);

        expect(runReprocessForField).toHaveBeenCalledWith('verify_9606_1', { orgId: 1001, limit: undefined });
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining(report));
    });
});
