/**
 * @jest-environment node
 *
 * Affidabilita' dell'ente certificatore (qualifiche): ente dato dall'AI senza riscontro nel testo ->
 * OCR della sola intestazione che prevale sull'AI; se l'OCR non conferma -> «da verificare» (`ai_unverified`).
 * Fixture sintetiche: nessun PDF reale, nessun dato personale. OCR mockato.
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
const { extractTextWithOCR, extractHeaderTextWithOCR } = require('../utils/ocrExtractor');
const { extractAllIssuingBodies } = require('../utils/ruleFieldExtractors');
const { runDocumentIngest, applyHeaderIssuingBodyFallback } = require('./documentIngestPipeline.service');

const TEXT_SENZA_ENTE = 'Welder qualification certificate ISO 9606-1 135 P BW FM1 S t10 PA\n'
    + 'Name: MARIO ROSSI Certificate No: 25-00000-00-001 Date of test 10.01.2025\n'.repeat(2);

const UNVERIFIED = 'Ente indicato dall\'AI senza riscontro nel documento';
const isUnverified = (w) => w.includes(UNVERIFIED) && w.includes('verificare');
const isEnteWarning = (w) => /^Ente (indicato|corretto|rilevato)/.test(w);

function mockAi(issuingBody) {
    getActiveProvider.mockReturnValue('gemini');
    extractStructuredByDocType.mockResolvedValue({
        model: 'gemini-test',
        data: { type_specific_data: issuingBody === undefined ? {} : { issuing_body: issuingBody } },
    });
}

async function ingest(docType = 'patentino_saldatore', text = TEXT_SENZA_ENTE, fileName = 'ROSSI MARIO.pdf') {
    extractPdfText.mockResolvedValue(text);
    return runDocumentIngest({ pdfBuffer: Buffer.from('%PDF'), docType, fileName, organizationId: 1 });
}

beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.INGEST_HEADER_OCR;
});

describe('ente AI senza riscontro nel testo + OCR intestazione', () => {
    it('(i) OCR conferma lo stesso ente -> fonte combinata ai+ocr_header, confidence high, nessun avviso sull ente', async () => {
        mockAi('tec_eurolab');
        extractHeaderTextWithOCR.mockResolvedValue('A) TEC-Eurolab\nCERTIFICATION BODY');
        const out = await ingest();
        expect(extractHeaderTextWithOCR).toHaveBeenCalledTimes(1);
        expect(out.fields.issuing_body).toBe('tec_eurolab');
        expect(out.fieldSources.issuing_body).toBe('ai+ocr_header');
        expect(out.fieldConfidence.issuing_body).toBe('high');
        expect(out.warnings.some(isEnteWarning)).toBe(false);
    });

    it('(ii) OCR riconosce un altro ente -> l OCR prevale (tuv) con avviso di discrepanza', async () => {
        mockAi('tec_eurolab');
        extractHeaderTextWithOCR.mockResolvedValue('T\u00DCV S\u00DCD Industrie Service\nCertification body');
        const out = await ingest();
        expect(out.fields.issuing_body).toBe('tuv');
        expect(out.fieldSources.issuing_body).toBe('ocr_header');
        expect(out.fieldConfidence.issuing_body).toBe('medium');
        const w = out.warnings.find((x) => x.startsWith('Ente corretto da OCR'));
        expect(w).toContain('tec_eurolab');
        expect(w).toContain('verificare');
        expect(out.warnings.some(isUnverified)).toBe(false);
    });

    it.each([
        ['OCR vuoto', () => extractHeaderTextWithOCR.mockResolvedValue('')],
        ['OCR senza enti noti', () => extractHeaderTextWithOCR.mockResolvedValue('ACME Welding Institute\nCERTIFICATION BODY')],
        ['OCR in errore', () => extractHeaderTextWithOCR.mockRejectedValue(new Error('boom'))],
        ['OCR in timeout', () => extractHeaderTextWithOCR.mockRejectedValue(new Error('[OCR] Timeout OCR intestazione dopo 20000 ms'))],
    ])('(iii) %s -> mantiene l ente AI, «da verificare», ai_unverified, confidence low, nessuna eccezione', async (_n, setup) => {
        mockAi('tec_eurolab');
        setup();
        const out = await ingest();
        expect(extractHeaderTextWithOCR).toHaveBeenCalledTimes(1);
        expect(out.fields.issuing_body).toBe('tec_eurolab');
        expect(out.fieldSources.issuing_body).toBe('ai_unverified');
        expect(out.fieldConfidence.issuing_body).toBe('low');
        expect(out.warnings.filter(isUnverified)).toHaveLength(1);
        expect(out.fields.certificate_number).toBeDefined();
    });
});

describe('ente AI con riscontro nel testo: nessun OCR, nessun avviso', () => {
    it.each([
        ['TEC Eurolab S.r.l. Campogalliano', 'tec_eurolab'],
        ['T\u00DCV S\u00DCD Industrie Service', 'tuv'],
        ['RINA Services S.p.A.', 'rina'],
        ['Bureau Veritas Italia', 'bv'],
        ['TEC-Eurolab\nRINA Services S.p.A.', 'rina'],
        ['RINA Services S.p.A.\nTEC-Eurolab', 'tec_eurolab'],
        ['RINA Services S.p.A.\nT\u00DCV S\u00DCD', 'tuv'],
    ])('(iv) testo %j, AI %s', async (extra, code) => {
        mockAi(code);
        const out = await ingest('patentino_saldatore', `${TEXT_SENZA_ENTE}\n${extra}`);
        expect(extractHeaderTextWithOCR).not.toHaveBeenCalled();
        expect(out.fields.issuing_body).toBe(code);
        expect(out.fieldSources.issuing_body).not.toBe('ai_unverified');
        expect(out.warnings.some(isEnteWarning)).toBe(false);
    });
});

describe('ente AI vuoto o altro: come #764', () => {
    it.each([[null], ['altro'], ['Ente sconosciuto SRL']])('(v) AI %j + OCR riconosce -> ocr_header + avviso informativo', async (ai) => {
        mockAi(ai);
        extractHeaderTextWithOCR.mockResolvedValue('TEC:Eurolab');
        const out = await ingest();
        expect(out.fields.issuing_body).toBe('tec_eurolab');
        expect(out.fieldSources.issuing_body).toBe('ocr_header');
        expect(out.warnings.some((w) => w.startsWith('Ente rilevato da OCR dell\'intestazione'))).toBe(true);
        expect(out.warnings.some(isUnverified)).toBe(false);
    });

    it.each([[null], ['altro']])('(v) AI %j + OCR vuoto -> invariato, nessun avviso «da verificare»', async (ai) => {
        mockAi(ai);
        extractHeaderTextWithOCR.mockResolvedValue('');
        const out = await ingest();
        expect(out.fieldSources.issuing_body).not.toBe('ai_unverified');
        expect(out.warnings.some(isEnteWarning)).toBe(false);
        if (ai) expect(out.fields.issuing_body).toBe('altro');
        else expect(out.fields.issuing_body).toBeUndefined();
    });
});

describe('PDF gia letto con OCR completo', () => {
    it('(vi) ente AI senza riscontro nel testo OCR -> nessun doppio OCR, «da verificare»', async () => {
        mockAi('tec_eurolab');
        extractTextWithOCR.mockResolvedValue(TEXT_SENZA_ENTE);
        const out = await ingest('patentino_saldatore', '');
        expect(out.ocrUsed).toBe(true);
        expect(extractHeaderTextWithOCR).not.toHaveBeenCalled();
        expect(out.fields.issuing_body).toBe('tec_eurolab');
        expect(out.fieldSources.issuing_body).toBe('ai_unverified');
        expect(out.fieldConfidence.issuing_body).toBe('low');
        expect(out.warnings.filter(isUnverified)).toHaveLength(1);
    });

    it('(vi) ente presente nel testo OCR completo -> riscontro, nessun avviso', async () => {
        mockAi('tec_eurolab');
        extractTextWithOCR.mockResolvedValue(`${TEXT_SENZA_ENTE}\nTEC-Eurolab`);
        const out = await ingest('patentino_saldatore', '');
        expect(out.ocrUsed).toBe(true);
        expect(extractHeaderTextWithOCR).not.toHaveBeenCalled();
        expect(out.fieldSources.issuing_body).not.toBe('ai_unverified');
        expect(out.warnings.some(isEnteWarning)).toBe(false);
    });
});

describe('altri doc_type e interruttore', () => {
    it.each(['wpqr', 'wps', 'norma', 'cert_ndt', 'report_ndt'])('(vii) doc_type %s: nessun OCR, nessun avviso', async (docType) => {
        mockAi('tec_eurolab');
        const out = await ingest(docType);
        expect(extractHeaderTextWithOCR).not.toHaveBeenCalled();
        expect(out.warnings.some(isEnteWarning)).toBe(false);
        expect((out.fieldSources || {}).issuing_body).not.toBe('ai_unverified');
    });

    it('(viii) INGEST_HEADER_OCR=0: nessun OCR; ente AI senza riscontro resta «da verificare» (non verificabile)', async () => {
        process.env.INGEST_HEADER_OCR = '0';
        mockAi('tec_eurolab');
        const out = await ingest();
        expect(extractHeaderTextWithOCR).not.toHaveBeenCalled();
        expect(out.fields.issuing_body).toBe('tec_eurolab');
        expect(out.fieldSources.issuing_body).toBe('ai_unverified');
        expect(out.warnings.filter(isUnverified)).toHaveLength(1);
    });

    it('(viii) INGEST_HEADER_OCR=0 con ente AI vuoto: invariato, nessun avviso', async () => {
        process.env.INGEST_HEADER_OCR = '0';
        mockAi(null);
        const out = await ingest();
        expect(out.warnings.some(isEnteWarning)).toBe(false);
    });

    it('modulo OCR assente (headerOcr null): ente AI senza riscontro -> «da verificare»', async () => {
        const args = {
            pdfBuffer: Buffer.from('%PDF'), docType: 'patentino_saldatore', text: TEXT_SENZA_ENTE, ocrUsed: false,
            fields: { issuing_body: 'tec_eurolab' }, fieldConfidence: {}, fieldSources: { issuing_body: 'ai' },
            warnings: [], fileName: 'x.pdf', headerOcr: null,
        };
        await expect(applyHeaderIssuingBodyFallback(args)).resolves.toBe(false);
        expect(args.fieldSources.issuing_body).toBe('ai_unverified');
        expect(args.warnings).toHaveLength(1);
    });
});

describe('(ix) falsi riscontri: il codice dentro un\'altra parola non conta', () => {
    it.each([
        ['rina', 'Katerina Bianchi Marina'],
        ['tuv', 'Statuto tuvalu'],
        ['tec_eurolab', 'Eurolab Instruments Euro Lab Service'],
        ['bv', 'ACME BV Holding'],
        ['sideius', 'Valor Italia'],
    ])('AI %s, testo %j -> senza riscontro: OCR invocato, «da verificare»', async (code, extra) => {
        mockAi(code);
        extractHeaderTextWithOCR.mockResolvedValue('');
        const out = await ingest('patentino_saldatore', `${TEXT_SENZA_ENTE}\n${extra}`);
        expect(extractHeaderTextWithOCR).toHaveBeenCalledTimes(1);
        expect(out.fieldSources.issuing_body).toBe('ai_unverified');
    });

    it('extractAllIssuingBodies restituisce tutti gli enti ancorati, non solo il primo', () => {
        expect(extractAllIssuingBodies('RINA S.p.A.\nT\u00DCV S\u00DCD\nTEC-Eurolab')).toEqual(['RINA', 'T\u00DCV', 'TEC Eurolab']);
        expect(extractAllIssuingBodies('Katerina statuto tuvalu')).toEqual([]);
        expect(extractAllIssuingBodies(null)).toEqual([]);
    });
});

describe('(x) log e _field_sources', () => {
    it('riga «Fonti campi» riporta la nuova fonte; nessun nome file nei log', async () => {
        mockAi('tec_eurolab');
        extractHeaderTextWithOCR.mockResolvedValue('');
        const spyInfo = jest.spyOn(logger, 'info').mockImplementation(() => {});
        const spyWarn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
        try {
            await ingest('patentino_saldatore', TEXT_SENZA_ENTE, '99-00000_ROSSI MARIO.pdf');
            const lines = spyInfo.mock.calls.map((c) => String(c[0]));
            expect(lines.find((l) => l.startsWith('[IngestPipeline] Fonti campi'))).toContain('issuing_body=ai_unverified');
            const logged = [...spyInfo.mock.calls, ...spyWarn.mock.calls].map((c) => JSON.stringify(c)).join('\n').toLowerCase();
            for (const leak of ['rossi', 'mario', '99-00000']) expect(logged).not.toContain(leak);
        } finally {
            spyInfo.mockRestore();
            spyWarn.mockRestore();
        }
    });

    it('riga «Fonti campi» con fonte combinata ai+ocr_header', async () => {
        mockAi('tec_eurolab');
        extractHeaderTextWithOCR.mockResolvedValue('TEC-Eurolab');
        const spyInfo = jest.spyOn(logger, 'info').mockImplementation(() => {});
        try {
            await ingest();
            const line = spyInfo.mock.calls.map((c) => String(c[0])).find((l) => l.startsWith('[IngestPipeline] Fonti campi'));
            expect(line).toContain('issuing_body=ai+ocr_header');
        } finally {
            spyInfo.mockRestore();
        }
    });

    it.each(['ai_unverified', 'ai+ocr_header', 'ocr_header'])('fonte %s: round-trip di _field_sources nello staging, il campo di dominio resta separato', (source) => {
        jest.isolateModules(() => {
            jest.doMock('../config/database', () => ({ query: jest.fn() }));
            const { splitFieldSources, FIELD_SOURCES_KEY } = require('./ingestStaging.service');
            const stored = { issuing_body: 'tec_eurolab', [FIELD_SOURCES_KEY]: { issuing_body: source } };
            const { fields, fieldSources } = splitFieldSources(stored);
            expect(fields).toEqual({ issuing_body: 'tec_eurolab' });
            expect(fieldSources).toEqual({ issuing_body: source });
        });
    });
});

describe('intestazione con piu enti (Bugbot): l\'ente AI e\' confermato se e\' uno dei riconosciuti', () => {
    it.each([
        ['TEC-Eurolab\nin collaborazione con RINA Services', 'tec_eurolab'],
        ['RINA Services\nTEC-Eurolab', 'tec_eurolab'],
        ['Istituto Italiano della Saldatura IIS\nTEC-Eurolab', 'tec_eurolab'],
        ['T\u00DCV S\u00DCD\nBureau Veritas', 'tuv'],
    ])('OCR %j con AI %s -> ai+ocr_header, nessun avviso', async (header, code) => {
        mockAi(code);
        extractHeaderTextWithOCR.mockResolvedValue(header);
        const out = await ingest();
        expect(out.fields.issuing_body).toBe(code);
        expect(out.fieldSources.issuing_body).toBe('ai+ocr_header');
        expect(out.fieldConfidence.issuing_body).toBe('high');
        expect(out.warnings.some(isEnteWarning)).toBe(false);
    });

    it('piu enti nell\'intestazione, nessuno e quello dell\'AI (ambiguo) -> l\'OCR non prevale: ente AI «da verificare»', async () => {
        mockAi('tec_eurolab');
        extractHeaderTextWithOCR.mockResolvedValue('RINA Services\nBureau Veritas');
        const out = await ingest();
        expect(out.fields.issuing_body).toBe('tec_eurolab');
        expect(out.fieldSources.issuing_body).toBe('ai_unverified');
        expect(out.warnings.filter(isUnverified)).toHaveLength(1);
    });

    it('un solo ente diverso dall\'AI nell\'intestazione (IIS fuori lista ignorato) -> l\'OCR prevale', async () => {
        mockAi('tec_eurolab');
        extractHeaderTextWithOCR.mockResolvedValue('Istituto Italiano della Saldatura IIS\nRINA Services');
        const out = await ingest();
        expect(out.fields.issuing_body).toBe('rina');
        expect(out.fieldSources.issuing_body).toBe('ocr_header');
    });
});
