/**
 * @jest-environment node
 */
const {
    MAX_NESTING_DEPTH,
    normalizeApplicableWpsIds: norm,
    serializeApplicableWpsIds: ser,
} = require('./applicableWpsIds');

function nest(value, levels) {
    let out = value;
    for (let i = 0; i < levels; i += 1) out = JSON.stringify([out]);
    return out;
}

function wrapArrays(value, levels) {
    let out = value;
    for (let i = 0; i < levels; i += 1) out = [out];
    return out;
}

describe('normalizeApplicableWpsIds', () => {
    test('array di numeri e di stringhe numeriche', () => {
        expect(norm([1, 2, 3])).toEqual([1, 2, 3]);
        expect(norm(['4', ' 5 '])).toEqual([4, 5]);
    });

    test('stringa JSON semplice', () => {
        expect(norm('[1,2]')).toEqual([1, 2]);
        expect(norm('[ 1 , 2 ]')).toEqual([1, 2]);
    });

    test('annidamenti multipli e doppia serializzazione', () => {
        expect(norm(['[1,2]'])).toEqual([1, 2]);
        expect(norm(nest([1, 2], 1))).toEqual([1, 2]);
        expect(norm(nest([1, 2], 3))).toEqual([1, 2]);
        expect(norm(JSON.stringify(JSON.stringify([7])))).toEqual([7]);
        expect(norm([[1], [[2]], '[3]'])).toEqual([1, 2, 3]);
    });

    test('CSV e numero singolo', () => {
        expect(norm('1,2,3')).toEqual([1, 2, 3]);
        expect(norm('1; 2 3')).toEqual([1, 2, 3]);
        expect(norm('9')).toEqual([9]);
        expect(norm(9)).toEqual([9]);
    });

    test('vuoti e tipi non supportati', () => {
        expect(norm(null)).toEqual([]);
        expect(norm(undefined)).toEqual([]);
        expect(norm('')).toEqual([]);
        expect(norm('   ')).toEqual([]);
        expect(norm('[]')).toEqual([]);
        expect(norm({})).toEqual([]);
        expect(norm(true)).toEqual([]);
    });

    test('scarta non numerici, NaN, negativi, zero, decimali, esponenziali, fuori range', () => {
        expect(norm([1, 'abc', NaN, -2, 0, 1.5, '1.5', '1e3', 2147483648, 3])).toEqual([1, 3]);
        expect(norm('[1,"x",-4,2.5,null,{"a":1}]')).toEqual([1]);
        expect(norm('1,x,2')).toEqual([]);
    });

    test('valori corrotti non numerici -> array vuoto', () => {
        expect(norm('["[\\"x\\"]"]')).toEqual([]);
        expect(norm('[1,2')).toEqual([]);
    });

    test('duplicati rimossi mantenendo l\'ordine', () => {
        expect(norm([3, 1, 3, '1', 2])).toEqual([3, 1, 2]);
        expect(norm(nest([5, 5, 6], 2))).toEqual([5, 6]);
    });

    test('profondita massima: oltre il limite il valore viene ignorato', () => {
        // ogni livello di serializzazione costa 2 di profondita (array + stringa)
        expect(norm(nest([1], 10))).toEqual([1]);
        expect(norm(wrapArrays(1, MAX_NESTING_DEPTH - 1))).toEqual([1]);
        expect(norm(wrapArrays(1, MAX_NESTING_DEPTH + 1))).toEqual([]);
    });
});

describe('serializeApplicableWpsIds', () => {
    test('formato canonico: JSON array di numeri come stringa', () => {
        expect(ser([1, 2])).toBe('[1,2]');
        expect(ser('[1,2]')).toBe('[1,2]');
        expect(ser('["[1,2]"]')).toBe('[1,2]');
        expect(ser(['1', 1, 2])).toBe('[1,2]');
    });

    test('idempotente', () => {
        const once = ser(nest([1, 2], 3));
        expect(ser(once)).toBe(once);
    });

    test('null/undefined restano null; vuoti espliciti diventano []', () => {
        expect(ser(null)).toBeNull();
        expect(ser(undefined)).toBeNull();
        expect(ser([])).toBe('[]');
        expect(ser('')).toBe('[]');
    });
});
