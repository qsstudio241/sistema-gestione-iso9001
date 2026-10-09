/**
 * @jest-environment node
 *
 * Evidenza reale dello smoke ingest qualifiche (anonimizzata, ricostruita con fixture sintetiche):
 * (b) esaminatore "I.W.I. <nome>" / "IWI - <nome>" sotto "Name and signature Examining Body / examiner";
 * (c) metodo 14732 §4.1 a/b/c/d con "x" isolata (OCR tesseract.js) o colonna "-- -- X --" (testo);
 * (d) ente TEC Eurolab nelle varianti OCR (logo, piè di pagina, dominio, email sporca).
 * Nomi e numeri fittizi.
 */

const {
    extractIssuingBody,
    extractExaminerBody,
    extractQualificationMethod14732,
    extractQualifica14732Fields,
} = require('./ruleFieldExtractors');
const { normalizeIssuingBodyCode, normalizeIngestSelectFields } = require('./textEncodingRepair');
const { mergeExtractions, pickMergedValue } = require('../services/documentIngestPipeline.service');

jest.mock('../services/aiProviderAdapter', () => ({ getActiveProvider: jest.fn(), chat: jest.fn() }));
jest.mock('../services/importAiExtraction.service', () => ({ extractStructuredByDocType: jest.fn() }));

describe('(b) esaminatore: blocco firma con "I.W.I. <nome>"', () => {
    it('012/028 (testo): nome nella riga immediatamente successiva all etichetta', () => {
        const text = [
            'Nome e firma Organismo di Esame / Name and signature Examining Body',
            'I.W.I. ROSSI MARIO',
            'Luogo / Place: Roma',
        ].join('\n');
        expect(extractExaminerBody(text)).toBe('I.W.I. ROSSI MARIO');
    });

    it('738 (testo): nome ~9 righe dopo l etichetta, dopo luogo, data e costruttore', () => {
        const text = [
            'Name and signature examiner',
            'Place',
            'Roma',
            'Date',
            '10.01.2025',
            'Manufacturer',
            'ACME S.p.A.',
            '',
            'Stamp',
            'IWI - Mario Rossi',
        ].join('\n');
        expect(extractExaminerBody(text)).toBe('IWI - Mario Rossi');
    });

    it('121 (OCR): nome 2 righe dopo l etichetta, spazzatura finale rimossa, firma a mano non presa', () => {
        const text = [
            'Name and signature examiner',
            'sl ee Mio Mi',
            'IWI - Mario Rossi sles ee , a -- ~~ 1 |',
            'Nome!e tima esatta Organismo',
        ].join('\n');
        expect(extractExaminerBody(text)).toBe('IWI - Mario Rossi');
    });

    it('121 (OCR): la riga successiva (firma a mano) non viene presa se manca la riga IWI', () => {
        const text = [
            'Name and signature examiner',
            'sles ee Mio Mi a',
            'Firmato digitalmente da ROSSI MARIO',
        ].join('\n');
        expect(extractExaminerBody(text)).toBeNull();
    });

    it('121 (OCR): stampigliatura ruotata ridotta a spazzatura non interferisce', () => {
        const text = [
            'Name and signature examiner',
            '|| ~~ .. 1l',
            'IWI Mario Rossi',
            'ee - ! Firmato Zz Za digitalmente',
        ].join('\n');
        expect(extractExaminerBody(text)).toBe('IWI Mario Rossi');
    });

    it('normalizza doppi spazi e punti: "I. W. I.   Maria  De Luca"', () => {
        const text = 'Name and signature Examining Body\nI. W. I.   Maria  De   Luca\n';
        expect(extractExaminerBody(text)).toBe('I.W.I. Maria De Luca');
    });

    it('nome tra virgolette di firma digitale non è inventato: nessuna riga IWI -> ripiego per etichetta senza prendere la firma', () => {
        const text = 'Name and signature Examining Body\nsles ee Mio\nDate 10.01.2025';
        expect(extractExaminerBody(text)).toBeNull();
    });

    it('resta valido l ancoraggio alle etichette "Examiner or examining body" (ripiego)', () => {
        expect(extractExaminerBody('Examiner or examining body: Ing. Luca Bianchi (IWI)')).toBe('Ing. Luca Bianchi (IWI)');
    });

    it('rule-fill solo a campo AI vuoto: l AI vince', () => {
        const rule = { examiner_body: 'I.W.I. ROSSI MARIO' };
        expect(pickMergedValue('examiner_body', rule, { examiner_body: null }, 'qualifica_14732').value).toBe('I.W.I. ROSSI MARIO');
        expect(pickMergedValue('examiner_body', rule, { examiner_body: 'Mario Rossi (IWI)' }, 'qualifica_14732').value)
            .toBe('Mario Rossi (IWI)');
    });
});

