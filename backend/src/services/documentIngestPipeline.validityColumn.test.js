/**
 * @jest-environment node
 *
 * Patentini ISO 9606-1: nel DB conta solo il campo di VALIDITA' (weld_details e spessore).
 * Fixture sintetiche che riproducono le righe del testo estratto dai certificati reali.
 */

jest.mock('../config/database', () => ({ getPool: jest.fn() }));
jest.mock('./personnelQualificationLink.service', () => ({ resolvePersonnelForQualification: jest.fn() }));
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
const { runDocumentIngest, applyValidityColumnRules } = require('./documentIngestPipeline.service');
const { mapPipelineFieldsToReview } = require('./qualificationIngest.service');

const TESTO_012 = [
    'CERTIFICATO DI QUALIFICAZIONE DEL SALDATORE',
    'Nome: ZZ TITOLARE SINTETICO',
    'ISO 9606-1: 141 T FW FM5 S t3-10 D48,25 PB sl',
    'Plate or pipe PIPE PLATE, PIPE',
    'Spessore / Thickness (mm)',
    'a) 3 a) >=3',
    'b) 10 b) >=3',
    '\u00D8 Diam. esterno tubo / Outside pipe diameter (mm)',
    'D1) 48,25 D1) >=25',
    'Particolari di saldatura / Weld details',
    'a) sl a) sl',
].join('\n');

const TESTO_028 = [
    'CERTIFICATO DI QUALIFICAZIONE DEL SALDATORE',
    'ISO 9606-1: 135 P FW FM1 t12 PB ml',
    'Plate or pipe PLATE PLATE',
    'Spessore / Thickness (mm)',
    'a) 12 a) >=3',
    'b) 12 b) >=3',
    '\u00D8 Diam. esterno tubo / Outside pipe diameter (mm)',
    'D1) N.A. D1) ',
    'Particolari di saldatura / Weld details',
    'a) ml a) sl, ml',
].join('\n');

const TESTO_LAYOUT_DIVERSO = [
    'CERTIFICATO DI QUALIFICAZIONE DEL SALDATORE',
    'ISO 9606-1: 135 P FW FM1 t12 PB ml',
    'Dettagli: ml',
    'Spessore qualificato 3 - 24 mm',
].join('\n');

function mockAi(typeSpecific) {
    getActiveProvider.mockReturnValue('gemini');
    extractStructuredByDocType.mockResolvedValue({
        model: 'gemini-test',
        data: { type_specific_data: typeSpecific },
    });
}

async function ingest(text, docType = 'patentino_saldatore') {
    extractPdfText.mockResolvedValue(text);
    return runDocumentIngest({ pdfBuffer: Buffer.from('%PDF'), docType, fileName: 'cert.pdf', organizationId: 1 });
}

