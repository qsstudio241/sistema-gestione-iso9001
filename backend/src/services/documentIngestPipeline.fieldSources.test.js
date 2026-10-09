/**
 * @jest-environment node
 *
 * Tracciabilita' della fonte per campo (fieldSources) e riga di log a fine ingest.
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

const logger = require('../utils/logger');
const { extractStructuredByDocType } = require('./importAiExtraction.service');
const { extractPdfText } = require('../utils/importPdfText');
const { getActiveProvider } = require('./aiProviderAdapter');
const { extractHeaderTextWithOCR } = require('../utils/ocrExtractor');
const {
    runDocumentIngest,
    mergeExtractions,
    pickMergedValue,
    buildFieldSourcesLogLine,
} = require('./documentIngestPipeline.service');

const NOME_SINTETICO = 'ZZQUALIFICATO SINTETICO';
const NUMERO_SINTETICO = '99-ZZ-0001';
const TESTO_14732 = [
    'Operator qualification certificate ISO 14732',
    `Name: ${NOME_SINTETICO} Certificate No: ${NUMERO_SINTETICO}`,
    '4.1 a) Welding procedure test ISO 15614 -',
    '4.1 b) Pre-production welding test ISO 15613 -',
    '4.1 c) Welder qualification test ISO 9606 [x]',
    '4.1 d) Production welding test -',
].join('\n');

function mockAi(typeSpecific) {
    getActiveProvider.mockReturnValue('gemini');
    extractStructuredByDocType.mockResolvedValue({
        model: 'gemini-test',
        data: { type_specific_data: typeSpecific },
    });
}

async function ingest(docType = 'qualifica_14732', text = TESTO_14732) {
    extractPdfText.mockResolvedValue(text);
    return runDocumentIngest({ pdfBuffer: Buffer.from('%PDF'), docType, fileName: `${NOME_SINTETICO}.pdf`, organizationId: 1 });
}

describe('fieldSources: nomi fonte uniformi (mergeExtractions / pickMergedValue)', () => {
    it('AI sola -> ai', () => {
        const m = mergeExtractions({}, { certificate_number: 'A-1' }, 'qualifica_14732');
        expect(m.fieldSources.certificate_number).toBe('ai');
    });

    it('regola sola -> rules', () => {
        const m = mergeExtractions({ certificate_number: 'A-1' }, {}, 'qualifica_14732');
        expect(m.fieldSources.certificate_number).toBe('rules');
    });

    it('AI e regola concordi -> ai+rules', () => {
        const m = mergeExtractions({ certificate_number: 'A-1' }, { certificate_number: 'a-1' }, 'qualifica_14732');
        expect(m.fieldSources.certificate_number).toBe('ai+rules');
    });

    it('AI production_test corretta dalla regola iso_9606 (layout) -> ai_corrected_by_rules', () => {
        const m = mergeExtractions({ qualification_method: 'iso_9606' }, { qualification_method: 'production_test' }, 'qualifica_14732');
        expect(m.fields.qualification_method).toBe('iso_9606');
        expect(m.fieldSources.qualification_method).toBe('ai_corrected_by_rules');
        expect(pickMergedValue('qualification_method', { qualification_method: 'iso_9606' }, { qualification_method: 'production_test' }, 'qualifica_14732').source)
            .toBe('ai_corrected_by_rules');
    });

    it('campo nullo -> nessuna voce in fieldSources', () => {
        const m = mergeExtractions({}, { certificate_number: 'A-1', expiry_date: null }, 'qualifica_14732');
        expect(Object.prototype.hasOwnProperty.call(m.fieldSources, 'expiry_date')).toBe(false);
        expect(m.fieldSources.certificate_number).toBe('ai');
    });
});

describe('runDocumentIngest: fieldSources e riga di log', () => {
    let infoSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.INGEST_HEADER_OCR;
        infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    });

    afterEach(() => infoSpy.mockRestore());

    const sourcesLines = () => infoSpy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('Fonti campi'));

    it('ente da OCR intestazione -> ocr_header; altri campi da ai; riga di log con soli nomi e fonti', async () => {
        mockAi({ qualification_method: 'iso_9606', expiry_date: '2030-01-31' });
        extractHeaderTextWithOCR.mockResolvedValue('TEC-Eurolab\nCERTIFICATION BODY');
        const out = await ingest();

        expect(out.fieldSources.issuing_body).toBe('ocr_header');
        expect(out.fieldSources.expiry_date).toBe('ai');
        expect(out.fieldSources.qualification_method).toMatch(/^(ai|ai\+rules)$/);

        const lines = sourcesLines();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('docType=qualifica_14732');
        expect(lines[0]).toContain('issuing_body=ocr_header');
        expect(lines[0]).toContain('expiry_date=ai');
        expect(lines[0]).toContain('examiner_body=none');
        expect(lines[0]).not.toContain(NOME_SINTETICO);
        expect(lines[0]).not.toContain(NUMERO_SINTETICO);
        expect(lines[0]).not.toContain('2030-01-31');
        expect(lines[0]).not.toContain('tec_eurolab');
        expect(lines[0]).not.toContain('.pdf');
    });

    it('solo regole (AI assente) -> rules nel log per i campi estratti dal testo', async () => {
        getActiveProvider.mockReturnValue(null);
        extractHeaderTextWithOCR.mockResolvedValue('');
        const out = await ingest();
        expect(out.fieldSources.certificate_number).toBe('rules');
        expect(sourcesLines()[0]).toContain('certificate_number=rules');
    });

    it('docType non qualifica (wpqr): nessuna riga Fonti campi, fieldSources invariato', async () => {
        mockAi({ wpqr_number: 'W-1' });
        const out = await ingest('wpqr', 'WPQR ISO 15614-1 procedure qualification record numero W-1 saldatura testo abbastanza lungo');
        expect(sourcesLines()).toHaveLength(0);
        expect(out.fieldSources).toBeDefined();
    });
});

describe('buildFieldSourcesLogLine', () => {
    it('elenca solo i campi chiave, none per i mancanti, ignora altri campi', () => {
        const line = buildFieldSourcesLogLine('patentino_saldatore', {
            qualification_method: 'ai_corrected_by_rules', issuing_body: 'ocr_header', welder_name: 'ai',
        });
        expect(line).toBe('[IngestPipeline] Fonti campi docType=patentino_saldatore'
            + ' qualification_method=ai_corrected_by_rules issuing_body=ocr_header examiner_body=none'
            + ' issue_date=none expiry_date=none certificate_number=none welding_process=none');
        expect(line).not.toContain('welder_name');
    });

    it('docType non qualifica -> null', () => {
        expect(buildFieldSourcesLogLine('wpqr', { issuing_body: 'ai' })).toBeNull();
        expect(buildFieldSourcesLogLine('norma', {})).toBeNull();
    });
});
