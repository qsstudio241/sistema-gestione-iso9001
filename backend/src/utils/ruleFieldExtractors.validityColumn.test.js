/**
 * @jest-environment node
 *
 * Campo di VALIDITA' ISO 9606-1 (colonna "Campo di validità"): dettagli di saldatura e spessore.
 * Fixture sintetiche che riproducono le righe del testo estratto dai certificati reali
 * (PROVA e VALIDITA' sulla stessa riga, prefisso ripetuto). Nessun PDF, nessun dato personale.
 */

const {
    sanitizeWeldDetails,
    extractValidityColumnPairs,
    parseThicknessValidity,
    extractWeldDetailsValidity,
    extractThicknessValidity,
    extractPatentinoFields,
} = require('./ruleFieldExtractors');

const DIAMETER_ROW_RE = /\u00D8\s*Diam\.?\s*esterno\s*tubo(?:\s*\/\s*Outside\s+pipe\s+diameter(?:\s*\(mm\))?)?/i;

const TESTO_012 = [
    'CERTIFICATO DI QUALIFICAZIONE DEL SALDATORE',
    'Nome: ZZ TITOLARE SINTETICO',
    'ISO 9606-1: 141 T FW FM5 S t3-10 D48,25 PB sl',
    'Variabili / Variables PROVA / Test piece VALIDITA\' / Range of approval',
    'Plate or pipe PIPE PLATE, PIPE',
    'Spessore / Thickness (mm)',
    'a) 3 a) >=3',
    'b) 10 b) >=3',
    '\u00D8 Diam. esterno tubo / Outside pipe diameter (mm)',
    'D1) 48,25 D1) >=25',
    'Particolari di saldatura / Weld details',
    'a) sl a) sl',
    'Welding position PB PB',
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
    'Welding position PB PB',
].join('\n');

describe('sanitizeWeldDetails', () => {
    it.each([
        ['sl', 'sl'],
        ['sl, ml', 'sl, ml'],
        ['sl ml', 'sl, ml'],
        ['SS NB', 'SS, NB'],
        ['ss, nb, ss', 'ss, nb'],
        ['sl, PIPE PLATE', 'sl'],
        ['PIPE PLATE, PIPE', null],
        ['derivazione/branch tubo-piastra', null],
        ['N.A.', null],
        ['', null],
        [null, null],
        [undefined, null],
    ])('%j -> %j', (input, expected) => {
        expect(sanitizeWeldDetails(input)).toBe(expected);
    });
});

describe('extractValidityColumnPairs', () => {
    it('riga con etichetta sola e coppie sulle righe successive', () => {
        const pairs = extractValidityColumnPairs('Spessore / Thickness (mm)\na) 3 a) >=3\nb) 10 b) >=3\nAltro testo', /Spessore/, /^[a-d]$/);
        expect(pairs).toEqual([
            { prefix: 'a', test: '3', validity: '>=3' },
            { prefix: 'b', test: '10', validity: '>=3' },
        ]);
    });

    it('prima coppia sulla stessa riga dell\'etichetta', () => {
        const pairs = extractValidityColumnPairs('Thickness (mm) a) 3 a) >=3\nb) 10 b) >=3', /Thickness(?:\s*\(mm\))?/, /^[a-d]$/);
        expect(pairs.map((p) => p.validity)).toEqual(['>=3', '>=3']);
    });

    it('validita\' vuota (N.A. in prova, nulla in validita\')', () => {
        const pairs = extractValidityColumnPairs(TESTO_028, DIAMETER_ROW_RE);
        expect(pairs).toEqual([{ prefix: 'D1', test: 'N.A.', validity: '' }]);
    });

    it('diametro 012: prova 48,25 e validita\' >=25', () => {
        const pairs = extractValidityColumnPairs(TESTO_012, DIAMETER_ROW_RE);
        expect(pairs).toEqual([{ prefix: 'D1', test: '48,25', validity: '>=25' }]);
    });

    it('il filtro prefisso scarta le coppie D1) sotto una riga spessore', () => {
        const text = 'Spessore / Thickness (mm)\nD1) 48,25 D1) >=25';
        expect(extractValidityColumnPairs(text, /Spessore/, /^[a-d]$/)).toEqual([]);
    });

    it('layout non riconosciuto (nessun prefisso ripetuto) -> nessuna coppia', () => {
        const text = 'Spessore / Thickness (mm)\n3 mm\n>=3';
        expect(extractValidityColumnPairs(text, /Spessore/, /^[a-d]$/)).toEqual([]);
    });
});

describe('parseThicknessValidity', () => {
    it.each([
        ['>=3', { min: 3, max: null, unlimited: true }],
        ['\u22653', { min: 3, max: null, unlimited: true }],
        ['=> 3 mm', { min: 3, max: null, unlimited: true }],
        ['3-10', { min: 3, max: 10, unlimited: false }],
        ['3 \u2013 10', { min: 3, max: 10, unlimited: false }],
        ['3 - 10 mm', { min: 3, max: 10, unlimited: false }],
        ['da 3 a 10', { min: 3, max: 10, unlimited: false }],
        ['3..10', { min: 3, max: 10, unlimited: false }],
        ['2,5-5', { min: 2.5, max: 5, unlimited: false }],
        ['3 - unlimited', { min: 3, max: null, unlimited: true }],
        ['da 3 a illimitato', { min: 3, max: null, unlimited: true }],
        ['unlimited', { min: null, max: null, unlimited: true }],
        ['illimitato', { min: null, max: null, unlimited: true }],
        ['senza limite', { min: null, max: null, unlimited: true }],
    ])('%j', (raw, expected) => {
        expect(parseThicknessValidity(raw)).toEqual(expected);
    });

    it.each(['', null, 'N.A.', '12', '10-3', 'abc'])('%j non riconosciuto -> null', (raw) => {
        expect(parseThicknessValidity(raw)).toBeNull();
    });
});

