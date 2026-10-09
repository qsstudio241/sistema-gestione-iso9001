/**
 * @jest-environment node
 *
 * Privacy log: il nome file (puo' contenere il titolare) non compare in nessuna riga di log della pipeline.
 * Fixture sintetiche: nomi fittizi.
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
const { redactFileNameForLog } = require('../utils/ingestErrorMessage');
const { extractStructuredByDocType } = require('./importAiExtraction.service');
const { extractPdfText } = require('../utils/importPdfText');
const { getActiveProvider, chat } = require('./aiProviderAdapter');
const { extractHeaderTextWithOCR } = require('../utils/ocrExtractor');
const { runDocumentIngest } = require('./documentIngestPipeline.service');

const FILE_NAME = '99-00000_ZZROSSI ZZMARIO_14732_X.pdf';
const REDACTED = redactFileNameForLog(FILE_NAME);
const TEXT = 'Welder qualification certificate ISO 9606-1 135 P BW FM1 S t10 PA\n'
    + 'Name: ZZTITOLARE Certificate No: 25-00000-00-001 Date of test 10.01.2025\n'.repeat(2);

let spies;
const allLogged = () => spies.flatMap((s) => s.mock.calls.map((c) => JSON.stringify(c))).join('\n');
const logLines = () => spies.flatMap((s) => s.mock.calls.map((c) => String(c[0])));

function expectNoFileName() {
    const logged = allLogged();
    for (const leak of ['ZZROSSI', 'ZZMARIO', '99-00000', FILE_NAME, '14732_X']) {
        expect(logged).not.toContain(leak);
    }
}

async function ingest(docType = 'patentino_saldatore') {
    extractPdfText.mockResolvedValue(TEXT);
    return runDocumentIngest({ pdfBuffer: Buffer.from('%PDF'), docType, fileName: FILE_NAME, organizationId: 1 });
}

describe('pipeline: nessun nome file nei log', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.INGEST_HEADER_OCR;
        spies = ['info', 'warn', 'error', 'debug'].map((m) => jest.spyOn(logger, m).mockImplementation(() => {}));
        getActiveProvider.mockReturnValue('gemini');
        extractStructuredByDocType.mockResolvedValue({ model: 'gemini-test', data: { type_specific_data: {} } });
    });

    afterEach(() => spies.forEach((s) => s.mockRestore()));

    it('OCR intestazione riuscito: riga con file#hash, nessun nome; ente e ms restano', async () => {
        extractHeaderTextWithOCR.mockResolvedValue('TEC-Eurolab\nCERTIFICATION BODY');
        const out = await ingest();
        const line = logLines().find((l) => l.includes('OCR intestazione'));
        expect(line).toContain(`file=${REDACTED}`);
        expect(line).toContain('ente=tec_eurolab');
        expect(line).toMatch(/ms=\d+/);
        expect(out.fields.issuing_body).toBe('tec_eurolab');
        expectNoFileName();
    });

    it('OCR intestazione non riuscito (warn): nessun nome file', async () => {
        extractHeaderTextWithOCR.mockRejectedValue(new Error('[OCR] Timeout OCR intestazione dopo 20000 ms'));
        const out = await ingest();
        const line = logLines().find((l) => l.includes('OCR intestazione non riuscito'));
        expect(line).toContain(`file=${REDACTED}`);
        expect(out.fields.certificate_number).toBeDefined();
        expectNoFileName();
    });

    it('AI primary failed (senza retry): nessun nome file', async () => {
        extractHeaderTextWithOCR.mockResolvedValue('');
        extractStructuredByDocType.mockRejectedValue(new Error('timeout provider'));
        const out = await ingest();
        expect(logLines().some((l) => l.includes('AI primary failed'))).toBe(true);
        expect(out.warnings.some((w) => w.includes('timeout provider'))).toBe(true);
        expectNoFileName();
    });

    it('AI retry fallito (dump risposte): nessun nome file', async () => {
        extractHeaderTextWithOCR.mockResolvedValue('');
        const err = new Error('risposta non JSON');
        err.code = 'AI_INVALID_JSON';
        extractStructuredByDocType.mockRejectedValue(err);
        chat.mockRejectedValue(new Error('retry KO'));
        await ingest();
        expect(logLines().some((l) => l.includes('AI retry fallito'))).toBe(true);
        expectNoFileName();
    });

    it('Completato e Fonti campi: file hashato, nessun nome; i campi estratti non cambiano', async () => {
        extractHeaderTextWithOCR.mockResolvedValue('');
        extractStructuredByDocType.mockResolvedValue({ model: 'gemini-test', data: { type_specific_data: { expiry_date: '2030-01-31' } } });
        const out = await ingest();
        expect(spies[0].mock.calls.some((c) => c[0] === '[IngestPipeline] Completato' && c[1].file === REDACTED)).toBe(true);
        expect(spies[0].mock.calls.some((c) => c[1] && 'fileName' in c[1])).toBe(false);
        expect(out.fields.expiry_date).toBe('2030-01-31');
        expect(out.fileName).toBe(FILE_NAME);
        expectNoFileName();
    });

    it('stesso nome -> stesso hash tra le righe dello stesso ingest (correlabili)', async () => {
        extractHeaderTextWithOCR.mockResolvedValue('TEC-Eurolab\nCERTIFICATION BODY');
        await ingest();
        const withFile = logLines().filter((l) => l.includes('file='));
        expect(withFile.length).toBeGreaterThan(0);
        withFile.forEach((l) => expect(l).toContain(REDACTED));
    });
});

describe('pipeline: nessun dato personale estratto nei log (risposte AI, estratti JSON)', () => {
    const PII = ['ZZTITOLARE', 'ZZCOGNOME', 'ZZ-CF-0001'];

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.INGEST_HEADER_OCR;
        spies = ['info', 'warn', 'error', 'debug'].map((m) => jest.spyOn(logger, m).mockImplementation(() => {}));
        getActiveProvider.mockReturnValue('gemini');
        extractHeaderTextWithOCR.mockResolvedValue('');
    });

    afterEach(() => spies.forEach((s) => s.mockRestore()));

    const expectNoPii = () => {
        const logged = allLogged();
        for (const leak of PII) expect(logged).not.toContain(leak);
    };

    it('AI retry fallito: dump delle risposte sostituito dalle sole lunghezze', async () => {
        const err = new Error('JSON dalla AI non valido.');
        err.code = 'AI_INVALID_JSON';
        err.rawContent = '{"welder_name":"ZZTITOLARE ZZCOGNOME","fiscal_code":"ZZ-CF-0001" oops';
        extractStructuredByDocType.mockRejectedValue(err);
        const retryErr = new Error('retry KO');
        retryErr.rawContent = '{"welder_name":"ZZTITOLARE ZZCOGNOME"';
        chat.mockRejectedValue(retryErr);

        await ingest();

        const meta = spies[1].mock.calls.find((c) => String(c[0]).includes('AI retry fallito'))[1];
        expect(meta.primaryRawChars).toBe(err.rawContent.length);
        expect(meta.retryRawChars).toBe(retryErr.rawContent.length);
        expect(meta).not.toHaveProperty('primaryRawSample');
        expect(meta).not.toHaveProperty('retryRawSample');
        expectNoPii();
    });

    it('AI retry con JSON non valido: l\'estratto del testo nel messaggio di JSON.parse non finisce nei log', async () => {
        const err = new Error('JSON dalla AI non valido.');
        err.code = 'AI_INVALID_JSON';
        extractStructuredByDocType.mockRejectedValue(err);
        chat.mockResolvedValue({ content: 'ZZTITOLARE ZZCOGNOME ZZ-CF-0001', model: 'm' });

        const out = await ingest();

        expect(logLines().some((l) => l.includes('AI retry fallito'))).toBe(true);
        expect(out.fields).toBeDefined();
        expectNoPii();
    });

    it('AI primary failed con SyntaxError che cita il testo: messaggio e stack senza estratto', async () => {
        const err = new SyntaxError('Unexpected token \'Z\', "{ZZTITOLARE ZZCOGNOME" is not valid JSON');
        extractStructuredByDocType.mockRejectedValue(err);

        await ingest();

        const meta = spies[1].mock.calls.find((c) => String(c[0]).includes('AI primary failed'))[1];
        expect(meta.error).toContain('is not valid JSON');
        expect(meta.error).toContain('Unexpected token');
        expectNoPii();
    });
});
