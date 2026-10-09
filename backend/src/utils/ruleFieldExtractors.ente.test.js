/**
 * @jest-environment node
 *
 * Chiusura smoke ingest qualifiche saldatori (09/10/2026): ente TEC Eurolab e varianti, esaminatore
 * ("Examiner or examining body") come rule-fill, non regressione sugli altri enti.
 * Fixture sintetiche: nomi/numeri fittizi, struttura ricavata dai moduli ISO 9606-1 / ISO 14732 Annex C.
 */

const {
    extractIssuingBody,
    extractExaminerBody,
    extractPatentinoFields,
    extractQualifica14732Fields,
} = require('./ruleFieldExtractors');
const { normalizeIssuingBodyCode, normalizeIngestSelectFields } = require('./textEncodingRepair');
const { mergeExtractions, pickMergedValue } = require('../services/documentIngestPipeline.service');

jest.mock('../services/aiProviderAdapter', () => ({ getActiveProvider: jest.fn(), chat: jest.fn() }));
jest.mock('../services/importAiExtraction.service', () => ({ extractStructuredByDocType: jest.fn() }));

const TEC_VARIANTS = [
    'TEC Eurolab',
    'TEC EUROLAB',
    'Tec Eurolab S.r.l.',
    'TECEUROLAB',
    'TEC Eurolab Srl',
    'TEC-Eurolab',
    'T.E.C. Eurolab S.r.l.',
    'TEC  Eurolab',
    'TEC Euro Lab',
    'tec_eurolab',
];

describe('ente certificatore: TEC Eurolab e varianti', () => {
    it.each(TEC_VARIANTS)('percorso AI: %j -> tec_eurolab', (value) => {
        expect(normalizeIssuingBodyCode(value)).toBe('tec_eurolab');
        expect(normalizeIngestSelectFields({ issuing_body: value }).issuing_body).toBe('tec_eurolab');
    });

    it.each([
        ['TEC Eurolab S.r.l.'],
        ['TEC EUROLAB'],
        ['TECEUROLAB'],
        ['TEC Eurolab Srl'],
        ['T.E.C. Eurolab'],
        ['TEC\nEurolab S.r.l.'],
        ['TEC  Eurolab'],
        ['Tec-Eurolab'],
    ])('fallback a regole: %j -> TEC Eurolab', (text) => {
        expect(extractIssuingBody(`Certificato di qualifica\n${text}\nNome: MARIO ROSSI`)).toBe('TEC Eurolab');
    });

    it('end to end: regole + normalizzazione -> tec_eurolab su patentino e 14732', () => {
        const text = 'Welder qualification\nTEC\nEurolab S.r.l.\nNome: MARIO ROSSI';
        const merged = mergeExtractions(extractPatentinoFields(text, 'x.pdf'), {}, 'patentino_saldatore');
        expect(normalizeIngestSelectFields(merged.fields).issuing_body).toBe('tec_eurolab');
        const merged14732 = mergeExtractions(extractQualifica14732Fields(text, 'x.pdf'), {}, 'qualifica_14732');
        expect(normalizeIngestSelectFields(merged14732.fields).issuing_body).toBe('tec_eurolab');
    });

    it('end to end: valore AI "TEC Eurolab S.r.l." vince sulle regole e diventa tec_eurolab', () => {
        const merged = mergeExtractions({ issuing_body: 'IIS' }, { issuing_body: 'TEC Eurolab S.r.l.' }, 'patentino_saldatore');
        expect(normalizeIngestSelectFields(merged.fields).issuing_body).toBe('tec_eurolab');
    });
});

describe('ente certificatore: non regressione sugli altri enti', () => {
    it.each([
        ['TÜV Rheinland', 'tuv'],
        ['TUV SUD', 'tuv'],
        ['Bureau Veritas Italia', 'bv'],
        ['DNV GL', 'dnv'],
        ['RINA Services S.p.A.', 'rina'],
        ['IMQ', 'imq'],
        ['IQNet', 'iqn'],
        ['CSQ Certiquality', 'csq'],
        ['Sideius', 'sideius'],
        ['Ente sconosciuto', 'altro'],
        ['IIS', 'altro'],
        ['iis_isscert', 'altro'],
    ])('AI: %j -> %s (invariato)', (value, expected) => {
        expect(normalizeIssuingBodyCode(value)).toBe(expected);
    });

    it.each([
        ['Bureau Veritas Italia S.p.A.', 'Bureau Veritas'],
        ['Certificato DNV GL', 'DNV'],
        ["Lloyd's Register", 'Lloyd'],
        ['RINA Services', 'RINA'],
        ['TÜV Rheinland', 'TÜV'],
        ['TUV SUD', 'TÜV'],
        ['IMQ S.p.A.', 'IMQ'],
        ['IIS Progress', 'IIS'],
        ['CICPND', 'CICPND'],
        ['SGS Italia', 'SGS'],
        ['Sideius', 'Sideius'],
        ['BSI Group', 'BSI'],
    ])('regole: %j -> %s (invariato)', (text, expected) => {
        expect(extractIssuingBody(text)).toBe(expected);
    });

    it('ordine storico invariato: con piu enti vince il primo della lista', () => {
        expect(extractIssuingBody('Accreditato DNV, rilasciato da TEC Eurolab')).toBe('DNV');
    });

    it('le sigle brevi non scattano dentro altre parole', () => {
        expect(extractIssuingBody('Maria Katerina Rossi, via Marina 4')).toBeNull();
        expect(extractIssuingBody('Radiis Absiter Ssgst')).toBeNull();
    });

    it('nessun ente -> null', () => {
        expect(extractIssuingBody('')).toBeNull();
        expect(extractIssuingBody(null)).toBeNull();
    });
});

