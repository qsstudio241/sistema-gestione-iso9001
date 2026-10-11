/**
 * @jest-environment node
 *
 * extractQualificationFromPdf con docType === null (riconoscimento automatico del tipo per file)
 * e compatibilita' con doc_type esplicito (override). Testi sintetici, pipeline/OCR/AI simulati.
 */

jest.mock('../config/database', () => ({ getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('./documentIngestPipeline.service', () => ({
    runDocumentIngest: jest.fn(),
    extractDocumentText: jest.fn(),
}));
jest.mock('./personnelQualificationLink.service', () => ({
    resolvePersonnelForQualification: jest.fn().mockResolvedValue({ ok: true, personnelId: 55, personName: 'ZZ TEST' }),
}));
jest.mock('./aiProviderAdapter', () => ({ chat: jest.fn(), getActiveProvider: jest.fn(() => null) }));
jest.mock('../utils/ocrExtractor', () => ({ extractHeaderTextWithOCR: jest.fn() }));

const { runDocumentIngest, extractDocumentText } = require('./documentIngestPipeline.service');
const { extractQualificationFromPdf } = require('./qualificationIngest.service');

const T_NDT = 'Certificate of competence in non-destructive testing ISO 9712:2021 Method UT Level 2';
const T_WPQR = 'Welding Procedure Qualification Record ISO 15614-1 test piece provino trazione bending hardness macro charpy WPQR';
const NO_AI = { classifier: { hasAi: false, headerOcr: null } };

function bundle(text, extra = {}) {
    return { text, ocrUsed: false, warnings: [], ...extra };
}

function pipelineResult(text, fields = {}) {
    return {
        text,
        fields: { welder_name: 'ZZ TEST', certificate_number: 'ZZ-1', ...fields },
        fieldConfidence: {},
        fieldSources: {},
        warnings: [],
        aiModel: null,
    };
}

describe('extractQualificationFromPdf: auto-detect (docType === null)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('tipo chiaro dal testo: estrae con il tipo rilevato, riusa il testo gia\' letto, espone la classificazione', async () => {
        const b = bundle(T_NDT);
        extractDocumentText.mockResolvedValue(b);
        runDocumentIngest.mockResolvedValue(pipelineResult(T_NDT));

        const out = await extractQualificationFromPdf(Buffer.from('x'), 'a.pdf', 10, null, null, NO_AI);

        expect(extractDocumentText).toHaveBeenCalledTimes(1);
        expect(runDocumentIngest).toHaveBeenCalledWith(expect.objectContaining({ docType: 'cert_ndt', preExtracted: b }));
        expect(out.status).toBe('pending_review');
        expect(out.doc_type).toBe('cert_ndt');
        expect(out.classification).toEqual(expect.objectContaining({
            detected_doc_type: 'cert_ndt', confidence: 'high', classification_source: 'rules',
        }));
    });

    it('tipo non chiaro: type_unresolved, nessuna estrazione (nessun costo AI di estrazione)', async () => {
        extractDocumentText.mockResolvedValue(bundle('Lettera commerciale sulla fornitura di materiali di consumo'));

        const out = await extractQualificationFromPdf(Buffer.from('x'), 'a.pdf', 10, null, null, NO_AI);

        expect(out.status).toBe('type_unresolved');
        expect(out.classification.needs_choice).toBe(true);
        expect(runDocumentIngest).not.toHaveBeenCalled();
    });

    it('file vuoto/ambiguo: type_unresolved con confidenza low', async () => {
        extractDocumentText.mockResolvedValue(bundle(''));

        const out = await extractQualificationFromPdf(Buffer.from('x'), 'blank.pdf', 10, null, null, NO_AI);

        expect(out.status).toBe('type_unresolved');
        expect(out.classification.confidence).toBe('low');
    });

    it('WPQR senza norma di qualifica: wrong_module come nel flusso storico, con classificazione', async () => {
        extractDocumentText.mockResolvedValue(bundle(T_WPQR));

        const out = await extractQualificationFromPdf(Buffer.from('x'), 'a.pdf', 10, null, null, NO_AI);

        expect(out.status).toBe('wrong_module');
        expect(out.detected_type).toBe('wpqr');
        expect(out.classification.needs_choice).toBe(true);
        expect(runDocumentIngest).not.toHaveBeenCalled();
    });

    it('14732 che cita WPQR/15614 come base non e\' wrong_module (confidenza high)', async () => {
        const text = 'Certificato operatore ISO 14732 qualificazione basata su WPQR ISO 15614 test piece provino bending';
        extractDocumentText.mockResolvedValue(bundle(text));
        runDocumentIngest.mockResolvedValue(pipelineResult(text, { operator_name: 'ZZ TEST' }));

        const out = await extractQualificationFromPdf(Buffer.from('x'), 'a.pdf', 10, null, null, NO_AI);

        expect(out.status).toBe('pending_review');
        expect(out.doc_type).toBe('qualifica_14732');
        expect(out.qualification_type).toBe('Operatore ISO 14732');
    });

    it('testo da OCR: classification_source ocr', async () => {
        extractDocumentText.mockResolvedValue(bundle('ISO 9606-1 saldatore processo 135', { ocrUsed: true }));
        runDocumentIngest.mockResolvedValue(pipelineResult('ISO 9606-1 saldatore processo 135'));

        const out = await extractQualificationFromPdf(Buffer.from('x'), 'scan.pdf', 10, null, null, NO_AI);

        expect(out.classification.classification_source).toBe('ocr');
        expect(out.qualification_type).toBe('Saldatore ISO 9606-1');
    });
});

describe('extractQualificationFromPdf: doc_type esplicito = override (compat client vecchi)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('nessuna classificazione ne\' lettura anticipata del testo: pipeline come prima', async () => {
        runDocumentIngest.mockResolvedValue(pipelineResult('ISO 9606-1 saldatore'));

        const out = await extractQualificationFromPdf(Buffer.from('x'), 'a.pdf', 10, null, 'patentino_saldatore');

        expect(extractDocumentText).not.toHaveBeenCalled();
        expect(runDocumentIngest).toHaveBeenCalledWith(expect.objectContaining({ docType: 'patentino_saldatore', preExtracted: null }));
        expect(out.status).toBe('pending_review');
        expect(out.qualification_type).toBe('Saldatore ISO 9606-1');
        expect(out.classification).toEqual(expect.objectContaining({
            detected_doc_type: 'patentino_saldatore', confidence: 'high', classification_source: 'override', ai_calls: 0,
        }));
    });

    it('override prevale sul testo: 14732 scelto, testo 9606 -> warning di discrepanza storico', async () => {
        const text = 'Operatore ISO 14732 base ISO 9606-1';
        runDocumentIngest.mockResolvedValue(pipelineResult(text));

        const out = await extractQualificationFromPdf(Buffer.from('x'), 'a.pdf', 10, null, 'qualifica_14732');

        expect(out.qualification_type).toBe('Operatore ISO 14732');
        expect(out.classification.classification_source).toBe('override');
    });
});