const OCR_X_ISOLATA = [
    '4.1 Qualification method',
    '4.1 a) Welding procedure test ISO 15614 -',
    '4.1 b) Pre-production welding test ISO 15613 -',
    '4.1 c) Welder qualification test ISO 9606',
    '4.1 d) Production welding test -',
    'x',
    'Nome!e tima esatta',
].join('\n');

const TESTO_COLONNA = [
    '4.1 a) Welding procedure test ISO 15614',
    '4.1 b) Pre-production welding test ISO 15613',
    '4.1 c) Welder qualification test ISO 9606',
    '4.1 d) Production welding test',
    '--',
    '--',
    'X',
    '--',
].join('\n');

describe('(c) metodo di qualifica 14732 §4.1', () => {
    it('OCR con "x" isolata dopo la d): va alla voce senza marcatore (c) -> iso_9606', () => {
        expect(extractQualificationMethod14732(OCR_X_ISOLATA)).toBe('iso_9606');
    });

    it('testo con colonna "-- -- X --" -> iso_9606', () => {
        expect(extractQualificationMethod14732(TESTO_COLONNA)).toBe('iso_9606');
    });

    it('colonna con la X nella quarta posizione -> production_test', () => {
        expect(extractQualificationMethod14732(TESTO_COLONNA.replace('X\n--', '--\nX'))).toBe('production_test');
    });

    it('x isolata dopo la d) con tutte le altre voci a trattino -> d) production_test (non ambiguo)', () => {
        const text = OCR_X_ISOLATA.replace('ISO 9606', 'ISO 9606 -').replace('Production welding test -', 'Production welding test');
        expect(extractQualificationMethod14732(text)).toBe('production_test');
    });

    it.each([
        ['x', 'ISO 9606 x', 'iso_9606'],
        ['[x]', 'ISO 9606 [x]', 'iso_9606'],
        ['check', 'ISO 9606 \u2713', 'iso_9606'],
        ['box', 'ISO 9606 \u2612', 'iso_9606'],
    ])('marcatore sulla stessa riga (%s) -> non ambiguo', (_n, c, expected) => {
        const text = [
            '4.1 a) ISO 15614 -',
            '4.1 b) ISO 15613 -',
            `4.1 c) ${c}`,
            '4.1 d) Production test -',
        ].join('\n');
        expect(extractQualificationMethod14732(text)).toBe(expected);
    });

    it('marcatore sulla riga della d) -> production_test', () => {
        const text = ['4.1 a) ISO 15614 -', '4.1 b) ISO 15613 -', '4.1 c) ISO 9606 -', '4.1 d) Production test [x]'].join('\n');
        expect(extractQualificationMethod14732(text)).toBe('production_test');
    });

    it('ambiguo: due voci senza trattino e x isolata -> null', () => {
        const text = ['4.1 a) ISO 15614 -', '4.1 b) ISO 15613 -', '4.1 c) ISO 9606', '4.1 d) Production test', 'x'].join('\n');
        expect(extractQualificationMethod14732(text)).toBeNull();
    });

    it('ambiguo: due marcatori -> null', () => {
        const text = ['4.1 a) ISO 15614 x', '4.1 b) ISO 15613 -', '4.1 c) ISO 9606 [x]', '4.1 d) Production test -'].join('\n');
        expect(extractQualificationMethod14732(text)).toBeNull();
    });

    it('ambiguo: nessun marcatore o blocco 4.1 assente -> null', () => {
        expect(extractQualificationMethod14732(['4.1 a) ISO 15614 -', '4.1 b) ISO 15613 -', '4.1 c) ISO 9606', '4.1 d) Production test -'].join('\n'))).toBeNull();
        expect(extractQualificationMethod14732('Certificato senza elenco metodi')).toBeNull();
        expect(extractQualificationMethod14732('')).toBeNull();
    });

    it('esposto da extractQualifica14732Fields', () => {
        expect(extractQualifica14732Fields(OCR_X_ISOLATA, 'x.pdf').qualification_method).toBe('iso_9606');
    });

    describe('merge AI + regola', () => {
        const rule = extractQualifica14732Fields(OCR_X_ISOLATA, 'x.pdf');

        it('AI production_test + x isolata strutturale -> corretto a iso_9606', () => {
            const merged = mergeExtractions(rule, { qualification_method: 'production_test' }, 'qualifica_14732');
            expect(merged.fields.qualification_method).toBe('iso_9606');
        });

        it('AI coerente (iso_9606) resta invariata', () => {
            const merged = mergeExtractions(rule, { qualification_method: 'iso_9606' }, 'qualifica_14732');
            expect(merged.fields.qualification_method).toBe('iso_9606');
        });

        it('AI diversa non production_test (es. iso_15614) non viene sovrascritta', () => {
            const merged = mergeExtractions(rule, { qualification_method: 'iso_15614' }, 'qualifica_14732');
            expect(merged.fields.qualification_method).toBe('iso_15614');
        });

        it('AI production_test e regola ambigua (null) -> invariato', () => {
            const ambiguous = extractQualifica14732Fields(['4.1 a) -', '4.1 b) -', '4.1 c) ISO 9606', '4.1 d) PT', 'x'].join('\n'), 'x.pdf');
            const merged = mergeExtractions(ambiguous, { qualification_method: 'production_test' }, 'qualifica_14732');
            expect(merged.fields.qualification_method).toBe('production_test');
        });

        it('AI vuota -> rule-fill', () => {
            expect(mergeExtractions(rule, {}, 'qualifica_14732').fields.qualification_method).toBe('iso_9606');
        });

        it('la correzione vale solo per qualifica_14732', () => {
            expect(pickMergedValue('qualification_method', { qualification_method: 'iso_9606' },
                { qualification_method: 'production_test' }, 'patentino_saldatore').value).toBe('production_test');
        });
    });
});