describe('esaminatore: label "Examiner or examining body" (rule-fill)', () => {
    it('stessa riga, persona con titolo IWI', () => {
        expect(extractExaminerBody('Examiner or examining body: I.W.I. BIANCHI LUCA\nDate of test 10.01.2025'))
            .toBe('I.W.I. BIANCHI LUCA');
    });

    it('valore sulla riga successiva', () => {
        expect(extractExaminerBody('Examiner or examining body\nLuca Bianchi (IWI)\nReference No.')).toBe('Luca Bianchi (IWI)');
    });

    it('Annex C ISO 14732: etichetta con "Reference No." e numero di riferimento in coda', () => {
        const text = 'Examiner or examining body \u2013 Reference No.\nTEC Eurolab S.r.l. \u2013 25-00000-00-001\nPhotograph';
        expect(extractExaminerBody(text)).toBe('TEC Eurolab S.r.l.');
    });

    it('stessa riga con riferimento in coda', () => {
        expect(extractExaminerBody('Examiner or examining body - Reference No. IWI Luca Bianchi Ref. 25-00000-00-001'))
            .toBe('IWI Luca Bianchi');
    });

    it('etichette italiane', () => {
        expect(extractExaminerBody("Esaminatore o ente d'esame: Ing. Luca Bianchi (IWI)")).toBe('Ing. Luca Bianchi (IWI)');
        expect(extractExaminerBody("Nome dell'esaminatore\nBianchi Luca IWE")).toBe('Bianchi Luca IWE');
    });

    it('blocco firma 14732 senza valore: salta alla successiva occorrenza valida', () => {
        const text = [
            'Name, date and signature',
            'Examiner or examining body',
            'Date of welding of test piece  10.01.2025',
            'Location',
            'Examiner or examining body: Luca Bianchi (IWI)',
        ].join('\n');
        expect(extractExaminerBody(text)).toBe('Luca Bianchi (IWI)');
    });

    it.each([
        'Examiner or examining body\nDate of welding of test piece 10.01.2025',
        'Examiner or examining body\nSignature',
        'Examiner or examining body \u2013 Reference No.\n25-00000-00-001',
        'The examiner shall verify the test piece',
        "L'esaminatore ha verificato il provino",
        '',
    ])('non inventa valori: %j', (text) => {
        expect(extractExaminerBody(text)).toBeNull();
    });

    it('e esposto da patentino e 14732 e vale come fallback solo a campo AI vuoto', () => {
        const text = 'Nome: MARIO ROSSI\nExaminer or examining body: I.W.I. BIANCHI LUCA\nValid until 02.03.2027';
        expect(extractPatentinoFields(text, 'x.pdf').examiner_body).toBe('I.W.I. BIANCHI LUCA');
        expect(extractQualifica14732Fields(text, 'x.pdf').examiner_body).toBe('I.W.I. BIANCHI LUCA');

        const rules = { examiner_body: 'I.W.I. BIANCHI LUCA' };
        expect(pickMergedValue('examiner_body', rules, { examiner_body: null }).value).toBe('I.W.I. BIANCHI LUCA');
        expect(pickMergedValue('examiner_body', rules, { examiner_body: 'Christian Verdi (IWI)' }).value).toBe('Christian Verdi (IWI)');
        const merged = mergeExtractions(rules, { examiner_body: '' }, 'qualifica_14732');
        expect(merged.fields.examiner_body).toBe('I.W.I. BIANCHI LUCA');
        expect(merged.fieldSources.examiner_body).toBe('rules');
    });

    it('WPQR invariato: examiner_body continua a derivare dall ente', () => {
        const { extractWpqrFields } = require('./ruleFieldExtractors');
        expect(extractWpqrFields('Record\nBureau Veritas', '25-01341-02.pdf').examiner_body).toBe('Bureau Veritas');
    });
});
