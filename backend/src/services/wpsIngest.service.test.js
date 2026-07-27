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
const { extractWPSFromPdf, checkWpsPlausibility, commitWPSFromFields } = require('./wpsIngest.service');

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

/**
 * Test L1 — commitWPSFromFields, sanitizzazione numerica (stesso pattern del
 * bug produzione 27/07/2026 su qualificationIngest.service.js): thickness_range_min/max
 * su `welding_procedures` è DECIMAL(8,2) — "N.A."/stringa vuota non deve rompere l'INSERT.
 */
describe('commitWPSFromFields — sanitizzazione numerica', () => {
    afterEach(() => jest.clearAllMocks());

    it('salva null invece di crashare quando thickness_min/max sono "N.A." o vuoti', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // checkDuplicate
        query.mockResolvedValueOnce({ recordset: [{ id: 77 }] }); // INSERT

        const result = await commitWPSFromFields({
            wps_number: 'WPS-99',
            welding_process: '111',
            thickness_min_mm: 'N.A.',
            thickness_max_mm: '',
        }, 1001, 2001, { fileName: 'wps99.pdf' });

        expect(result.wps_id).toBe(77);
        const insertCall = query.mock.calls[1];
        expect(insertCall[1].thickness_range_min).toBeNull();
        expect(insertCall[1].thickness_range_max).toBeNull();
    });
});
