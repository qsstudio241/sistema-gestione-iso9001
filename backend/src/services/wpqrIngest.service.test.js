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
const { ingestWPQRFromPdf, extractWPQRFromPdf, checkWpqrPlausibility, commitWPQRFromFields } = require('./wpqrIngest.service');

describe('ingestWPQRFromPdf (IG-2)', () => {
    afterEach(() => jest.clearAllMocks());

    it('usa campi pipeline e inserisce WPQR', async () => {
        runDocumentIngest.mockResolvedValue({
            text: 'WPQR 21-02906 processo 135 ISO 15614',
            fields: {
                wpqr_number: '21-02906',
                welding_process: '135',
                material_group: '1.1',
                thickness_test_mm: 12,
            },
            fieldConfidence: { welding_process: 'high' },
            extractionConfidence: 80,
            aiModel: 'gemini-1.5-flash',
            warnings: [],
        });
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [{ id: 42 }] });

        const out = await ingestWPQRFromPdf(
            Buffer.from('%PDF'),
            '21-02906.pdf',
            1001,
            2001,
            { userId: 1 }
        );

        expect(runDocumentIngest).toHaveBeenCalledWith(expect.objectContaining({ docType: 'wpqr' }));
        expect(out.status).toBe('ok');
        expect(out.wpqr_id).toBe(42);
        expect(out.reference_number).toBe('21-02906');
        expect(out.welding_process).toBe('135');
        expect(out.confidence).toBe('alta');
    });

    it('non crasha se AI fallisce ma regole riempiono campi', async () => {
        runDocumentIngest.mockResolvedValue({
            text: 'WPQR 21-02906 processo 135',
            fields: { reference_number: '21-02906', welding_process: '135' },
            fieldConfidence: { welding_process: 'medium' },
            extractionConfidence: 45,
            aiModel: null,
            warnings: ['AI retry fallito: x'],
        });
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [{ id: 9 }] });

        const out = await ingestWPQRFromPdf(Buffer.from('%PDF'), '21-02906.pdf', 1001, 2001, {});

        expect(out.status).toBe('ok');
        expect(out.wpqr_id).toBe(9);
        expect(out.warnings.some((w) => w.includes('AI'))).toBe(true);
        expect(out.confidence).toBe('bassa');
    });
});

describe('checkWpqrPlausibility (gap analysis 26/07/2026 — warning-only)', () => {
    it('nessun warning per campi plausibili e coerenti', () => {
        const warnings = checkWpqrPlausibility({
            approval_date: '2024-04-17',
            expiry_date: '2027-04-16',
            thickness_min: 3, thickness_max: 12,
            diameter_min: 100, diameter_max: 500,
            filler_material: 'G 42 4 M21 3Si1',
            shielding_gas: 'M21',
        });
        expect(warnings).toEqual([]);
    });

    it('segnala scadenza anteriore alla data di emissione', () => {
        const warnings = checkWpqrPlausibility({
            approval_date: '2024-04-17',
            expiry_date: '2020-01-01',
        });
        expect(warnings.some((w) => w.includes('scadenza'))).toBe(true);
    });

    it('segnala range spessore invertito', () => {
        const warnings = checkWpqrPlausibility({ thickness_min: 20, thickness_max: 5 });
        expect(warnings.some((w) => w.includes('invertito'))).toBe(true);
    });

    it('segnala designazione filler non riconosciuta come ISO 14341', () => {
        const warnings = checkWpqrPlausibility({ filler_material: '###???' });
        expect(warnings.some((w) => w.includes('ISO 14341'))).toBe(true);
    });

    it('segnala gas di protezione fuori catalogo ISO 14175', () => {
        const warnings = checkWpqrPlausibility({ shielding_gas: 'GAS-INESISTENTE' });
        expect(warnings.some((w) => w.includes('ISO 14175'))).toBe(true);
    });
});

/**
 * Test L1 — commitWPQRFromFields, sanitizzazione numerica (gap hardening
 * 27/07/2026, stesso pattern del bug produzione su qualificationIngest.service.js
 * e wpsIngest.service.js): thickness_tested/thickness_min/thickness_max/
 * diameter_min/diameter_max su `wpqr_records` sono colonne DECIMAL —
 * "N.A."/stringa vuota/range testuale non deve mai rompere l'INSERT.
 */
describe('commitWPQRFromFields — sanitizzazione numerica', () => {
    afterEach(() => jest.clearAllMocks());

    it('salva null invece di crashare quando i campi spessore/diametro sono "N.A." o vuoti', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // checkDuplicate
        query.mockResolvedValueOnce({ recordset: [{ id: 88 }] }); // INSERT

        const result = await commitWPQRFromFields({
            wpqr_number: 'WPQR-99',
            welding_process: '111',
            thickness_test_mm: 'N.A.',
            thickness_min: '',
            thickness_max: 'N.A.',
            diameter_min: '',
            diameter_max: 'N.A.',
        }, 1001, 2001, { fileName: 'wpqr99.pdf' });

        expect(result.wpqr_id).toBe(88);
        const insertCall = query.mock.calls[1];
        expect(insertCall[1].thickness_tested).toBeNull();
        expect(insertCall[1].thickness_min).toBeNull();
        expect(insertCall[1].thickness_max).toBeNull();
        expect(insertCall[1].diameter_min).toBeNull();
        expect(insertCall[1].diameter_max).toBeNull();
    });

    it('converte la virgola decimale italiana su thickness_test_mm senza crashare', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // checkDuplicate
        query.mockResolvedValueOnce({ recordset: [{ id: 89 }] }); // INSERT

        const result = await commitWPQRFromFields({
            wpqr_number: 'WPQR-100',
            welding_process: '111',
            thickness_test_mm: '12,5',
        }, 1001, 2001, { fileName: 'wpqr100.pdf' });

        expect(result.wpqr_id).toBe(89);
        const insertCall = query.mock.calls[1];
        expect(insertCall[1].thickness_tested).toBe(12.5);
        // Range non dichiarato → calcolato dal fallback esistente (calcThicknessRange).
        expect(insertCall[1].thickness_min).not.toBeNull();
        expect(insertCall[1].thickness_max).not.toBeNull();
    });
});

describe('extractWPQRFromPdf — warning di plausibilità propagati', () => {
    it('include il warning di scadenza incoerente nell\'esito pending_review', async () => {
        runDocumentIngest.mockResolvedValue({
            text: 'WPQR 21-02906 processo 135',
            fields: {
                wpqr_number: '21-02906',
                welding_process: '135',
                approval_date: '2024-04-17',
                expiry_date: '2020-01-01',
            },
            fieldConfidence: {},
            extractionConfidence: 70,
            aiModel: 'gemini-1.5-flash',
            warnings: [],
        });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await extractWPQRFromPdf(Buffer.from('%PDF'), '21-02906.pdf', 1001, 2001);

        expect(out.status).toBe('pending_review');
        expect(out.warnings.some((w) => w.includes('scadenza'))).toBe(true);
    });
});
