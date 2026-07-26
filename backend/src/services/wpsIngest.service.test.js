/**
 * @jest-environment node
 */

jest.mock('./documentIngestPipeline.service', () => ({
    runDocumentIngest: jest.fn(),
}));

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

const { runDocumentIngest } = require('./documentIngestPipeline.service');
const { query } = require('../config/database');
const { extractWPSFromPdf, checkWpsPlausibility } = require('./wpsIngest.service');

describe('checkWpsPlausibility (gap analysis 26/07/2026 — warning-only)', () => {
    it('nessun warning per campi plausibili e coerenti', () => {
        const warnings = checkWpsPlausibility({
            thickness_min_mm: 3, thickness_max_mm: 12,
            filler_material: 'G 42 4 M21 3Si1',
            shielding_gas: 'M21',
        });
        expect(warnings).toEqual([]);
    });

    it('segnala range spessore invertito', () => {
        const warnings = checkWpsPlausibility({ thickness_min_mm: 20, thickness_max_mm: 5 });
        expect(warnings.some((w) => w.includes('invertito'))).toBe(true);
    });

    it('segnala designazione filler non riconosciuta come ISO 14341', () => {
        const warnings = checkWpsPlausibility({ filler_material: '###???' });
        expect(warnings.some((w) => w.includes('ISO 14341'))).toBe(true);
    });

    it('segnala gas di protezione fuori catalogo ISO 14175', () => {
        const warnings = checkWpsPlausibility({ shielding_gas: 'GAS-INESISTENTE' });
        expect(warnings.some((w) => w.includes('ISO 14175'))).toBe(true);
    });
});

describe('extractWPSFromPdf — warning di plausibilità propagati', () => {
    afterEach(() => jest.clearAllMocks());

    it('include il warning di range spessore incoerente nell\'esito pending_review', async () => {
        runDocumentIngest.mockResolvedValue({
            text: 'WPS 12/25 processo 135',
            fields: {
                wps_number: 'WPS-12-25',
                welding_process: '135',
                thickness_min_mm: 20,
                thickness_max_mm: 5,
            },
            fieldConfidence: {},
            extractionConfidence: 70,
            aiModel: 'gemini-1.5-flash',
            warnings: [],
        });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await extractWPSFromPdf(Buffer.from('%PDF'), 'WPS-12-25.pdf', 1001, 2001);

        expect(out.status).toBe('pending_review');
        expect(out.warnings.some((w) => w.includes('invertito'))).toBe(true);
    });
});
