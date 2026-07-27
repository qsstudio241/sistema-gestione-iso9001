/**
 * @jest-environment node
 *
 * Test L1 — numericSanitizer.toNumericOrNull
 * Bug produzione 27/07/2026 (cliente Mason): valori non numerici da form/AI
 * su colonne DECIMAL/INT causavano "Error converting data type nvarchar to
 * numeric" lato SQL Server. Questa utility è la sanitizzazione condivisa.
 */
const { toNumericOrNull } = require('./numericSanitizer');

describe('toNumericOrNull', () => {
    it('restituisce null per null/undefined/stringa vuota', () => {
        expect(toNumericOrNull(null)).toBeNull();
        expect(toNumericOrNull(undefined)).toBeNull();
        expect(toNumericOrNull('')).toBeNull();
        expect(toNumericOrNull('   ')).toBeNull();
    });

    it('restituisce null per token "non applicabile" (case-insensitive)', () => {
        expect(toNumericOrNull('N.A.')).toBeNull();
        expect(toNumericOrNull('n.a')).toBeNull();
        expect(toNumericOrNull('NA')).toBeNull();
        expect(toNumericOrNull('N/A')).toBeNull();
        expect(toNumericOrNull('N.D.')).toBeNull();
        expect(toNumericOrNull('n/d')).toBeNull();
        expect(toNumericOrNull('-')).toBeNull();
        expect(toNumericOrNull('--')).toBeNull();
        expect(toNumericOrNull('nessuno')).toBeNull();
    });

    it('passa attraverso numeri già validi', () => {
        expect(toNumericOrNull(4)).toBe(4);
        expect(toNumericOrNull(0)).toBe(0);
        expect(toNumericOrNull(-3.5)).toBe(-3.5);
    });

    it('restituisce null per NaN/Infinity', () => {
        expect(toNumericOrNull(NaN)).toBeNull();
        expect(toNumericOrNull(Infinity)).toBeNull();
    });

    it('converte stringhe numeriche dirette', () => {
        expect(toNumericOrNull('12')).toBe(12);
        expect(toNumericOrNull('12.5')).toBe(12.5);
        expect(toNumericOrNull(' 12.5 ')).toBe(12.5);
        expect(toNumericOrNull('-3')).toBe(-3);
    });

    it('converte la virgola decimale italiana', () => {
        expect(toNumericOrNull('12,5')).toBe(12.5);
    });

    it('rimuove simboli di soglia (\u2265, \u2264, ~, <, >)', () => {
        expect(toNumericOrNull('\u22653')).toBe(3);
        expect(toNumericOrNull('\u22643')).toBe(3);
        expect(toNumericOrNull('~5')).toBe(5);
        expect(toNumericOrNull('>=6')).toBe(6);
        expect(toNumericOrNull('<10')).toBe(10);
    });

    it('estrae il primo numero da un range testuale ambiguo (policy documentata)', () => {
        expect(toNumericOrNull('3-6')).toBe(3);
        expect(toNumericOrNull('3 - 6')).toBe(3);
    });

    it('restituisce null quando non trova alcuna cifra', () => {
        expect(toNumericOrNull('vedi certificato')).toBeNull();
        expect(toNumericOrNull('abc')).toBeNull();
    });
});