describe('patentino_saldatore: campo di validita\' vince sull\'AI', () => {
    let infoSpy;
    beforeEach(() => {
        jest.clearAllMocks();
        infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    });
    afterEach(() => infoSpy.mockRestore());

    it('012: AI "sl, PIPE PLATE" e range 3-10 -> weld_details "sl", min 3, max aperto', async () => {
        mockAi({
            weld_details: 'sl, PIPE PLATE',
            thickness_min_mm: 3,
            thickness_max_mm: 10,
            thickness_max_unlimited: false,
            thickness_t_test_mm: 3,
        });
        const out = await ingest(TESTO_012);

        expect(out.fields.weld_details).toBe('sl');
        expect(out.fields.thickness_min_mm).toBe(3);
        expect(out.fields.thickness_max_mm).toBeUndefined();
        expect(out.fields.thickness_max_unlimited).toBe(true);
        expect(out.fields.thickness_range).toBe('\u22653 mm');
        expect(out.fields.thickness_t_test_mm).toBe(3);

        expect(out.fieldSources.weld_details).toBe('ai_corrected_by_rules');
        expect(out.fieldSources.thickness_min_mm).toBe('ai+rules');
        expect(out.fieldSources.thickness_max_unlimited).toBe('ai_corrected_by_rules');
        expect(out.fieldSources.thickness_max_mm).toBeUndefined();
        expect(out.fieldConfidence.thickness_max_mm).toBe('low');
        expect(out.fieldConfidence.weld_details).toBe('high');
    });

    it('012 a monte del DB: il review mappa min 3, max NULL, unlimited true, range aperto', async () => {
        mockAi({ weld_details: 'sl, PIPE PLATE', thickness_min_mm: 3, thickness_max_mm: 10 });
        const out = await ingest(TESTO_012);
        const review = mapPipelineFieldsToReview(out.fields, TESTO_012, 'cert.pdf', 'patentino_saldatore');
        expect(review.weld_details).toBe('sl');
        expect(review.thickness_min_mm).toBe(3);
        expect(review.thickness_max_mm).toBeNull();
        expect(review.thickness_max_unlimited).toBe(true);
        expect(review.thickness_range).toBe('\u22653 mm');
    });

    it('028: AI "ml" (colonna prova) -> "sl, ml" dalla validita\'; spessore >=3', async () => {
        mockAi({ weld_details: 'ml', thickness_min_mm: 12, thickness_max_mm: 12, thickness_t_test_mm: 12 });
        const out = await ingest(TESTO_028);

        expect(out.fields.weld_details).toBe('sl, ml');
        expect(out.fieldSources.weld_details).toBe('ai_corrected_by_rules');
        expect(out.fields.thickness_min_mm).toBe(3);
        expect(out.fields.thickness_max_mm).toBeUndefined();
        expect(out.fields.thickness_max_unlimited).toBe(true);
        expect(out.fields.thickness_t_test_mm).toBe(12);
    });

    it('028: AI gia\' corretta ("sl, ml") -> ai+rules', async () => {
        mockAi({ weld_details: 'sl, ml', thickness_min_mm: 3, thickness_max_unlimited: true });
        const out = await ingest(TESTO_028);
        expect(out.fields.weld_details).toBe('sl, ml');
        expect(out.fieldSources.weld_details).toBe('ai+rules');
        expect(out.fieldSources.thickness_min_mm).toBe('ai+rules');
        expect(out.fieldSources.thickness_max_unlimited).toBe('ai+rules');
    });

    it('AI assente: weld_details e spessore arrivano dalle regole (fonte rules), mai dalla designazione', async () => {
        getActiveProvider.mockReturnValue(null);
        const out = await ingest(TESTO_028);
        expect(out.fields.weld_details).toBe('sl, ml');
        expect(out.fieldSources.weld_details).toBe('rules');
        expect(out.fieldSources.thickness_min_mm).toBe('rules');
        expect(out.fields.thickness_min_mm).toBe(3);
        expect(out.fields.thickness_max_unlimited).toBe(true);
    });

    it('validita\' dettagli vuota: il valore di prova dell\'AI viene scartato', async () => {
        const testo = TESTO_028.replace('a) ml a) sl, ml', 'a) ml a) ');
        mockAi({ weld_details: 'ml' });
        const out = await ingest(testo);
        expect(out.fields.weld_details).toBeUndefined();
        expect(out.fieldSources.weld_details).toBeUndefined();
    });

    it('layout diverso: nessuna regola sulla colonna, AI invariata salvo la pulizia di weld_details', async () => {
        mockAi({
            weld_details: 'sl, PIPE PLATE',
            thickness_min_mm: 3,
            thickness_max_mm: 24,
        });
        const out = await ingest(TESTO_LAYOUT_DIVERSO);
        expect(out.fields.weld_details).toBe('sl');
        expect(out.fieldSources.weld_details).toBe('ai');
        expect(out.fields.thickness_min_mm).toBe(3);
        expect(out.fields.thickness_max_mm).toBe(24);
        expect(out.fieldSources.thickness_max_mm).toBe('ai');
        expect(out.fields.thickness_max_unlimited).toBeUndefined();
    });

    it('layout diverso: weld_details AI che non e\' un dettaglio di saldatura -> assente', async () => {
        mockAi({ weld_details: 'PIPE PLATE' });
        const out = await ingest(TESTO_LAYOUT_DIVERSO);
        expect(out.fields.weld_details).toBeUndefined();
        expect(out.fieldSources.weld_details).toBeUndefined();
    });

    it('validita\' a)/b) diverse: spessore lasciato all\'AI', async () => {
        const testo = TESTO_012.replace('b) 10 b) >=3', 'b) 10 b) 3-10');
        mockAi({ thickness_min_mm: 3, thickness_max_mm: 10 });
        const out = await ingest(testo);
        expect(out.fields.thickness_min_mm).toBe(3);
        expect(out.fields.thickness_max_mm).toBe(10);
        expect(out.fieldSources.thickness_max_mm).toBe('ai');
        expect(out.fields.thickness_max_unlimited).toBeUndefined();
    });
});

