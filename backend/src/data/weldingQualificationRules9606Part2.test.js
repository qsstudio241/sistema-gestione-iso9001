const rules9606 = require('./weldingQualificationRules9606');
const r2 = require('./weldingQualificationRules9606Part2');

describe('ISO 9606-2 Tab. 3 — BW, spessore del materiale t', () => {
    const f = (t) => r2.computeQualifiedThicknessRangeButtWeld({ testThicknessMm: t });

    test.each([
        [1, 0.5, 2],
        [3, 1.5, 6], // Annex B.3
        [5, 2.5, 10], // Annex B.5 (processo 141, radice)
        [6, 3, 12], // confine: vale la riga t ≤ 6
    ])('t = %s mm -> da %s a %s mm', (t, min, max) => {
        expect(f(t)).toEqual({ minMm: min, maxMm: max });
    });

    test.each([6.01, 6.1, 8, 10, 15, 40])('t = %s mm (> 6) -> ≥ 6 mm, nessun limite superiore', (t) => {
        expect(f(t)).toEqual({ minMm: 6, maxMm: null });
    });

    test('Annex B: t = 8 (B.7), t = 15 (B.2), s2 = 10 (B.5) -> ≥ 6', () => {
        [8, 15, 10].forEach((t) => expect(f(t)).toEqual({ minMm: 6, maxMm: null }));
    });

    test.each([null, undefined, '', 0, -1, 'abc'])('input non valido %p -> null', (t) => {
        expect(f(t)).toBeNull();
    });

    test('differisce da 9606-1 Tab. 6 (s): stesso valore, range diverso', () => {
        const s = rules9606.computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 5 });
        expect(s).toEqual({ minMm: 3, maxMm: 10 });
        expect(f(5)).toEqual({ minMm: 2.5, maxMm: 10 });
        expect(f(2)).toEqual({ minMm: 1, maxMm: 4 });
        expect(rules9606.computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 2 })).toEqual({ minMm: 2, maxMm: 4 });
    });
});

describe('ISO 9606-2 Tab. 5 — FW, spessore del materiale t', () => {
    const f = (t) => r2.computeQualifiedFilletThicknessRange({ testThicknessMm: t });

    test.each([
        [1, 1, 3],
        [1.5, 1.5, 3],
        [2.99, 2.99, 3],
    ])('t = %s mm (< 3) -> da t a 3 mm', (t, min, max) => {
        expect(f(t)).toEqual({ minMm: min, maxMm: max });
    });

    test.each([3, 3.01, 10, 25])('t = %s mm (≥ 3) -> ≥ 3 mm, nessun limite superiore', (t) => {
        expect(f(t)).toEqual({ minMm: 3, maxMm: null });
    });

    test('Annex B.1: t = 10 -> ≥ 3', () => {
        expect(f(10)).toEqual({ minMm: 3, maxMm: null });
    });

    test('per 1,5 < t < 3 differisce da 9606-1 Tab. 8 (fino a 2t)', () => {
        expect(rules9606.computeQualifiedFilletThicknessRange({ testThicknessMm: 2.5 })).toEqual({ minMm: 2.5, maxMm: 5 });
        expect(f(2.5)).toEqual({ minMm: 2.5, maxMm: 3 });
    });

    test.each([null, undefined, '', 0, -2])('input non valido %p -> null', (t) => {
        expect(f(t)).toBeNull();
    });
});

describe('ISO 9606-2 Tab. 4 — diametro esterno del tubo (riuso 9606-1 Tab. 7)', () => {
    const f = (d) => r2.computeQualifiedPipeDiameterRange({ testDiameterMm: d });

    test('è la stessa funzione di 9606-1 (nessuna tabella ricopiata)', () => {
        [10, 25, 25.01, 30, 100, 150, 200, null].forEach((d) => {
            expect(f(d)).toEqual(rules9606.computeQualifiedPipeDiameterRange({ testDiameterMm: d }));
        });
    });

    test.each([
        [150, 75], // B.3
        [200, 100], // B.5
        [100, 50], // B.7
        [30, 25], // B.6: il minimo ammesso da D30 (15) è alzato a 25
    ])('Annex B: D = %s -> ≥ %s mm', (d, min) => {
        expect(f(d)).toEqual({ minMm: min, maxMm: null });
    });

    test('D ≤ 25 -> da D a 2D', () => {
        expect(f(20)).toEqual({ minMm: 20, maxMm: 40 });
    });
});

