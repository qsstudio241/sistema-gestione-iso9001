const { confidenceFromTextLength } = require('./importPdfText');

describe('confidenceFromTextLength', () => {
    test('alto volume testo', () => {
        expect(confidenceFromTextLength(2500)).toBe(85);
    });
    test('medio', () => {
        expect(confidenceFromTextLength(600)).toBe(70);
        expect(confidenceFromTextLength(150)).toBe(55);
    });
    test('basso / vuoto', () => {
        expect(confidenceFromTextLength(30)).toBe(40);
        expect(confidenceFromTextLength(0)).toBe(25);
        expect(confidenceFromTextLength(NaN)).toBe(25);
    });
});
