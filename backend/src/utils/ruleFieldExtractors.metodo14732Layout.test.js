/**
 * @jest-environment node
 */
/**
 * Metodo di qualifica 14732 §4.1: marcatore isolato assegnato per posizione (layout OCR tesseract.js).
 * Fixture sintetiche: nessun PDF o dato reale.
 */
const {
    extractQualificationMethod14732,
    extractQualificationMethod14732FromLayout,
    extractQualifica14732Fields,
    extractFieldsByRules,
} = require('./ruleFieldExtractors');
const { pickMergedValue, mergeExtractions } = require('../services/documentIngestPipeline.service');

jest.mock('../services/aiProviderAdapter', () => ({ getActiveProvider: jest.fn(), chat: jest.fn() }));
jest.mock('../services/importAiExtraction.service', () => ({ extractStructuredByDocType: jest.fn() }));

const bb = (y0, y1, x0 = 80, x1 = 900) => ({ x0, y0, x1, y1 });

const ROW_A = bb(100, 130);
const ROW_B = bb(160, 190);
const ROW_C = bb(220, 250);
const ROW_D = bb(280, 310);

/** Struttura reale: a) e b) con "-", c) e d) senza marcatore, "x" isolata su riga propria dopo la d). */
const TESTO_AMBIGUO = [
    '4.1 Qualification method',
    '4.1 a) Welding procedure test ISO 15614 -',
    '4.1 b) Pre-production welding test ISO 15613 -',
    '4.1 c) Welder qualification test ISO 9606',
    '4.1 d) Production welding test',
    'x',
].join('\n');

function layoutLines(xBox) {
    return [{
        page: 1,
        lines: [
            { text: '4.1 Qualification method', bbox: bb(60, 90) },
            { text: '4.1 a) Welding procedure test ISO 15614 -', bbox: ROW_A },
            { text: '4.1 b) Pre-production welding test ISO 15613 -', bbox: ROW_B },
            { text: '4.1 c) Welder qualification test ISO 9606', bbox: ROW_C },
            { text: '4.1 d) Production welding test', bbox: ROW_D },
            { text: 'x', bbox: xBox },
        ],
    }];
}

const X_IN_C = { x0: 950, y0: 226, x1: 966, y1: 244 };
const X_IN_D = { x0: 950, y0: 286, x1: 966, y1: 304 };

