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
const { ingestWPQRFromPdf } = require('./wpqrIngest.service');

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
