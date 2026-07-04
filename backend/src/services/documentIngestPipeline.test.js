/**
 * @jest-environment node
 */

jest.mock('./aiProviderAdapter', () => ({
    chat: jest.fn(),
    getActiveProvider: jest.fn(),
}));

jest.mock('./importAiExtraction.service', () => ({
    extractStructuredByDocType: jest.fn(),
}));

jest.mock('../utils/importPdfText', () => ({
    extractPdfText: jest.fn(),
    confidenceFromTextLength: jest.fn(() => 70),
}));

const { extractStructuredByDocType } = require('./importAiExtraction.service');
const { extractPdfText } = require('../utils/importPdfText');
const { chat, getActiveProvider } = require('./aiProviderAdapter');
const {
    runDocumentIngest,
    mergeExtractions,
    extractFieldsByAi,
} = require('./documentIngestPipeline.service');
const { parseJsonWithRepair } = require('../utils/jsonRepair');
const { extractFieldsByRules } = require('../utils/ruleFieldExtractors');

describe('parseJsonWithRepair', () => {
    it('parsa JSON con fence markdown', () => {
        const out = parseJsonWithRepair('```json\n{"a":1}\n```');
        expect(out.a).toBe(1);
    });

    it('recupera oggetto da testo sporco', () => {
        const out = parseJsonWithRepair('Ecco i dati: {"reference_number": "21-02906", "welding_process": "135"} fine');
        expect(out.reference_number).toBe('21-02906');
        expect(out.welding_process).toBe('135');
    });

    it('lancia AI_INVALID_JSON se irrecuperabile', () => {
        expect(() => parseJsonWithRepair('{"broken": ')).toThrow();
        try {
            parseJsonWithRepair('{"broken": ');
        } catch (e) {
            expect(e.code).toBe('AI_INVALID_JSON');
        }
    });
});

describe('extractFieldsByRules', () => {
    it('estrae WPQR da testo e nome file', () => {
        const text = 'WPQR 21-02906 processo 135 gruppo materiale 1.1 spessore 10 mm data 15/03/2024 Bureau Veritas';
        const fields = extractFieldsByRules(text, 'wpqr', '21-02906.pdf');
        expect(fields.wpqr_number || fields.reference_number).toBe('21-02906');
        expect(fields.welding_process).toBe('135');
        expect(fields.material_group).toBe('1.1');
    });
});

describe('mergeExtractions', () => {
    it('preferisce AI e marca high se coincide con regole', () => {
        const { fields, fieldConfidence, fieldSources } = mergeExtractions(
            { welding_process: '135', wpqr_number: '21-02906' },
            { welding_process: '135', wpqr_number: '21-02906' },
            'wpqr'
        );
        expect(fields.welding_process).toBe('135');
        expect(fieldConfidence.welding_process).toBe('high');
        expect(fieldSources.welding_process).toBe('ai+rules');
    });

    it('usa regole se AI vuota', () => {
        const { fields, fieldSources } = mergeExtractions(
            { welding_process: '141' },
            {},
            'wpqr'
        );
        expect(fields.welding_process).toBe('141');
        expect(fieldSources.welding_process).toBe('rules');
    });
});

describe('extractFieldsByAi retry', () => {
    afterEach(() => jest.clearAllMocks());

    it('ritenta con chat se JSON AI primario invalido', async () => {
        getActiveProvider.mockReturnValue('gemini');
        const err = new Error('Unexpected token');
        err.code = 'AI_INVALID_JSON';
        extractStructuredByDocType.mockRejectedValue(err);
        chat.mockResolvedValue({
            content: '{"wpqr_number":"21-02906","welding_process":"135"}',
            model: 'gemini-1.5-flash',
        });

        const { fields, warnings } = await extractFieldsByAi(
            'WPQR 21-02906 processo 135 lungo testo '.repeat(5),
            'wpqr',
            '21-02906.pdf'
        );
        expect(fields.welding_process).toBe('135');
        expect(warnings.some((w) => w.includes('retry'))).toBe(true);
    });
});

describe('runDocumentIngest', () => {
    afterEach(() => jest.clearAllMocks());

    it('produce fields e confidence per wpqr', async () => {
        extractPdfText.mockResolvedValue(
            'WPQR 21-02906 ISO 4063 135 gruppo 1.1 spessore 12 mm Bureau Veritas 01/01/2024'
        );
        getActiveProvider.mockReturnValue('gemini');
        extractStructuredByDocType.mockResolvedValue({
            model: 'gemini-1.5-flash',
            data: {
                type_specific_data: {
                    wpqr_number: '21-02906',
                    welding_process: '135',
                    material_group: '1.1',
                    thickness_test_mm: 12,
                },
            },
        });

        const out = await runDocumentIngest({
            pdfBuffer: Buffer.from('%PDF'),
            docType: 'wpqr',
            fileName: '21-02906.pdf',
            organizationId: 1001,
        });

        expect(out.fields.welding_process).toBe('135');
        expect(out.fieldConfidence.welding_process).toBe('high');
        expect(out.extractionConfidence).toBeGreaterThan(0);
        expect(out.warnings).toBeDefined();
    });

    it('non crasha se AI fallisce — usa regole', async () => {
        extractPdfText.mockResolvedValue('WPQR 21-02906 processo 135');
        getActiveProvider.mockReturnValue(null);

        const out = await runDocumentIngest({
            pdfBuffer: Buffer.from('%PDF'),
            docType: 'wpqr',
            fileName: '21-02906.pdf',
        });

        expect(out.fields.welding_process).toBe('135');
        expect(out.warnings.some((w) => w.includes('AI non configurata'))).toBe(true);
    });

    it('produce fields e confidence per norma', async () => {
        extractPdfText.mockResolvedValue(
            'ISO/TR 15608:2013 Welding — Grouping system for materials 2013'
        );
        getActiveProvider.mockReturnValue('gemini');
        extractStructuredByDocType.mockResolvedValue({
            model: 'gemini-1.5-flash',
            data: {
                type_specific_data: {
                    standard_code: 'ISO/TR 15608:2013',
                    norm_title: 'Grouping system for materials',
                    issuing_body: 'ISO',
                    edition_year: 2013,
                },
            },
        });

        const out = await runDocumentIngest({
            pdfBuffer: Buffer.from('%PDF'),
            docType: 'norma',
            fileName: 'ISO_TR_15608_2013.pdf',
            organizationId: 1001,
        });

        expect(out.fields.standard_code).toBeTruthy();
        expect(out.extractionConfidence).toBeGreaterThan(0);
    });

    it('rifiuta docType non supportato', async () => {
        await expect(
            runDocumentIngest({
                pdfBuffer: Buffer.from('x'),
                docType: 'certificato_materiale',
                fileName: 'x.pdf',
            })
        ).rejects.toMatchObject({ code: 'UNSUPPORTED_DOC_TYPE' });
    });
});
