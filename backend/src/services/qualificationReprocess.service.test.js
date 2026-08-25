/**
 * @jest-environment node
 *
 * Test L1 — qualificationReprocess.service.js (pannello superadmin
 * "Rielaborazioni disponibili"). Prima di questa sessione (08/08/2026) la
 * logica core (selectReprocessCandidates, resolveExtractedReprocessValue) non
 * aveva copertura diretta — solo test del controller con il servizio mockato.
 *
 * Copre in particolare il caso thickness_max_unlimited (gap analysis
 * 08/08/2026): colonna BIT NOT NULL DEFAULT 0, diversa dagli altri campi
 * rielaborabili (tutti NVARCHAR/DECIMAL nullable) — richiede una condizione di
 * selezione candidati personalizzata (`candidateWhere`) invece del default
 * `${field} IS NULL`, e un'estrazione che propone solo `true` (riproporre
 * `false` non avrebbe senso, è già il valore di default).
 */

jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('./documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));
jest.mock('./ingestStaging.service', () => ({ createStagingRecord: jest.fn() }));
jest.mock('./personnelQualificationLink.service', () => ({ resolvePersonnelForQualification: jest.fn() }));
jest.mock('../utils/documentClassifier', () => ({
    classifyDocument: jest.fn(),
    WRONG_MODULE_FOR_QUALIFICATIONS: new Set(),
    WRONG_MODULE_FOR_WPQR: new Set(),
    WRONG_MODULE_MESSAGES: {},
    SUGGESTED_MODULE: {},
}));

const { query } = require('../config/database');
const { createStagingRecord } = require('./ingestStaging.service');
const { runDocumentIngest } = require('./documentIngestPipeline.service');
const {
    selectReprocessCandidates,
    resolveExtractedReprocessValue,
    guessDocType,
    runReprocessForField,
} = require('./qualificationReprocess.service');
const { getReprocessableField } = require('../data/reprocessableFields');

describe('resolveExtractedReprocessValue', () => {
    it('filler_material: usa filler_material, ricade su filler_material_group', () => {
        expect(resolveExtractedReprocessValue('filler_material', { filler_material: 'FM2' })).toBe('FM2');
        expect(resolveExtractedReprocessValue('filler_material', { filler_material_group: 'FM3' })).toBe('FM3');
        expect(resolveExtractedReprocessValue('filler_material', {})).toBeNull();
    });

    it('pipe_diameter_min_mm: usa il valore min, ricade sul singolo pipe_diameter_mm', () => {
        expect(resolveExtractedReprocessValue('pipe_diameter_min_mm', { pipe_diameter_min_mm: 60 })).toBe(60);
        expect(resolveExtractedReprocessValue('pipe_diameter_min_mm', { pipe_diameter_mm: 80 })).toBe(80);
        expect(resolveExtractedReprocessValue('pipe_diameter_min_mm', {})).toBeNull();
    });

    it('thickness_max_unlimited: propone SOLO true, mai false (già il default)', () => {
        expect(resolveExtractedReprocessValue('thickness_max_unlimited', { thickness_max_unlimited: true })).toBe(true);
        expect(resolveExtractedReprocessValue('thickness_max_unlimited', { thickness_max_unlimited: false })).toBeNull();
        expect(resolveExtractedReprocessValue('thickness_max_unlimited', {})).toBeNull();
    });

    it('campo generico: passthrough con null per assente/vuoto', () => {
        expect(resolveExtractedReprocessValue('joint_type', { joint_type: 'FW' })).toBe('FW');
        expect(resolveExtractedReprocessValue('joint_type', { joint_type: '' })).toBeNull();
        expect(resolveExtractedReprocessValue('joint_type', {})).toBeNull();
    });
});

describe('selectReprocessCandidates — condizione di selezione', () => {
    afterEach(() => jest.clearAllMocks());

    it('campo standard (nullable): usa la condizione di default "<campo> IS NULL"', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        const config = getReprocessableField('transfer_mode');

        await selectReprocessCandidates('transfer_mode', config, {});

        const [sql] = query.mock.calls[0];
        expect(sql).toMatch(/transfer_mode IS NULL/);
    });

    it('thickness_max_unlimited: usa candidateWhere personalizzato, non "campo IS NULL" (colonna NOT NULL)', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        const config = getReprocessableField('thickness_max_unlimited');

        await selectReprocessCandidates('thickness_max_unlimited', config, {});

        const [sql] = query.mock.calls[0];
        expect(sql).toMatch(/thickness_max_unlimited = 0 AND thickness_max_mm IS NULL/);
        expect(sql).not.toMatch(/thickness_max_unlimited IS NULL/);
    });
});

