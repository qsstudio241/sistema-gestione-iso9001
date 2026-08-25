'use strict';

const {
    computeQualifiedMaterialThicknessRange15614_2,
    computeQualifiedFilletThroatThicknessRange15614_2,
    computeQualifiedPipeDiameterRange15614_2,
    describePlateCoversPipeDiameter15614_2,
    isIso15614Part2,
} = require('./weldingQualificationRules15614_2');

describe('weldingQualificationRules15614_2 — Tabella 5/6/7', () => {
    describe('computeQualifiedMaterialThicknessRange15614_2', () => {
        it('t ≤ 3: 0,5t–2t', () => {
            expect(computeQualifiedMaterialThicknessRange15614_2({ testThicknessMm: 2 }))
                .toEqual({ minMm: 1, maxMm: 4 });
        });
        it('3 < t ≤ 10: 3–2t', () => {
            expect(computeQualifiedMaterialThicknessRange15614_2({ testThicknessMm: 8 }))
                .toEqual({ minMm: 3, maxMm: 16 });
        });
        it('10 < t ≤ 20: 5–2t', () => {
            expect(computeQualifiedMaterialThicknessRange15614_2({ testThicknessMm: 12 }))
                .toEqual({ minMm: 5, maxMm: 24 });
        });
        it('t > 150: 5–1,5t', () => {
            expect(computeQualifiedMaterialThicknessRange15614_2({ testThicknessMm: 200 }))
                .toEqual({ minMm: 5, maxMm: 300 });
        });
        it('input invalido → null', () => {
            expect(computeQualifiedMaterialThicknessRange15614_2({})).toBeNull();
        });
    });

    describe('computeQualifiedFilletThroatThicknessRange15614_2', () => {
        it('t ≤ 3', () => {
            expect(computeQualifiedFilletThroatThicknessRange15614_2({ testThicknessMm: 2 }))
                .toEqual({ minMm: 1.4, maxMm: 4 });
        });
        it('3 < t < 30', () => {
            expect(computeQualifiedFilletThroatThicknessRange15614_2({ testThicknessMm: 10 }))
                .toEqual({ minMm: 3, maxMm: 20 });
        });
        it('t ≥ 30 solo minimo', () => {
            expect(computeQualifiedFilletThroatThicknessRange15614_2({ testThicknessMm: 30 }))
                .toEqual({ minMm: 5, maxMm: null });
        });
    });

    describe('computeQualifiedPipeDiameterRange15614_2', () => {
        it('D ≤ 25', () => {
            expect(computeQualifiedPipeDiameterRange15614_2({ testDiameterMm: 20 }))
                .toEqual({ minMm: 10, maxMm: 40 });
        });
        it('D > 25', () => {
            expect(computeQualifiedPipeDiameterRange15614_2({ testDiameterMm: 100 }))
                .toEqual({ minMm: 50, maxMm: null });
        });
    });

    describe('describePlateCoversPipeDiameter15614_2', () => {
        it('senza PA/PC → 500', () => {
            expect(describePlateCoversPipeDiameter15614_2({ weldingPositions: 'PF' }).minMm).toBe(500);
        });
        it('con PA → 150', () => {
            expect(describePlateCoversPipeDiameter15614_2({ weldingPositions: 'PA, PB' }).minMm).toBe(150);
        });
    });

    describe('isIso15614Part2', () => {
        it('riconosce varianti', () => {
            expect(isIso15614Part2('UNI EN ISO 15614-2:2025')).toBe(true);
            expect(isIso15614Part2('ISO 15614-1:2017')).toBe(false);
        });
    });
});
