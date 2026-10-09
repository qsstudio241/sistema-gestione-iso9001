/**
 * @jest-environment node
 *
 * Ente certificatore da OCR dell'intestazione (prima pagina) per le qualifiche con livello di testo.
 * Fixture sintetiche: nessun PDF reale, nessun dato personale.
 */

jest.mock('./aiProviderAdapter', () => ({ chat: jest.fn(), getActiveProvider: jest.fn() }));
jest.mock('./importAiExtraction.service', () => ({ extractStructuredByDocType: jest.fn() }));
jest.mock('../utils/importPdfText', () => ({
    extractPdfText: jest.fn(),
    confidenceFromTextLength: jest.fn(() => 70),
}));
jest.mock('../utils/ocrExtractor', () => ({
    extractTextWithOCR: jest.fn(),
    extractHeaderTextWithOCR: jest.fn(),
}));

const { extractStructuredByDocType } = require('./importAiExtraction.service');
const { extractPdfText } = require('../utils/importPdfText');
const { getActiveProvider } = require('./aiProviderAdapter');
const { extractTextWithOCR, extractHeaderTextWithOCR } = require('../utils/ocrExtractor');
const {
    runDocumentIngest,
    applyHeaderIssuingBodyFallback,
    detectIssuingBodyCodeFromHeader,
} = require('./documentIngestPipeline.service');

const TEXT_SENZA_ENTE = 'Welder qualification certificate ISO 9606-1 135 P BW FM1 S t10 PA\n'
    + 'Name: MARIO ROSSI Certificate No: 25-00000-00-001 Date of test 10.01.2025\n'.repeat(2);

function mockAi(issuingBody) {
    getActiveProvider.mockReturnValue('gemini');
    extractStructuredByDocType.mockResolvedValue({
        model: 'gemini-test',
        data: { type_specific_data: issuingBody === undefined ? {} : { issuing_body: issuingBody } },
    });
}

async function ingest(docType = 'patentino_saldatore', text = TEXT_SENZA_ENTE) {
    extractPdfText.mockResolvedValue(text);
    return runDocumentIngest({ pdfBuffer: Buffer.from('%PDF'), docType, fileName: 'x.pdf', organizationId: 1 });
}

describe('OCR intestazione: aggancio alla pipeline', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.INGEST_HEADER_OCR;
    });

    it.each([
        ['TEC-Eurolab'],
        ['TEC:Eurolab'],
        ['A) TEC-Eurolab\nCERTIFICATION BODY'],
        ['\u00ABA TEC-Eurolab\nCERTIFICATION BODY'],
    ])('(ii) ente assente dal testo, OCR intestazione %j -> tec_eurolab + avviso', async (header) => {
        mockAi(null);
        extractHeaderTextWithOCR.mockResolvedValue(header);
        const out = await ingest();
        expect(extractHeaderTextWithOCR).toHaveBeenCalledTimes(1);
        expect(extractHeaderTextWithOCR.mock.calls[0][1]).toEqual(expect.objectContaining({ pageNumber: 1 }));
        expect(out.fields.issuing_body).toBe('tec_eurolab');
        expect(out.fieldSources.issuing_body).toBe('ocr_header');
        expect(out.fieldConfidence.issuing_body).toBe('medium');
        expect(out.warnings.some((w) => w.includes('OCR dell\'intestazione') && w.includes('verificare'))).toBe(true);
    });

    it('vale anche per qualifica_14732', async () => {
        mockAi(null);
        extractHeaderTextWithOCR.mockResolvedValue('TEC-Eurolab\nCERTIFICATION BODY');
        const out = await ingest('qualifica_14732');
        expect(out.fields.issuing_body).toBe('tec_eurolab');
    });

    it('(i) ente gia nel testo -> nessun OCR', async () => {
        mockAi(null);
        const out = await ingest('patentino_saldatore', `${TEXT_SENZA_ENTE}\nTEC Eurolab S.r.l. Campogalliano`);
        expect(extractHeaderTextWithOCR).not.toHaveBeenCalled();
        expect(out.fields.issuing_body).toBe('tec_eurolab');
        expect(out.fieldSources.issuing_body).not.toBe('ocr_header');
    });

    it('(iii) OCR vuoto -> ente invariato, nessuna eccezione', async () => {
        mockAi('altro');
        extractHeaderTextWithOCR.mockResolvedValue('');
        const out = await ingest();
        expect(out.fields.issuing_body).toBe('altro');
        expect(out.warnings.some((w) => w.includes('OCR dell\'intestazione'))).toBe(false);
    });

    it('(iii) OCR in errore o timeout -> ente invariato, nessuna eccezione', async () => {
        mockAi(null);
        extractHeaderTextWithOCR.mockRejectedValue(new Error('[OCR] Timeout OCR intestazione dopo 20000 ms'));
        const out = await ingest();
        expect(out.fields.issuing_body).toBeUndefined();
        expect(out.fields.certificate_number).toBeDefined();
    });

    it('(iii) OCR senza enti noti -> ente invariato', async () => {
        mockAi('altro');
        extractHeaderTextWithOCR.mockResolvedValue('ACME Welding Institute\nCERTIFICATION BODY');
        const out = await ingest();
        expect(out.fields.issuing_body).toBe('altro');
    });

    it('(iv) ente valido dall AI (diverso da altro) non viene mai sovrascritto, ne OCR invocato', async () => {
        mockAi('RINA');
        const out = await ingest();
        expect(extractHeaderTextWithOCR).not.toHaveBeenCalled();
        expect(out.fields.issuing_body).toBe('rina');
    });

    it('(v) ente "altro" dall AI + OCR rileva ente -> sostituito', async () => {
        mockAi('Ente sconosciuto SRL');
        extractHeaderTextWithOCR.mockResolvedValue('TEC:Eurolab');
        const out = await ingest();
        expect(out.fields.issuing_body).toBe('tec_eurolab');
    });

    it.each(['wpqr', 'wps', 'norma', 'cert_ndt', 'report_ndt'])('(vi) doc_type %s -> OCR intestazione non invocato', async (docType) => {
        mockAi(null);
        await ingest(docType);
        expect(extractHeaderTextWithOCR).not.toHaveBeenCalled();
    });

    it('(vii) PDF gia letto con OCR completo -> nessun doppio OCR', async () => {
        mockAi(null);
        extractTextWithOCR.mockResolvedValue(TEXT_SENZA_ENTE);
        const out = await ingest('patentino_saldatore', '');
        expect(extractTextWithOCR).toHaveBeenCalledTimes(1);
        expect(out.ocrUsed).toBe(true);
        expect(extractHeaderTextWithOCR).not.toHaveBeenCalled();
    });

    it('INGEST_HEADER_OCR=0 disattiva la funzione', async () => {
        process.env.INGEST_HEADER_OCR = '0';
        mockAi(null);
        await ingest();
        expect(extractHeaderTextWithOCR).not.toHaveBeenCalled();
    });
});