describe('(d) ente TEC Eurolab: varianti OCR reali', () => {
    it.each([
        'A) TEC-Eurolab\nCERTIFICATION BODY',
        '\u00ABA TEC-Eurolab\nCERTIFICATION BODY',
        'TEC:Eurolab',
        'TEC Eurolab S.r.l.\nViale Europa, 40 Campogalliano (MO), Italia',
        'TEC Eurolab S.r.L',
        'www.tec-eurolab.com',
        'info[@tec-eurolab.com',
        'infodtec-eurolab.com',
        'info(atec-eurolab.com',
        'info@tec-eurolab.com',
    ])('%j -> TEC Eurolab / tec_eurolab', (text) => {
        expect(extractIssuingBody(`Certificato\n${text}\nACCREDIA PRS N\u00B0 123`)).toBe('TEC Eurolab');
        expect(normalizeIngestSelectFields({ issuing_body: extractIssuingBody(text) }).issuing_body).toBe('tec_eurolab');
    });

    it.each(['TEC-Eurolab', 'TEC:Eurolab', 'TEC Eurolab S.r.L', 'tec-eurolab.com', 'info@tec-eurolab.com'])(
        'normalizzatore AI: %j -> tec_eurolab',
        (v) => expect(normalizeIssuingBodyCode(v)).toBe('tec_eurolab')
    );

    it('senza alcuna occorrenza nel testo (solo grafica) non si inventa l ente', () => {
        const text = 'Mod. ISO 9606-1 rev.04\nName and signature Examining Body\nI.W.I. ROSSI MARIO\nACCREDIA';
        expect(extractIssuingBody(text)).toBeNull();
    });

    it('non regressione: altri enti invariati con testo OCR sporco', () => {
        expect(extractIssuingBody('Bureau Veritas Italia\nCertification body')).toBe('Bureau Veritas');
        expect(extractIssuingBody('RINA Services S.p.A.')).toBe('RINA');
        expect(extractIssuingBody('Katerina Bianchi')).toBeNull();
    });
});