describe('ISO 9606-2 §5.3 b) — piastra -> tubo', () => {
    test.each([
        ['PA', 150], ['PB', 150], ['PC', 150], ['pa', 150],
        ['PD', 500], ['PE', 500], ['PF', 500], ['PG', 500], ['H-L045', 500],
    ])('prova su piastra in %s -> tubi con D ≥ %s mm', (pos, min) => {
        expect(r2.computePlateToPipeMinDiameter({ testPosition: pos })).toEqual({ minMm: min, positionKnown: true });
    });

    test('posizione non nota -> soglia più bassa (150), segnalata come non nota', () => {
        expect(r2.computePlateToPipeMinDiameter({})).toEqual({ minMm: 150, positionKnown: false });
    });

    test('più posizioni: soglia più restrittiva (max delle prove)', () => {
        expect(r2.computePlateToPipeMinDiameter({ testPosition: 'PF+PE' })).toEqual({ minMm: 500, positionKnown: true });
        expect(r2.computePlateToPipeMinDiameter({ testPosition: ['PF', 'PE'] })).toEqual({ minMm: 500, positionKnown: true });
        expect(r2.computePlateToPipeMinDiameter({ testPosition: 'PA+PB' })).toEqual({ minMm: 150, positionKnown: true });
        expect(r2.computePlateToPipeMinDiameter({ testPosition: 'PA+PF' })).toEqual({ minMm: 500, positionKnown: true });
    });
});