describe('OCR intestazione: mappatura enti dalla lista chiusa', () => {
    it.each([
        ['T\u00DCV S\u00DCD Industrie Service\nCertification body', 'tuv'],
        ['Bureau Veritas Italia S.p.A.', 'bv'],
        ['DNV  Certification', 'dnv'],
        ['RINA Services S.p.A.', 'rina'],
        ['IMQ S.p.A.', 'imq'],
        ['Sideius S.r.l.', 'sideius'],
        ['TEC Eurolab S.r.L', 'tec_eurolab'],
        ['info@tec-eurolab.com', 'tec_eurolab'],
    ])('(viii) %j -> %s', (header, code) => {
        expect(detectIssuingBodyCodeFromHeader(header)).toBe(code);
    });

    it.each([[''], [null], ['Intestazione generica CERTIFICATION BODY'], ['Katerina Bianchi']])(
        'nessun ente noto: %j -> null',
        (header) => expect(detectIssuingBodyCodeFromHeader(header)).toBeNull()
    );

    it.each([
        ['ACME BV Holding S.p.A.'],
        ['Euro Lab Service S.r.l.'],
        ['Eurolab Instruments'],
        ['CSQ Certiquality'],
        ['Valor Italia\nStatuto tuvalu'],
    ])('nessun match libero sul testo OCR: %j -> null', (header) => {
        expect(detectIssuingBodyCodeFromHeader(header)).toBeNull();
    });

    it('IIS resta fuori lista chiusa del backend (come il normalizzatore AI): nessuna sostituzione', () => {
        expect(detectIssuingBodyCodeFromHeader('Istituto Italiano della Saldatura IIS')).toBeNull();
    });
});

describe('applyHeaderIssuingBodyFallback (funzione isolata)', () => {
    beforeEach(() => { delete process.env.INGEST_HEADER_OCR; });

    const base = () => ({
        pdfBuffer: Buffer.from('%PDF'), docType: 'patentino_saldatore', text: TEXT_SENZA_ENTE, ocrUsed: false,
        fields: {}, fieldConfidence: {}, fieldSources: {}, warnings: [], fileName: 'x.pdf',
    });

    it('usa l OCR iniettato e popola campi/provenance/avviso', async () => {
        const args = base();
        const headerOcr = jest.fn().mockResolvedValue('TEC-Eurolab');
        await expect(applyHeaderIssuingBodyFallback({ ...args, headerOcr })).resolves.toBe(true);
        expect(args.fields.issuing_body).toBe('tec_eurolab');
        expect(args.warnings).toHaveLength(1);
    });

    it('senza funzione OCR disponibile (moduli assenti) non fa nulla', async () => {
        const args = base();
        await expect(applyHeaderIssuingBodyFallback({ ...args, headerOcr: null })).resolves.toBe(false);
        expect(args.fields.issuing_body).toBeUndefined();
    });
});
