'use strict';

const {
    FAMILY, SEVERITY, STATUS, DIRECTION, TEXT_STATUS, makeFinding, validateFinding,
} = require('./findingTypes');

const CLAUSE = '§5.7 Tab. 6';

function verificabile(over = {}) {
    return makeFinding({
        code: 'WQ9606_1.CORR.THK_BW',
        family: FAMILY.CORRETTEZZA,
        severity: SEVERITY.WARN,
        status: STATUS.VERIFICABILE,
        field: 'thickness_max_mm',
        direction: DIRECTION.OVER_CLAIM,
        read_value: 20,
        expected_value: 12,
        source: { norm: 'ISO 9606-1', edition: '2017', clause: CLAUSE, text_status: TEXT_STATUS.MD_INTEGRALE, ref: 'NORMA_00018' },
        message_it: `Spessore massimo oltre la validità attesa (${CLAUSE}).`,
        ...over,
    });
}

function nonVerificabile(over = {}) {
    return makeFinding({
        code: 'WQ9606_1.CORR.THK_BW',
        family: FAMILY.CORRETTEZZA,
        severity: SEVERITY.INFO,
        status: STATUS.NON_VERIFICABILE_DATO_MANCANTE,
        field: 'thickness_s_test_mm',
        message_it: 'Spessore di prova assente: ricalcolo non eseguibile.',
        ...over,
    });
}

describe('makeFinding', () => {
    test('applica i default null/[] ai campi opzionali', () => {
        const f = makeFinding({ code: 'X', family: FAMILY.COMPLETEZZA, status: STATUS.NON_VERIFICABILE_FONTE_MANCANTE, message_it: 'm' });
        expect(f.fields).toEqual([]);
        expect(f.field).toBeNull();
        expect(f.direction).toBeNull();
        expect(f.read_value).toBeNull();
        expect(f.expected_value).toBeNull();
        expect(f.severity).toBe(SEVERITY.INFO);
        expect(f.source).toEqual({ norm: null, edition: null, clause: null, text_status: TEXT_STATUS.ASSENTE, ref: null });
    });

    test('fields eredita field quando non indicato', () => {
        expect(makeFinding({ field: 'a' }).fields).toEqual(['a']);
        expect(makeFinding({ field: 'a', fields: ['a', 'b'] }).fields).toEqual(['a', 'b']);
    });
});

describe('validateFinding — invarianti del contratto', () => {
    test('finding verificabile e non verificabile ben formati sono validi', () => {
        expect(validateFinding(verificabile())).toEqual({ ok: true, errors: [] });
        expect(validateFinding(nonVerificabile())).toEqual({ ok: true, errors: [] });
    });

    test('1: nessun blocking/error né severity diversa da info|warn', () => {
        expect(validateFinding({ ...verificabile(), blocking: true }).ok).toBe(false);
        expect(validateFinding({ ...verificabile(), error: 'x' }).ok).toBe(false);
        expect(validateFinding(verificabile({ severity: 'error' })).ok).toBe(false);
        expect(validateFinding(verificabile({ severity: 'blocking' })).ok).toBe(false);
    });

    test('2: verificabile richiede clausola e text_status diverso da assente', () => {
        const noClause = verificabile({ source: { clause: null, text_status: TEXT_STATUS.ESTRATTO } });
        expect(validateFinding(noClause).errors.join(' ')).toMatch(/source\.clause/);
        const absent = verificabile({ source: { clause: CLAUSE, text_status: TEXT_STATUS.ASSENTE } });
        expect(validateFinding(absent).errors.join(' ')).toMatch(/text_status/);
    });

    test('3: non verificabile deve essere info (entrambi gli stati)', () => {
        for (const status of [STATUS.NON_VERIFICABILE_DATO_MANCANTE, STATUS.NON_VERIFICABILE_FONTE_MANCANTE]) {
            const r = validateFinding(nonVerificabile({ status, severity: SEVERITY.WARN }));
            expect(r.ok).toBe(false);
            expect(r.errors.join(' ')).toMatch(/invariante 3/);
        }
    });

    test('5: message_it deve citare la clausola quando verificabile', () => {
        const r = validateFinding(verificabile({ message_it: 'Spessore fuori range.' }));
        expect(r.ok).toBe(false);
        expect(r.errors.join(' ')).toMatch(/invariante 5/);
    });

    test('forma: campi obbligatori e enum', () => {
        expect(validateFinding(null).ok).toBe(false);
        expect(validateFinding(verificabile({ code: '' })).ok).toBe(false);
        expect(validateFinding(verificabile({ family: 'altro' })).ok).toBe(false);
        expect(validateFinding(verificabile({ status: 'boh' })).ok).toBe(false);
        expect(validateFinding(verificabile({ field: null })).ok).toBe(false);
        expect(validateFinding(verificabile({ direction: 'sopra' })).ok).toBe(false);
        expect(validateFinding(verificabile({ message_it: '' })).ok).toBe(false);
    });
});
