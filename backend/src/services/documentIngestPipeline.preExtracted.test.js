/**
 * @jest-environment node
 *
 * runDocumentIngest con `preExtracted`: nessuna seconda lettura/OCR del PDF; il layout OCR
 * conta solo per qualifica_14732. Fixture sintetiche.
 */

jest.mock('./aiProviderAdapter', () => ({ chat: jest.fn(), getActiveProvider: jest.fn(() => null) }));
jest.mock('./importAiExtraction.service', () => ({ extractStructuredByDocType: jest.fn() }));
jest.mock('../utils/importPdfText', () => ({
    extractPdfText: jest.fn(async () => 'testo riletto dal pdf, abbastanza lungo da non attivare il fallback OCR'),
    confidenceFromTextLength: jest.fn(() => 70),
}));
jest.mock('../utils/ocrExtractor', () => ({
    extractTextWithOCR: jest.fn(),
    extractHeaderTextWithOCR: jest.fn(),
}));

const { extractPdfText } = require('../utils/importPdfText');
const { extractTextWithOCR } = require('../utils/ocrExtractor');
const { runDocumentIngest } = require('./documentIngestPipeline.service');

describe('runDocumentIngest: preExtracted', () => {
    beforeEach(() => jest.clearAllMocks());

    it('usa il testo fornito: nessun pdf-parse né OCR; avvisi di estrazione conservati', async () => {
        const out = await runDocumentIngest({
            pdfBuffer: Buffer.from('x'),
            docType: 'cert_ndt',
            fileName: 'a.pdf',
            preExtracted: { text: 'Certificato ISO 9712 sintetico UT livello 2', ocrUsed: true, warnings: ['avviso lettura'] },
        });
        expect(extractPdfText).not.toHaveBeenCalled();
        expect(extractTextWithOCR).not.toHaveBeenCalled();
        expect(out.text).toBe('Certificato ISO 9712 sintetico UT livello 2');
        expect(out.ocrUsed).toBe(true);
        expect(out.warnings).toEqual(expect.arrayContaining(['avviso lettura', 'Estrazione via OCR \u2014 verificare accuratezza dati']));
    });

    it('senza preExtracted: comportamento storico (legge il PDF)', async () => {
        const out = await runDocumentIngest({ pdfBuffer: Buffer.from('x'), docType: 'cert_ndt', fileName: 'a.pdf' });
        expect(extractPdfText).toHaveBeenCalledTimes(1);
        expect(out.text).toMatch(/^testo riletto dal pdf/);
    });
});
