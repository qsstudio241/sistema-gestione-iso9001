/**
 * @jest-environment node
 *
 * Il layout OCR (righe con bbox) arriva dalla pipeline fino alla regola metodo 14732 §4.1.
 * Fixture sintetiche, nessun PDF reale.
 */

jest.mock('./aiProviderAdapter', () => ({ chat: jest.fn(), getActiveProvider: jest.fn(() => null) }));
jest.mock('./importAiExtraction.service', () => ({ extractStructuredByDocType: jest.fn() }));
jest.mock('../utils/importPdfText', () => ({
    extractPdfText: jest.fn(async () => ''),
    confidenceFromTextLength: jest.fn(() => 70),
}));
jest.mock('../utils/ocrExtractor', () => ({ extractTextWithOCR: jest.fn() }));

const { extractTextWithOCR } = require('../utils/ocrExtractor');
const { runDocumentIngest } = require('./documentIngestPipeline.service');

const OCR_TEXT = [
    'Certificato operatore ISO 14732',
    '4.1 a) Welding procedure test ISO 15614 -',
    '4.1 b) Pre-production welding test ISO 15613 -',
    '4.1 c) Welder qualification test ISO 9606',
    '4.1 d) Production welding test',
    'x',
].join('\n');

const LAYOUT_PAGE = {
    page: 1,
    lines: [
        { text: '4.1 a) Welding procedure test ISO 15614 -', bbox: { x0: 80, y0: 100, x1: 900, y1: 130 } },
        { text: '4.1 b) Pre-production welding test ISO 15613 -', bbox: { x0: 80, y0: 160, x1: 900, y1: 190 } },
        { text: '4.1 c) Welder qualification test ISO 9606', bbox: { x0: 80, y0: 220, x1: 900, y1: 250 } },
        { text: '4.1 d) Production welding test', bbox: { x0: 80, y0: 280, x1: 900, y1: 310 } },
        { text: 'x', bbox: { x0: 950, y0: 226, x1: 966, y1: 244 } },
    ],
};

describe('runDocumentIngest: layout OCR per qualifica_14732', () => {
    beforeEach(() => extractTextWithOCR.mockReset());

    it('qualifica_14732: chiede il layout all OCR e la regola assegna la x isolata alla riga c)', async () => {
        extractTextWithOCR.mockImplementation(async (_buf, opts) => {
            opts.layoutSink.push(LAYOUT_PAGE);
            return OCR_TEXT;
        });
        const out = await runDocumentIngest({ pdfBuffer: Buffer.from('%PDF'), docType: 'qualifica_14732', fileName: 'x.pdf' });
        expect(extractTextWithOCR).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({ maxPages: 3, lang: 'ita+eng', layoutSink: expect.any(Array) }));
        expect(out.ocrUsed).toBe(true);
        expect(out.ruleFields.qualification_method).toBe('iso_9606');
        expect(out.fields.qualification_method).toBe('iso_9606');
    });

    it('qualifica_14732 senza layout dall OCR (mock che non popola il sink): resta null/ambiguo', async () => {
        extractTextWithOCR.mockResolvedValue(OCR_TEXT);
        const out = await runDocumentIngest({ pdfBuffer: Buffer.from('%PDF'), docType: 'qualifica_14732', fileName: 'x.pdf' });
        expect(out.ruleFields.qualification_method).toBeNull();
    });

    it('altri docType: OCR chiamato con i soli parametri di prima (nessun layoutSink)', async () => {
        extractTextWithOCR.mockResolvedValue('Patentino saldatore ISO 9606-1 certificato numero 123 testo abbastanza lungo');
        await runDocumentIngest({ pdfBuffer: Buffer.from('%PDF'), docType: 'patentino_saldatore', fileName: 'p.pdf' });
        expect(extractTextWithOCR).toHaveBeenCalledWith(expect.any(Buffer), { maxPages: 3, lang: 'ita+eng' });
    });
});
