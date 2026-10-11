/**
 * @jest-environment node
 *
 * Riconoscimento tipo documento (batch qualifiche). Testi sintetici, OCR e AI simulati.
 */

jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('./aiProviderAdapter', () => ({ chat: jest.fn(), getActiveProvider: jest.fn(() => ({ name: 'mock' })) }));
jest.mock('../utils/ocrExtractor', () => ({ extractHeaderTextWithOCR: jest.fn() }));

const logger = require('../utils/logger');
const {
    classifyQualificationDocType,
    classifyByRules,
    overrideClassification,
} = require('./qualificationDocTypeClassifier.service');

const T_9606 = 'WELDER APPROVAL TEST CERTIFICATE\nEN ISO 9606-1:2017\nWelder: ZZ TEST\nProcess 135 - Material group 1.1';
const T_14732 = 'Certificato di qualifica operatore\nISO 14732:2013\n4.1 c) Welder qualification test ISO 9606\n4.1 a) ISO 15614';
const T_NDT = 'Certificate of competence in non-destructive testing\nISO 9712:2021\nMethod: UT  Level 2 livello 2';

const aiReturning = (obj) => jest.fn(async () => ({ content: JSON.stringify(obj) }));
const noAiDeps = { hasAi: false, headerOcr: null };

describe('classifyByRules: livello 1 (regole sul testo)', () => {
    it.each([
        ['9606-1', T_9606, 'patentino_saldatore'],
        ['14732', T_14732, 'qualifica_14732'],
        ['9712', T_NDT, 'cert_ndt'],
    ])('norma esplicita %s -> %s con confidenza high', (_n, text, expected) => {
        const r = classifyByRules(text, 'file.pdf');
        expect(r.doc_type).toBe(expected);
        expect(r.confidence).toBe('high');
        expect(r.reasons.length).toBeGreaterThan(0);
    });

    it('9606-2 resta patentino_saldatore (il sottotipo si legge dopo, da qualification_type)', () => {
        expect(classifyByRules('ISO 9606-2:2004 aluminium welder', 'a.pdf').doc_type).toBe('patentino_saldatore');
    });

    it('14732 prevale su 9606 citata come base', () => {
        const r = classifyByRules(T_14732, 'a.pdf');
        expect(r.doc_type).toBe('qualifica_14732');
        expect(r.reasons.join(' ')).toMatch(/9606/);
    });

    it('9712 insieme a 9606: conflitto -> low, da scegliere', () => {
        const r = classifyByRules('ISO 9606-1 welder; examiner certified ISO 9712', 'a.pdf');
        expect(r.confidence).toBe('low');
        expect(r.doc_type).toBe('altro');
        expect(r.reasons.join(' ')).toMatch(/conflitto/i);
    });

    it('solo indizi deboli (nessuna norma) -> medium', () => {
        const r = classifyByRules('Patentino di saldatore rilasciato a ZZ TEST', 'a.pdf');
        expect(r.doc_type).toBe('patentino_saldatore');
        expect(r.confidence).toBe('medium');
    });

    it('indizi deboli di tipi diversi -> low', () => {
        const r = classifyByRules('welding operator and welder, non-destructive testing level 2 ultrasonic', 'a.pdf');
        expect(r.confidence).toBe('low');
    });

    it('solo il nome file richiama la norma -> indizio debole: mai oltre low', () => {
        const r = classifyByRules('', 'ZZ_14732_121.pdf');
        expect(r.doc_type).toBe('qualifica_14732');
        expect(r.confidence).toBe('low');
        expect(r.reasons.join(' ')).toMatch(/nome file/i);
    });

    it('testo di un tipo non gestito (14731) vince sul nome file', () => {
        const r = classifyByRules('Certificato coordinatore di saldatura ISO 14731 IWE', 'ZZ_9606.pdf');
        expect(r.doc_type).toBe('altro');
        expect(r.otherType).toMatch(/14731/);
    });

    it('motivazioni con accenti corretti (più, mai apostrofo)', () => {
        const r = classifyByRules('Patentino saldatore e welding operator', 'a.pdf');
        expect(r.reasons.join(' ')).toMatch(/ambigui tra più tipi/);
    });

    it('nome file 14732 ma testo solo 9606 -> low (disaccordo)', () => {
        const r = classifyByRules('ISO 9606-1 welder', 'ZZ_14732.pdf');
        expect(r.confidence).toBe('low');
    });

    it('motivi mostrati all\'utente con accenti corretti (nessun apostrofo al posto di \u00f9)', () => {
        const r = classifyByRules('welding operator and welder, non-destructive testing level 2 ultrasonic', 'a.pdf');
        expect(r.reasons.join(' ')).toContain('pi\u00f9');
    });

    it('nessun indizio -> altro low', () => {
        const r = classifyByRules('Fattura n. 12 del 01/01/2026 importo 100 euro', 'fattura.pdf');
        expect(r.doc_type).toBe('altro');
        expect(r.confidence).toBe('low');
    });

    it('coordinatore ISO 14731 -> altro con motivo esplicito', () => {
        const r = classifyByRules('Certificato coordinatore di saldatura ISO 14731 IWE', 'a.pdf');
        expect(r.doc_type).toBe('altro');
        expect(r.otherType).toMatch(/14731/);
    });

    it('sigla EWS dentro altra parola non è un coordinatore', () => {
        expect(classifyByRules('latest news and views', 'a.pdf').otherType).toBeNull();
    });
});

