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

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('./documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));
jest.mock('./ingestStaging.service', () => ({ createStagingRecord: jest.fn() }));

const { query } = require('../config/database');
const {
    selectReprocessCandidates,
    resolveExtractedReprocessValue,
    guessDocType,
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