describe('fixture sul testo reale (nomi fittizi): certificato 012', () => {
    it('dettagli di saldatura: solo la validita\' (sl), la riga tubo/piastra non contamina', () => {
        expect(extractWeldDetailsValidity(TESTO_012)).toEqual({ value: 'sl' });
    });

    it('spessore: validita\' >=3 -> min 3, nessun massimo (t3-10 sono due spessori di prova)', () => {
        expect(extractThicknessValidity(TESTO_012)).toEqual({ min: 3, max: null, unlimited: true });
    });

    it('estrattore patentino: weld_details non viene piu\' dalla designazione stampata', () => {
        const f = extractPatentinoFields(TESTO_012, 'cert.pdf');
        expect(f.weld_details).toBeUndefined();
        expect(f.thickness_t_test_mm).toBe(3);
        expect(f.thickness_max_mm).toBeUndefined();
    });
});

describe('fixture sul testo reale (nomi fittizi): certificato 028', () => {
    it('dettagli di saldatura: validita\' "sl, ml", non il ml della prova', () => {
        expect(extractWeldDetailsValidity(TESTO_028)).toEqual({ value: 'sl, ml' });
    });

    it('spessore: >=3 -> min 3 senza massimo (la prova 12 resta nel PDF)', () => {
        expect(extractThicknessValidity(TESTO_028)).toEqual({ min: 3, max: null, unlimited: true });
    });

    it('la designazione stampata con "ml" non produce piu\' weld_details dalle regole', () => {
        expect(extractPatentinoFields(TESTO_028, 'cert.pdf').weld_details).toBeUndefined();
    });
});

describe('varianti e casi limite', () => {
    it('etichetta con ordine inglese/italiano invertito', () => {
        expect(extractThicknessValidity('Thickness / Spessore (mm)\na) 12 a) >=3')).toEqual({ min: 3, max: null, unlimited: true });
    });

    it('etichetta inglese sola "Weld details" e dettagli multipli a)/b)', () => {
        const text = 'Weld details\na) ss nb a) ss, nb\nb) ss nb b) nb';
        expect(extractWeldDetailsValidity(text)).toEqual({ value: 'ss, nb' });
    });

    it('validita\' vuota o N.A. sulla riga dettagli -> riga riconosciuta, valore null (niente dato di prova)', () => {
        expect(extractWeldDetailsValidity('Weld details\na) ml a) ')).toEqual({ value: null });
        expect(extractWeldDetailsValidity('Weld details\na) ml a) N.A.')).toEqual({ value: null });
    });

    it('layout non riconosciuto (altro emittente / OCR): null, nessuna invenzione', () => {
        expect(extractWeldDetailsValidity('Weld details: ml\nTipo prodotto: tubo')).toBeNull();
        expect(extractThicknessValidity('Spessore: 12 mm\nRange of approval 3 - 24')).toBeNull();
        expect(extractThicknessValidity('')).toBeNull();
    });

    it('spessore: formati alternativi nella colonna validita\'', () => {
        const row = (v) => `Spessore / Thickness (mm)\na) 12 a) ${v}\nb) 12 b) ${v}`;
        expect(extractThicknessValidity(row('\u22653'))).toEqual({ min: 3, max: null, unlimited: true });
        expect(extractThicknessValidity(row('3-10'))).toEqual({ min: 3, max: 10, unlimited: false });
        expect(extractThicknessValidity(row('3 \u2013 10'))).toEqual({ min: 3, max: 10, unlimited: false });
        expect(extractThicknessValidity(row('da 3 a 10'))).toEqual({ min: 3, max: 10, unlimited: false });
        expect(extractThicknessValidity(row('3..10'))).toEqual({ min: 3, max: 10, unlimited: false });
        expect(extractThicknessValidity(row('3 - unlimited'))).toEqual({ min: 3, max: null, unlimited: true });
        expect(extractThicknessValidity(row('unlimited'))).toEqual({ min: null, max: null, unlimited: true });
    });

    it('validita\' a) e b) diverse: ambiguo, nessuna scelta (resta l\'AI)', () => {
        const text = 'Spessore / Thickness (mm)\na) 3 a) 3-10\nb) 12 b) >=3';
        expect(extractThicknessValidity(text)).toBeNull();
    });

    it('una sola riga con validita\' (l\'altra vuota): si usa quella presente', () => {
        const text = 'Spessore / Thickness (mm)\na) 3 a) >=3\nb) 10 b) ';
        expect(extractThicknessValidity(text)).toEqual({ min: 3, max: null, unlimited: true });
    });

    it('validita\' non leggibile: nessuna deduzione', () => {
        const text = 'Spessore / Thickness (mm)\na) 3 a) boh';
        expect(extractThicknessValidity(text)).toBeNull();
    });
});