describe('classifyQualificationDocType: livelli e fonti', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.INGEST_HEADER_OCR;
    });

    it('regole: source rules, nessuna chiamata AI', async () => {
        const chatFn = aiReturning({ doc_type: 'cert_ndt', confidence: 'high' });
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'a.pdf', text: T_NDT, ocrUsed: false, deps: { chatFn, hasAi: true },
        });
        expect(r).toEqual(expect.objectContaining({
            detected_doc_type: 'cert_ndt', confidence: 'high', classification_source: 'rules', needs_choice: false, ai_calls: 0,
        }));
        expect(chatFn).not.toHaveBeenCalled();
    });

    it('testo ottenuto da OCR: source ocr', async () => {
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'a.pdf', text: T_14732, ocrUsed: true, deps: noAiDeps,
        });
        expect(r.detected_doc_type).toBe('qualifica_14732');
        expect(r.classification_source).toBe('ocr');
    });

    it('nessun indizio nel testo: OCR dell\'intestazione che riconosce la norma -> source ocr', async () => {
        const headerOcr = jest.fn(async () => 'CERTIFICATE ISO 9712 NDT');
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'scan.pdf', text: 'testo senza norme ma abbastanza lungo da non essere vuoto', ocrUsed: false,
            deps: { headerOcr, hasAi: false },
        });
        expect(headerOcr).toHaveBeenCalledTimes(1);
        expect(r.detected_doc_type).toBe('cert_ndt');
        expect(r.classification_source).toBe('ocr');
        expect(r.reasons.join(' ')).toMatch(/OCR intestazione/);
    });

    it('nome file che richiama una norma ma testo senza evidenza: l\'OCR intestazione viene eseguito (fonte ocr)', async () => {
        const headerOcr = jest.fn(async () => 'CERTIFICATE OF NON-DESTRUCTIVE TESTING PERSONNEL ISO 9712');
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'ZZ_9712_scan.pdf', text: '', ocrUsed: false,
            deps: { headerOcr, hasAi: false },
        });
        expect(headerOcr).toHaveBeenCalledTimes(1);
        expect(r.detected_doc_type).toBe('cert_ndt');
        expect(r.classification_source).toBe('ocr');
        expect(r.confidence).toBe('high');
        expect(r.reasons.join(' ')).toMatch(/OCR intestazione/);
    });

    it('nome file 9606 ma intestazione OCR 9712: OCR eseguito, il documento prevale ma resta da confermare', async () => {
        const headerOcr = jest.fn(async () => 'CERTIFICATE OF NON-DESTRUCTIVE TESTING PERSONNEL ISO 9712');
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'ZZ_9606_scan.pdf', text: '', ocrUsed: false,
            deps: { headerOcr, hasAi: false },
        });
        expect(headerOcr).toHaveBeenCalledTimes(1);
        expect(r.detected_doc_type).toBe('cert_ndt');
        expect(r.classification_source).toBe('ocr');
        expect(r.confidence).toBe('low');
        expect(r.needs_choice).toBe(true);
    });

    it('solo il nome file e OCR intestazione senza esito: mai confidenza alta, da scegliere', async () => {
        const headerOcr = jest.fn(async () => '');
        const chatFn = jest.fn();
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'ZZ_9606_scan.pdf', text: '', ocrUsed: false,
            deps: { headerOcr, chatFn, hasAi: true },
        });
        expect(headerOcr).toHaveBeenCalledTimes(1);
        expect(r.confidence).toBe('low');
        expect(r.needs_choice).toBe(true);
        expect(r.classification_source).not.toBe('ocr');
    });

    it('testo con evidenza propria: OCR intestazione non necessario anche se il nome file concorda o discorda', async () => {
        const headerOcr = jest.fn(async () => 'ISO 9712');
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'ZZ_9606.pdf', text: T_14732, deps: { headerOcr, hasAi: false },
        });
        expect(headerOcr).not.toHaveBeenCalled();
        expect(r.detected_doc_type).toBe('qualifica_14732');
    });

    it('intestazione OCR di un tipo non gestito (14731): altro/da scegliere, il nome file non guida l\'estrazione', async () => {
        const headerOcr = jest.fn(async () => 'Certificato coordinatore di saldatura ISO 14731 IWE');
        const chatFn = jest.fn();
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'ZZ_9606_scan.pdf', text: '', deps: { headerOcr, chatFn, hasAi: true },
        });
        expect(r.detected_doc_type).toBe('altro');
        expect(r.needs_choice).toBe(true);
        expect(r.classification_source).toBe('ocr');
        expect(r.reasons.join(' ')).toMatch(/14731.*OCR intestazione/);
        expect(chatFn).not.toHaveBeenCalled();
    });

    it('intestazione OCR con norme in conflitto: nessun tipo dal nome file, da scegliere', async () => {
        const headerOcr = jest.fn(async () => 'ISO 9606-1 welder; examiner certified ISO 9712');
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'ZZ_9606_scan.pdf', text: '', deps: { headerOcr, hasAi: false },
        });
        expect(r.detected_doc_type).toBe('altro');
        expect(r.needs_choice).toBe(true);
        expect(r.reasons.join(' ')).toMatch(/conflitto.*OCR intestazione/i);
        expect(r.reasons.join(' ')).not.toMatch(/Solo il nome file/);
    });

    it('motivi: solo quelli derivati dall\'intestazione sono marcati «OCR intestazione» (non quelli sul nome file)', async () => {
        const headerOcr = jest.fn(async () => 'CERTIFICATE OF NON-DESTRUCTIVE TESTING PERSONNEL ISO 9712');
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'ZZ_9606_scan.pdf', text: '', deps: { headerOcr, hasAi: false },
        });
        const nameReason = r.reasons.find((x) => /nome file/i.test(x));
        expect(nameReason).toBeDefined();
        expect(nameReason).not.toMatch(/OCR intestazione/);
        expect(r.reasons.some((x) => /9712.*OCR intestazione/.test(x))).toBe(true);
    });

    it('nome file nei log OCR: nessun nome in chiaro quando l\'OCR intestazione fallisce', async () => {
        const headerOcr = jest.fn(async () => { throw new Error('tesseract KO'); });
        await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: '99-00000_ZZROSSI_9606.pdf', text: '', deps: { headerOcr, hasAi: false },
        });
        const logged = [...logger.warn.mock.calls, ...logger.info.mock.calls].map((c) => String(c[0])).join('\n');
        expect(logged).toMatch(/OCR intestazione non riuscito/);
        expect(logged).not.toContain('ZZROSSI');
    });

    it('solo il nome file richiama la norma: l\'OCR intestazione parte comunque e un disaccordo abbassa a low', async () => {
        const headerOcr = jest.fn(async () => 'CERTIFICATE ISO 9712 NDT');
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'ZZ_9606_scan.pdf', text: 'testo senza norme ma abbastanza lungo da non essere vuoto', ocrUsed: false,
            deps: { headerOcr, hasAi: false },
        });
        expect(headerOcr).toHaveBeenCalledTimes(1);
        expect(r.confidence).toBe('low');
        expect(r.needs_choice).toBe(true);
        expect(r.reasons.join(' ')).toMatch(/nome file/i);
    });

    it('INGEST_HEADER_OCR=0 disattiva l\'OCR intestazione', async () => {
        process.env.INGEST_HEADER_OCR = '0';
        const headerOcr = jest.fn(async () => 'ISO 9712');
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'scan.pdf', text: 'testo senza norme ma abbastanza lungo da non essere vuoto', deps: { headerOcr, hasAi: false },
        });
        expect(headerOcr).not.toHaveBeenCalled();
        expect(r.needs_choice).toBe(true);
    });

    it('AI con confidenza high: tipo accettato ma mai oltre medium, source ai, 1 chiamata', async () => {
        const chatFn = aiReturning({ doc_type: 'patentino_saldatore', confidence: 'high', reason: 'certificato saldatore' });
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'a.pdf', text: 'Attestato di abilitazione alla saldatura a filo continuo rilasciato dopo esame pratico',
            deps: { chatFn, hasAi: true, headerOcr: null },
        });
        expect(chatFn).toHaveBeenCalledTimes(1);
        expect(r).toEqual(expect.objectContaining({
            detected_doc_type: 'patentino_saldatore', confidence: 'medium', classification_source: 'ai', needs_choice: false, ai_calls: 1,
        }));
    });

    it('AI con confidenza low: da scegliere', async () => {
        const chatFn = aiReturning({ doc_type: 'cert_ndt', confidence: 'low' });
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'a.pdf', text: 'Documento generico senza riferimenti a norme di qualifica del personale',
            deps: { chatFn, hasAi: true, headerOcr: null },
        });
        expect(r.confidence).toBe('low');
        expect(r.needs_choice).toBe(true);
        expect(r.ai_calls).toBe(1);
    });

    it('AI risponde altro: da scegliere', async () => {
        const chatFn = aiReturning({ doc_type: 'altro', confidence: 'high' });
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'a.pdf', text: 'Lettera commerciale su fornitura di materiali per carpenteria metallica',
            deps: { chatFn, hasAi: true, headerOcr: null },
        });
        expect(r.detected_doc_type).toBe('altro');
        expect(r.needs_choice).toBe(true);
    });

    it('AI in errore: nessuna eccezione, da scegliere', async () => {
        const chatFn = jest.fn(async () => { throw new Error('provider KO'); });
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'a.pdf', text: 'Documento generico senza riferimenti a norme di qualifica del personale',
            deps: { chatFn, hasAi: true, headerOcr: null },
        });
        expect(r.needs_choice).toBe(true);
        expect(r.reasons.join(' ')).toMatch(/AI non disponibile/);
    });

    it('AI non configurata: nessuna chiamata, da scegliere', async () => {
        const chatFn = jest.fn();
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'a.pdf', text: 'Documento generico senza riferimenti a norme di qualifica del personale',
            deps: { chatFn, hasAi: false, headerOcr: null },
        });
        expect(chatFn).not.toHaveBeenCalled();
        expect(r.needs_choice).toBe(true);
        expect(r.ai_calls).toBe(0);
    });

    it('testo vuoto (file ambiguo/bianco): low, nessuna AI, motivo esplicito', async () => {
        const chatFn = jest.fn();
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'scan.pdf', text: '', deps: { chatFn, hasAi: true, headerOcr: null },
        });
        expect(chatFn).not.toHaveBeenCalled();
        expect(r.confidence).toBe('low');
        expect(r.reasons.join(' ')).toMatch(/non leggibile/);
    });

    it('coordinatore 14731: altro low senza spendere AI', async () => {
        const chatFn = jest.fn();
        const r = await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: 'a.pdf', text: 'Certificato coordinatore di saldatura ISO 14731 IWE livello completo',
            deps: { chatFn, hasAi: true, headerOcr: null },
        });
        expect(chatFn).not.toHaveBeenCalled();
        expect(r.detected_doc_type).toBe('altro');
        expect(r.needs_choice).toBe(true);
    });

    it('log: nessun nome file in chiaro, conteggio AI presente', async () => {
        await classifyQualificationDocType({
            pdfBuffer: Buffer.from('x'), fileName: '99-00000_ZZROSSI ZZMARIO_14732.pdf', text: T_14732, deps: noAiDeps,
        });
        const logged = logger.info.mock.calls.map((c) => String(c[0])).join('\n');
        expect(logged).toMatch(/\[QualifClassify\].*aiCalls=0/);
        expect(logged).not.toContain('ZZROSSI');
        expect(logged).not.toContain('99-00000_');
    });
});

describe('overrideClassification', () => {
    it('override: source override, confidenza high, nessuna chiamata AI', () => {
        expect(overrideClassification('cert_ndt')).toEqual(expect.objectContaining({
            detected_doc_type: 'cert_ndt', confidence: 'high', classification_source: 'override', needs_choice: false, ai_calls: 0,
        }));
    });
});