describe('extractQualificationMethod14732 con layout (marcatore isolato per posizione)', () => {
    it('(i) x isolata con y nel range della riga c) -> iso_9606', () => {
        expect(extractQualificationMethod14732(TESTO_AMBIGUO)).toBeNull();
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, layoutLines(X_IN_C))).toBe('iso_9606');
    });

    it('(i) stessa struttura con sole parole+bbox (righe ricomposte per y) -> iso_9606', () => {
        const words = [
            ['4.1', 80, 100, 120, 130], ['a)', 125, 100, 150, 130], ['ISO', 160, 100, 200, 130], ['15614', 205, 100, 280, 130], ['-', 600, 100, 620, 130],
            ['4.1', 80, 160, 120, 190], ['b)', 125, 160, 150, 190], ['ISO', 160, 160, 200, 190], ['15613', 205, 160, 280, 190], ['-', 600, 160, 620, 190],
            ['4.1', 80, 220, 120, 250], ['c)', 125, 220, 150, 250], ['ISO', 160, 220, 200, 250], ['9606', 205, 220, 280, 250],
            ['4.1', 80, 280, 120, 310], ['d)', 125, 280, 150, 310], ['Production', 160, 280, 260, 310],
            ['x', 950, 226, 966, 244],
        ].map(([text, x0, y0, x1, y1]) => ({ text, bbox: { x0, y0, x1, y1 } }));
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, [{ page: 1, words }])).toBe('iso_9606');
    });

    it('(ii) x nel range della riga d) -> production_test', () => {
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, layoutLines(X_IN_D))).toBe('production_test');
    });

    it('(iii) x fuori da ogni riga (tra b e c, nello spazio vuoto) -> null', () => {
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, layoutLines({ x0: 950, y0: 196, x1: 966, y1: 214 }))).toBeNull();
    });

    it('(iii) x a cavallo tra due righe -> null', () => {
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, layoutLines({ x0: 950, y0: 241, x1: 966, y1: 259 }))).toBeNull();
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, layoutLines({ x0: 950, y0: 250, x1: 966, y1: 280 }))).toBeNull();
    });

    it('(iii) x lontana dal blocco 4.1 -> ignorata -> null', () => {
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, layoutLines({ x0: 950, y0: 1500, x1: 966, y1: 1518 }))).toBeNull();
    });

    it('x che cade sulla riga a) con trattino (voce negata) -> null', () => {
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, layoutLines({ x0: 950, y0: 106, x1: 966, y1: 124 }))).toBeNull();
    });

    it('due marcatori isolati vicini al blocco -> null', () => {
        const layout = layoutLines(X_IN_C);
        layout[0].lines.push({ text: 'X', bbox: X_IN_D });
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, layout)).toBeNull();
    });

    it('marcatore in riga + marcatore isolato -> null', () => {
        const layout = layoutLines(X_IN_C);
        layout[0].lines[4].text = '4.1 d) Production welding test [x]';
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, layout)).toBeNull();
    });

    it('layout senza le voci a..d, vuoto o malformato -> null', () => {
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, [])).toBeNull();
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, [{ page: 1, lines: [{ text: 'x', bbox: X_IN_C }] }])).toBeNull();
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, 'boh')).toBeNull();
        expect(extractQualificationMethod14732FromLayout(null)).toBeNull();
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, [{ page: 1, lines: [{ text: '4.1 a)', bbox: { x0: 0, y0: 5, x1: 1, y1: 5 } }] }])).toBeNull();
    });

    it('(iv) nessun layout + stessa struttura testuale ambigua -> null (invariato)', () => {
        expect(extractQualificationMethod14732(TESTO_AMBIGUO)).toBeNull();
        expect(extractQualificationMethod14732(TESTO_AMBIGUO, null)).toBeNull();
        expect(extractQualifica14732Fields(TESTO_AMBIGUO, 'x.pdf').qualification_method).toBeNull();
    });

    it('(v) struttura "-- -- X --" invariata, con o senza layout', () => {
        const colonna = [
            '4.1 a) Welding procedure test ISO 15614', '4.1 b) Pre-production welding test ISO 15613',
            '4.1 c) Welder qualification test ISO 9606', '4.1 d) Production welding test',
            '--', '--', 'X', '--',
        ].join('\n');
        expect(extractQualificationMethod14732(colonna)).toBe('iso_9606');
        expect(extractQualificationMethod14732(colonna, layoutLines(X_IN_D))).toBe('iso_9606');
    });

    it('(v) marcatore sulla riga invariato; il testo ha la precedenza sul layout', () => {
        const text = ['4.1 a) ISO 15614 -', '4.1 b) ISO 15613 -', '4.1 c) ISO 9606 -', '4.1 d) Production test [x]'].join('\n');
        expect(extractQualificationMethod14732(text)).toBe('production_test');
        expect(extractQualificationMethod14732(text, layoutLines(X_IN_C))).toBe('production_test');
    });

    it('(v) ripiego testuale "x isolata + una sola voce senza marcatore" invariato', () => {
        const text = [
            '4.1 a) ISO 15614 -', '4.1 b) ISO 15613 -', '4.1 c) ISO 9606', '4.1 d) Production test -', 'x',
        ].join('\n');
        expect(extractQualificationMethod14732(text)).toBe('iso_9606');
    });

    it('il layout arriva fino al campo via extractFieldsByRules / extractQualifica14732Fields', () => {
        const layout = layoutLines(X_IN_C);
        expect(extractQualifica14732Fields(TESTO_AMBIGUO, 'x.pdf', { ocrLayout: layout }).qualification_method).toBe('iso_9606');
        expect(extractFieldsByRules(TESTO_AMBIGUO, 'qualifica_14732', 'x.pdf', { ocrLayout: layout }).qualification_method).toBe('iso_9606');
        expect(extractFieldsByRules(TESTO_AMBIGUO, 'qualifica_14732', 'x.pdf').qualification_method).toBeNull();
    });
});

describe('merge AI + regola da layout', () => {
    const ruleFromLayout = extractQualifica14732Fields(TESTO_AMBIGUO, 'x.pdf', { ocrLayout: layoutLines(X_IN_C) });

    it('(vi) AI production_test + regola da layout iso_9606 -> corretto', () => {
        const merged = mergeExtractions(ruleFromLayout, { qualification_method: 'production_test' }, 'qualifica_14732');
        expect(merged.fields.qualification_method).toBe('iso_9606');
        expect(merged.fieldSources.qualification_method).toBe('rules');
    });

    it('(vi) AI coerente (iso_9606) invariata', () => {
        const merged = mergeExtractions(ruleFromLayout, { qualification_method: 'iso_9606' }, 'qualifica_14732');
        expect(merged.fields.qualification_method).toBe('iso_9606');
        expect(merged.fieldSources.qualification_method).toBe('ai+rules');
    });

    it('(vi) regola da layout production_test + AI production_test -> invariato', () => {
        const rule = extractQualifica14732Fields(TESTO_AMBIGUO, 'x.pdf', { ocrLayout: layoutLines(X_IN_D) });
        expect(rule.qualification_method).toBe('production_test');
        expect(pickMergedValue('qualification_method', rule, { qualification_method: 'production_test' }, 'qualifica_14732').value)
            .toBe('production_test');
    });

    it('(vi) senza layout regola null: AI production_test resta (nessuna correzione)', () => {
        const rule = extractQualifica14732Fields(TESTO_AMBIGUO, 'x.pdf');
        expect(pickMergedValue('qualification_method', rule, { qualification_method: 'production_test' }, 'qualifica_14732').value)
            .toBe('production_test');
    });
});