describe('ISO 9606-2 Tab. 6 — posizioni (matrice 10 colonne)', () => {
    const q = (testPosition, productType) => r2.computeQualifiedWeldingPositions({ testPosition, productType });

    test('10 colonne, ordine della tabella', () => {
        expect(r2.WELDING_POSITION_COLUMNS).toEqual(['PA', 'PB', 'PC', 'PD', 'PE', 'PF:P', 'PF:T', 'PG:P', 'PG:T', 'H-L045']);
        expect(r2.WELDING_POSITION_SYMBOLS).toEqual(['PA', 'PB', 'PC', 'PD', 'PE', 'PF', 'PG', 'H-L045']);
        expect(Object.keys(r2.POSITION_QUALIFICATION_MATRIX)).toEqual(r2.WELDING_POSITION_COLUMNS);
    });

    test.each([
        ['PA', null, ['PA', 'PB']],
        ['PB', null, ['PA', 'PB']],
        ['PC', null, ['PA', 'PB', 'PC']],
        ['PD', null, ['PA', 'PB', 'PC', 'PD', 'PE', 'PF:P']],
        ['PE', null, ['PA', 'PB', 'PC', 'PD', 'PE', 'PF:P']],
        ['PF', 'P', ['PA', 'PB', 'PF:P']],
        ['PF', 'T', ['PA', 'PB', 'PD', 'PE', 'PF:P', 'PF:T']],
        ['PG', 'P', ['PG:P']],
        ['PG', 'T', ['PA', 'PB', 'PD', 'PE', 'PG:P', 'PG:T']],
        ['H-L045', 'T', ['PA', 'PB', 'PC', 'PD', 'PE', 'PF:P', 'PF:T', 'H-L045']],
    ])('prova %s (%s) -> %j', (pos, product, expected) => {
        expect(q(pos, product)).toEqual(expected);
    });

    test('ogni riga qualifica almeno la propria colonna e solo colonne della tabella', () => {
        Object.entries(r2.POSITION_QUALIFICATION_MATRIX).forEach(([row, cols]) => {
            cols.forEach((c) => expect(r2.WELDING_POSITION_COLUMNS).toContain(c));
            expect(cols).toContain(row);
        });
    });

    test('PF/PG senza piastra/tubo leggibile: non risolvibile (null), con motivo', () => {
        expect(q('PF', null)).toBeNull();
        expect(q('PG', 'X')).toBeNull();
        expect(r2.resolveTestPositionRow({ testPosition: 'PF' })).toEqual({ row: null, reason: 'product_required' });
        expect(r2.resolveTestPositionRow({ testPosition: 'PF', productType: 'T' })).toEqual({ row: 'PF:T', reason: null });
        expect(r2.resolveTestPositionRow({ testPosition: 'pg', productType: 'plate' })).toEqual({ row: 'PG:P', reason: null });
    });

    test('simboli 9606-1 (PH, PJ, J-L045) NON sono mappati: non risolvibili (GAP G4)', () => {
        ['PH', 'PJ', 'J-L045', 'PX', ''].forEach((p) => expect(q(p, 'T')).toBeNull());
        expect(r2.resolveTestPositionRow({ testPosition: 'PH', productType: 'T' }).reason).toBe('unknown_symbol');
        expect(r2.isPositionSymbolInTable('PH')).toBe(false);
        expect(r2.isPositionSymbolInTable('pf')).toBe(true);
        expect(r2.isPositionSymbolInTable('PF:T')).toBe(true);
    });

    test('Annex B.1/B.2/B.3: PB -> PA,PB; PA -> PA,PB; PF tubo -> PA,PB,PD,PE,PF', () => {
        expect(r2.qualifiedPositionSymbols(q('PB'))).toEqual(['PA', 'PB']);
        expect(r2.qualifiedPositionSymbols(q('PA'))).toEqual(['PA', 'PB']);
        expect(r2.qualifiedPositionSymbols(q('PF', 'T'))).toEqual(['PA', 'PB', 'PD', 'PE', 'PF']);
    });

    test('Annex B.7: PF + PC su tubo -> tutte tranne PG (H-L045 inclusa)', () => {
        const all = q('PF + PC', 'T');
        expect(all).toEqual(['PA', 'PB', 'PC', 'PD', 'PE', 'PF:P', 'PF:T', 'H-L045']);
        expect(r2.qualifiedPositionSymbols(all)).not.toContain('PG');
        expect(q(['PF', 'PC'], 'T')).toEqual(all);
    });

    test('PF + PC su piastra: nessun H-L045 (la regola vale per i tubi)', () => {
        expect(q('PF, PC', 'P')).not.toContain('H-L045');
    });

    test('più posizioni = unione delle righe; una non risolvibile annulla il calcolo', () => {
        expect(q('PA, PC')).toEqual(['PA', 'PB', 'PC']);
        expect(q('PA, PH')).toBeNull();
        expect(q('', 'T')).toBeNull();
        expect(q(null, 'T')).toBeNull();
    });

    test('isWeldingPositionQualified', () => {
        expect(r2.isWeldingPositionQualified({ testPosition: 'PF', productType: 'T', targetPosition: 'PD' })).toBe(true);
        expect(r2.isWeldingPositionQualified({ testPosition: 'PF', productType: 'T', targetPosition: 'PF' })).toBe(true);
        expect(r2.isWeldingPositionQualified({ testPosition: 'PF', productType: 'T', targetPosition: 'PG' })).toBe(false);
        expect(r2.isWeldingPositionQualified({ testPosition: 'PA', targetPosition: 'PB' })).toBe(true);
        expect(r2.isWeldingPositionQualified({ testPosition: 'PA', targetPosition: 'PC' })).toBe(false);
        expect(r2.isWeldingPositionQualified({ testPosition: 'PH', targetPosition: 'PA' })).toBeNull();
    });
});

