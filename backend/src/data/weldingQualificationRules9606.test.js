'use strict';

const {
    CONFIRMATION_INTERVAL_MONTHS,
    computeQualifiedPipeDiameterRange,
    computeQualifiedFilletThicknessRange,
    computeQualifiedThicknessRangeButtWeld,
    computeQualifiedWeldingPositions,
    isWeldingPositionQualified,
    describePlateOnlyRotatingPositionDiameterNote,
    getApplicableWelderFields,
    buildWelderQualificationRulesPromptSection,
} = require('./weldingQualificationRules9606');

describe('weldingQualificationRules9606', () => {
    test('conferma periodica fissa a 6 mesi', () => {
        expect(CONFIRMATION_INTERVAL_MONTHS).toBe(6);
    });

    describe('computeQualifiedPipeDiameterRange (Tabella 7)', () => {
        test('D <= 25 mm -> [D, 2D]', () => {
            expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 20 })).toEqual({ minMm: 20, maxMm: 40 });
        });

        test('D > 25 mm -> [max(0.5D,25), null]', () => {
            expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 60 })).toEqual({ minMm: 30, maxMm: null });
            expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 40 })).toEqual({ minMm: 25, maxMm: null });
        });

        test('input non valido -> null', () => {
            expect(computeQualifiedPipeDiameterRange({ testDiameterMm: null })).toBeNull();
            expect(computeQualifiedPipeDiameterRange({})).toBeNull();
        });
    });

    describe('computeQualifiedFilletThicknessRange (Tabella 8, entrambe le righe verificate)', () => {
        test('t < 3 mm -> [t, max(2t,3)]', () => {
            expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 2 })).toEqual({ minMm: 2, maxMm: 4 });
        });

        test('t < 1,5 mm -> [t, 3] (2t < 3)', () => {
            expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 1 })).toEqual({ minMm: 1, maxMm: 3 });
        });

        test('t >= 3 mm -> [3, null] (GAP risolto 26/07/2026, ex t>=3 tornava null)', () => {
            expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 5 })).toEqual({ minMm: 3, maxMm: null });
            expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 3 })).toEqual({ minMm: 3, maxMm: null });
        });

        test('input non valido -> null', () => {
            expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 0 })).toBeNull();
            expect(computeQualifiedFilletThicknessRange({})).toBeNull();
        });
    });

    describe('computeQualifiedThicknessRangeButtWeld (Tabella 6, GAP risolto 26/07/2026)', () => {
        test('s < 3 mm -> [s, max(2s,3)]', () => {
            expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 2 })).toEqual({ minMm: 2, maxMm: 4 });
            expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 1 })).toEqual({ minMm: 1, maxMm: 3 });
        });

        test('3 <= s < 12 mm -> [3, 2s]', () => {
            expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 3 })).toEqual({ minMm: 3, maxMm: 6 });
            expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 8 })).toEqual({ minMm: 3, maxMm: 16 });
        });

        test('s >= 12 mm -> [3, null]', () => {
            expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 12 })).toEqual({ minMm: 3, maxMm: null });
            expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 20 })).toEqual({ minMm: 3, maxMm: null });
        });

        test('processo 311 (ossiacetilenica): moltiplicatore 1,5 invece di 2 (note c/d)', () => {
            expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 2, weldingProcessCode: '311' })).toEqual({ minMm: 2, maxMm: 3 });
            expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 8, weldingProcessCode: '311' })).toEqual({ minMm: 3, maxMm: 12 });
        });

        test('input non valido -> null', () => {
            expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: -1 })).toBeNull();
            expect(computeQualifiedThicknessRangeButtWeld({})).toBeNull();
        });
    });

    describe('computeQualifiedWeldingPositions / isWeldingPositionQualified (Tabelle 9/10, GAP risolto 26/07/2026)', () => {
        test('Tabella 9 (BW): PA qualifica solo PA', () => {
            expect(computeQualifiedWeldingPositions({ testPosition: 'PA', jointType: 'BW' })).toEqual(['PA']);
        });

        test('Tabella 9 (BW): H-L045 qualifica PA/PC/PE/PF', () => {
            expect(computeQualifiedWeldingPositions({ testPosition: 'H-L045', jointType: 'BW' })).toEqual(['PA', 'PC', 'PE', 'PF']);
        });

        test('Tabella 10 (FW): PH qualifica PA-PF (non PG)', () => {
            expect(computeQualifiedWeldingPositions({ testPosition: 'PH', jointType: 'FW' })).toEqual(['PA', 'PB', 'PC', 'PD', 'PE', 'PF']);
        });

        test('posizione non riconosciuta -> null', () => {
            expect(computeQualifiedWeldingPositions({ testPosition: 'ZZ', jointType: 'BW' })).toBeNull();
            expect(computeQualifiedWeldingPositions({})).toBeNull();
        });

        test('isWeldingPositionQualified: PC (BW) qualifica PA ma non PE', () => {
            expect(isWeldingPositionQualified({ testPosition: 'PC', targetPosition: 'PA', jointType: 'BW' })).toBe(true);
            expect(isWeldingPositionQualified({ testPosition: 'PC', targetPosition: 'PE', jointType: 'BW' })).toBe(false);
        });

        test('isWeldingPositionQualified: posizione testata sconosciuta -> null (nessun giudizio)', () => {
            expect(isWeldingPositionQualified({ testPosition: 'ZZ', targetPosition: 'PA' })).toBeNull();
        });
    });

    test('prompt section contiene le regole chiave', () => {
        const section = buildWelderQualificationRulesPromptSection();
        expect(section).toContain('ISO 9606-1');
        expect(section).toContain('6 mesi');
    });

    describe('getApplicableWelderFields (UX campi condizionati, 27/07/2026)', () => {
        test('diametro tubo non applicabile se prodotto = piastra (P)', () => {
            expect(getApplicableWelderFields({ productType: 'P' })).toEqual({ pipeDiameterApplicable: false });
        });

        test('diametro tubo applicabile se prodotto = tubo (T) o non ancora scelto', () => {
            expect(getApplicableWelderFields({ productType: 'T' })).toEqual({ pipeDiameterApplicable: true });
            expect(getApplicableWelderFields({ productType: '' })).toEqual({ pipeDiameterApplicable: true });
            expect(getApplicableWelderFields()).toEqual({ pipeDiameterApplicable: true });
        });
    });

    describe('describePlateOnlyRotatingPositionDiameterNote (feedback cliente Studio Mason, da confermare)', () => {
        test('nessuna nota se il tubo e\' stato testato direttamente', () => {
            expect(describePlateOnlyRotatingPositionDiameterNote({
                hasPipeDiameter: true,
                weldingPositions: ['PA'],
            })).toBeNull();
        });

        test('nessuna nota se le posizioni non includono PA/PB/PC/PD', () => {
            expect(describePlateOnlyRotatingPositionDiameterNote({
                hasPipeDiameter: false,
                weldingPositions: ['PF', 'PG'],
            })).toBeNull();
        });

        test('>=500 mm per piastra in posizione PA/PB/PC/PD non rotante', () => {
            const note = describePlateOnlyRotatingPositionDiameterNote({
                hasPipeDiameter: false,
                weldingPositions: ['PA'],
                rotatingPosition: false,
            });
            expect(note).toContain('\u2265500 mm');
            expect(note).toContain('da confermare');
        });

        test('>=75 mm quando la posizione di prova e\' rotante', () => {
            const note = describePlateOnlyRotatingPositionDiameterNote({
                hasPipeDiameter: false,
                weldingPositions: 'PC, PD',
                rotatingPosition: true,
            });
            expect(note).toContain('\u226575 mm');
        });
    });
});