describe('guessDocType', () => {
    it('riconosce ISO 14732 vs default ISO 9606-1 (patentino_saldatore)', () => {
        expect(guessDocType('Operatore ISO 14732')).toBe('qualifica_14732');
        expect(guessDocType('Saldatore ISO 9606-1')).toBe('patentino_saldatore');
        expect(guessDocType('')).toBe('patentino_saldatore');
    });
});

/**
 * Generalizzazione 08/08/2026 — estensione del meccanismo di rielaborazione
 * alla WPQR (prima solo `qualifications`). Copre le specificità della tabella
 * `wpqr_records`: colonna reale diversa dalla chiave di registro
 * (`wpqr_thickness_max_unlimited` → `thickness_max_unlimited`), nessuna
 * esclusione `status != 'revocata'` (non esiste per la WPQR), filtro
 * `jointTypeWhitelist` (gola solo su giunti FW).
 */
describe('resolveExtractedReprocessValue — tabella wpqr_records', () => {
    it('wpqr_thickness_max_unlimited: usa config.column, propone solo true', () => {
        const config = { table: 'wpqr_records', column: 'thickness_max_unlimited' };
        expect(resolveExtractedReprocessValue('wpqr_thickness_max_unlimited', { thickness_max_unlimited: true }, config)).toBe(true);
        expect(resolveExtractedReprocessValue('wpqr_thickness_max_unlimited', { thickness_max_unlimited: false }, config)).toBeNull();
    });

    it('rotated_position: propone solo true (colonna NOT NULL default false)', () => {
        const config = { table: 'wpqr_records', column: 'rotated_position' };
        expect(resolveExtractedReprocessValue('rotated_position', { rotated_position: true }, config)).toBe(true);
        expect(resolveExtractedReprocessValue('rotated_position', { rotated_position: false }, config)).toBeNull();
    });

    it('campo testo generico (preheat_temp): passthrough via config.column', () => {
        const config = { table: 'wpqr_records', column: 'preheat_temp' };
        expect(resolveExtractedReprocessValue('preheat_temp', { preheat_temp: 'min 100 C' }, config)).toBe('min 100 C');
        expect(resolveExtractedReprocessValue('preheat_temp', {}, config)).toBeNull();
    });

    it('wpqr_thickness_t1_t2: bundle — oggetto se almeno un min, unlimited solo se true', () => {
        const config = getReprocessableField('wpqr_thickness_t1_t2');
        expect(resolveExtractedReprocessValue('wpqr_thickness_t1_t2', {
            thickness_t1_min: 5,
            thickness_t1_max_unlimited: true,
            thickness_t2_min: 8,
            thickness_t2_max: 20,
            thickness_t2_max_unlimited: false,
        }, config)).toEqual({
            thickness_t1_min: 5,
            thickness_t1_max_unlimited: true,
            thickness_t2_min: 8,
            thickness_t2_max: 20,
        });
        expect(resolveExtractedReprocessValue('wpqr_thickness_t1_t2', {
            thickness_t1_max: 10,
            thickness_t1_max_unlimited: false,
        }, config)).toBeNull();
        expect(resolveExtractedReprocessValue('wpqr_thickness_t1_t2', {}, config)).toBeNull();
    });
});