describe('ISO 9606-2 §4.2, §5.2 — processi (nessuna equivalenza)', () => {
    test('qualificati solo 131, 141, 15', () => {
        expect(r2.QUALIFIED_PROCESSES).toEqual(['131', '141', '15']);
    });

    test.each([['131', ['131']], ['141', ['141']], ['15', ['15']], ['151', ['15']], ['153', ['15']]])(
        'prova %s -> solo %j',
        (test, expected) => expect(r2.computeQualifiedWeldingProcesses({ testProcess: test })).toEqual(expected),
    );

    test.each(['135', '142', '143', '145', '111', '311', '', null])(
        'processo %p fuori da §4.2 -> null, mai un\'equivalenza',
        (test) => expect(r2.computeQualifiedWeldingProcesses({ testProcess: test })).toBeNull(),
    );

    test('141 non qualifica 142/143/145 (a differenza di 9606-1 §5.2)', () => {
        expect(rules9606.computeQualifiedWeldingProcesses({ testProcess: '141' })).toEqual(expect.arrayContaining(['142']));
        expect(r2.computeQualifiedWeldingProcesses({ testProcess: '141' })).toEqual(['141']);
    });

    test('normalizeProcessBranch: 15x -> 15, altri invariati', () => {
        expect(r2.normalizeProcessBranch('152')).toBe('15');
        expect(r2.normalizeProcessBranch('15')).toBe('15');
        expect(r2.normalizeProcessBranch('141')).toBe('141');
        expect(r2.normalizeProcessBranch('150')).toBe('15');
        expect(r2.normalizeProcessBranch('1500')).toBe('1500');
    });
});

describe('ISO 9606-2 §9 — validità, conferma, prolungamento', () => {
    test('costanti: 2 anni, conferma ogni 6 mesi (stessa costante di 9606-1), prolungamento ogni 2 anni', () => {
        expect(r2.VALIDITY_PERIOD_MONTHS).toBe(24);
        expect(r2.CONFIRMATION_INTERVAL_MONTHS).toBe(6);
        expect(r2.CONFIRMATION_INTERVAL_MONTHS).toBe(rules9606.CONFIRMATION_INTERVAL_MONTHS);
        expect(r2.PROLONGATION_INTERVAL_MONTHS).toBe(24);
    });

    test('scadenza iniziale = esame + 2 anni (§9.1, §9.2)', () => {
        expect(r2.computeInitialValidityEnd('2025-03-15')).toBe('2027-03-15');
        expect(r2.computeInitialValidityEnd('2024-02-29')).toBe('2026-03-01');
        expect(r2.computeInitialValidityEnd(null)).toBeNull();
    });

    test('conferma ogni 6 mesi, con overflow di fine mese', () => {
        expect(r2.computeNextConfirmationDue('2025-03-15')).toBe('2025-09-15');
        expect(r2.computeNextConfirmationDue('2025-08-31')).toBe('2026-03-03');
        expect(r2.computeNextConfirmationDue(null)).toBeNull();
    });

    test('prolungamento biennale (§9.3): +2 anni per ogni prolungamento', () => {
        expect(r2.computeValidityEndAfterProlongations('2025-03-15', 0)).toBe('2027-03-15');
        expect(r2.computeValidityEndAfterProlongations('2025-03-15', 1)).toBe('2029-03-15');
        expect(r2.computeValidityEndAfterProlongations('2025-03-15', 2)).toBe('2031-03-15');
        expect(r2.computeValidityEndAfterProlongations('2025-03-15', -3)).toBe('2027-03-15');
        expect(r2.computeValidityEndAfterProlongations(null, 1)).toBeNull();
    });
});

describe('modulo puro', () => {
    test('non importa DB, fs né servizi', () => {
        const src = require('fs').readFileSync(require.resolve('./weldingQualificationRules9606Part2'), 'utf8');
        expect(src).not.toMatch(/require\(['"][^'"]*(config\/database|logger)['"]\)/);
        expect(src).not.toMatch(/require\(['"]fs['"]\)/);
    });

    test('edizione coperta: 2004 (unica)', () => {
        expect(r2.EDITION).toBe('2004');
    });
});