describe('applyValidityColumnRules', () => {
    const base = () => ({
        fields: { weld_details: 'ml', thickness_min_mm: 12, thickness_max_mm: 12 },
        fieldConfidence: {},
        fieldSources: { weld_details: 'ai', thickness_min_mm: 'ai', thickness_max_mm: 'ai' },
    });

    it.each(['wpqr', 'wps', 'qualifica_14732', 'cert_ndt', 'norma'])('%s: nessuna modifica', (docType) => {
        const ctx = base();
        const before = JSON.parse(JSON.stringify(ctx));
        expect(applyValidityColumnRules({ docType, text: TESTO_028, ...ctx })).toBe(false);
        expect(ctx).toEqual(before);
    });

    it('patentino con layout riconosciuto: modifica e restituisce true', () => {
        const ctx = base();
        expect(applyValidityColumnRules({ docType: 'patentino_saldatore', text: TESTO_028, ...ctx })).toBe(true);
        expect(ctx.fields.weld_details).toBe('sl, ml');
    });

    it('apertura senza minimo ("unlimited" da solo): minimo e range dell\'AI (spessore di prova) non restano', () => {
        const ctx = {
            fields: { thickness_min_mm: 12, thickness_max_mm: 12, thickness_range: '12-12 mm' },
            fieldConfidence: {},
            fieldSources: { thickness_min_mm: 'ai', thickness_max_mm: 'ai', thickness_range: 'ai' },
        };
        const testo = 'Spessore / Thickness (mm)\na) 12 a) unlimited\nb) 12 b) illimitato';
        expect(applyValidityColumnRules({ docType: 'patentino_saldatore', text: testo, ...ctx })).toBe(true);
        expect(ctx.fields.thickness_min_mm).toBeUndefined();
        expect(ctx.fields.thickness_max_mm).toBeUndefined();
        expect(ctx.fields.thickness_range).toBeUndefined();
        expect(ctx.fields.thickness_max_unlimited).toBe(true);
        expect(ctx.fieldSources.thickness_min_mm).toBeUndefined();
        expect(ctx.fieldConfidence.thickness_min_mm).toBe('low');
    });

    it('intervallo chiuso nella colonna validita\' (3-10): max 10, range chiuso, flag aperto azzerato', () => {
        const ctx = base();
        ctx.fields.thickness_max_unlimited = true;
        ctx.fieldSources.thickness_max_unlimited = 'ai';
        const testo = 'Spessore / Thickness (mm)\na) 12 a) 3-10\nb) 12 b) 3-10';
        applyValidityColumnRules({ docType: 'patentino_saldatore', text: testo, ...ctx });
        expect(ctx.fields.thickness_min_mm).toBe(3);
        expect(ctx.fields.thickness_max_mm).toBe(10);
        expect(ctx.fields.thickness_max_unlimited).toBe(false);
        expect(ctx.fields.thickness_range).toBe('3-10 mm');
        expect(ctx.fieldSources.thickness_max_mm).toBe('ai_corrected_by_rules');
    });
});