describe('selectReprocessCandidates — tabella wpqr_records', () => {
    afterEach(() => jest.clearAllMocks());

    it('interroga wpqr_records (non qualifications), senza esclusione "revocata" (non esiste per la WPQR)', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        const config = getReprocessableField('preheat_temp');

        await selectReprocessCandidates('preheat_temp', config, {});

        const [sql] = query.mock.calls[0];
        expect(sql).toMatch(/FROM wpqr_records/);
        expect(sql).not.toMatch(/revocata/);
        expect(sql).toMatch(/preheat_temp IS NULL/);
    });

    it('throat_test_mm: applica jointTypeWhitelist, scarta i candidati non FW', async () => {
        query.mockResolvedValueOnce({
            recordset: [
                { id: 1, organization_id: 1001, joint_type: 'FW', certificate_file_url: '/uploads/a.pdf' },
                { id: 2, organization_id: 1001, joint_type: 'BW', certificate_file_url: '/uploads/b.pdf' },
            ],
        });
        const config = getReprocessableField('throat_test_mm');

        const rows = await selectReprocessCandidates('throat_test_mm', config, {});

        expect(rows.map((r) => r.id)).toEqual([1]);
    });

    it('rotated_position: usa candidateWhere dedicato (piastra + PF/PA), non "campo IS NULL"', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        const config = getReprocessableField('rotated_position');

        await selectReprocessCandidates('rotated_position', config, {});

        const [sql] = query.mock.calls[0];
        expect(sql).toMatch(/rotated_position = 0 AND product_type = 'P'/);
        expect(sql).toMatch(/welding_positions LIKE '%PF%'/);
    });

    it('wpqr_thickness_max_unlimited: usa la colonna reale (column), non la chiave di registro, per il default IS NULL', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        const config = getReprocessableField('wpqr_thickness_max_unlimited');

        await selectReprocessCandidates('wpqr_thickness_max_unlimited', config, {});

        const [sql] = query.mock.calls[0];
        // candidateWhere esplicito già presente in questa voce: verificato che
        // non tenti mai "wpqr_thickness_max_unlimited IS NULL" (colonna inesistente).
        expect(sql).not.toMatch(/wpqr_thickness_max_unlimited/);
        expect(sql).toMatch(/thickness_max_unlimited = 0 AND thickness_max IS NULL/);
    });

    it('wpqr_thickness_t1_t2: candidateWhere duali NULL + solo giunti FW', async () => {
        query.mockResolvedValueOnce({
            recordset: [
                { id: 1, organization_id: 1003, joint_type: 'FW', certificate_file_url: '/uploads/a.pdf' },
                { id: 2, organization_id: 1003, joint_type: 'BW', certificate_file_url: '/uploads/b.pdf' },
            ],
        });
        const config = getReprocessableField('wpqr_thickness_t1_t2');

        const rows = await selectReprocessCandidates('wpqr_thickness_t1_t2', config, {});

        const [sql] = query.mock.calls[0];
        expect(sql).toMatch(/thickness_t1_min IS NULL AND thickness_t2_min IS NULL/);
        expect(rows.map((r) => r.id)).toEqual([1]);
    });
});

describe('runReprocessForField — end-to-end su wpqr_records', () => {
    afterEach(() => jest.clearAllMocks());

    it('rilancia la pipeline WPQR, mappa con wpqrIngest.mapPipelineFieldsToReview e crea la proposta con targetWpqrId (non targetQualificationId)', async () => {
        const fs = require('fs');
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('%PDF'));

        query.mockResolvedValueOnce({
            recordset: [{ id: 7, organization_id: 1001, company_id: 20, certificate_file_url: '/uploads/wpqr7.pdf' }],
        });
        query.mockResolvedValueOnce({ recordset: [] }); // hasPendingProposal

        runDocumentIngest.mockResolvedValue({
            text: 'WPQR test',
            fields: { preheat_temp: 'min 100 C' },
            fieldConfidence: {},
            extractionConfidence: 80,
            aiModel: 'test',
            warnings: [],
        });
        createStagingRecord.mockResolvedValue(999);

        const summary = await runReprocessForField('preheat_temp', {});

        expect(summary.proposalsCreated).toBe(1);
        expect(createStagingRecord).toHaveBeenCalledWith(expect.objectContaining({
            docType: 'wpqr',
            targetWpqrId: 7,
            targetQualificationId: null,
            fieldScope: 'preheat_temp',
            fields: expect.objectContaining({ preheat_temp: 'min 100 C' }),
        }));

        fs.existsSync.mockRestore();
        fs.readFileSync.mockRestore();
    });
});
