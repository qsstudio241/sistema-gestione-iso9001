'use strict';

const {
    CONFIRMATION_INTERVAL_MONTHS,
    computeQualifiedPipeDiameterRange,
    computeQualifiedFilletThicknessRange,
    describePlateOnlyRotatingPositionDiameterNote,
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

    describe('computeQualifiedFilletThicknessRange (riga t<3 verificata)', () => {
        test('t < 3 mm -> [t, max(2t,3)]', () => {
            expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 2 })).toEqual({ minMm: 2, maxMm: 4 });
        });

        test('t >= 3 mm -> null (GAP volontario)', () => {
            expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 5 })).toBeNull();
        });
    });

    test('prompt section contiene le regole chiave', () => {
        const section = buildWelderQualificationRulesPromptSection();
        expect(section).toContain('ISO 9606-1');
        expect(section).toContain('6 mesi');
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
