'use strict';

const {
    BOILER_PIN_BEND_MOMENTS_NM,
    isIso14555,
    describeQualifiedStudSectionRange,
    describeQualifiedParentThicknessRange14555,
    describeQualifiedPositions14555,
    isBathProtectionCovered14555,
    isDissimilarMaterialsCovered14555,
    isThroughDeckSheetCovered14555,
    evaluateBoilerPinBendAcceptance,
} = require('./weldingQualificationRules14555');

describe('weldingQualificationRules14555 (BE mirror)', () => {
    it('isIso14555', () => {
        expect(isIso14555('BS EN ISO 14555:2025')).toBe(true);
        expect(isIso14555('ISO 15614-1')).toBe(false);
    });

    it('sezione stud 1/2 prove', () => {
        expect(describeQualifiedStudSectionRange({ testSectionsMm: 10 }))
            .toEqual(expect.objectContaining({ minMm: 10, maxMm: 10 }));
        expect(describeQualifiedStudSectionRange({ testSectionsMm: [10, 16] }))
            .toEqual(expect.objectContaining({ minMm: 10, maxMm: 16 }));
    });

    it('spessore parent tutti se pWPS', () => {
        expect(describeQualifiedParentThicknessRange14555({}).allThicknesses).toBe(true);
    });

    it('posizioni tw', () => {
        expect(describeQualifiedPositions14555({
            weldingTimeMs: 50,
            testPosition: 'PC',
        }).covers).toEqual(['PA', 'PC', 'PE']);
        expect(describeQualifiedPositions14555({
            weldingTimeMs: 200,
            testPosition: 'PC',
        }).covers).toEqual(['PC', 'PE', 'PA']);
    });

    it('CF/SG/NP', () => {
        expect(isBathProtectionCovered14555({
            qualifiedMethod: 'NP',
            productionMethod: 'SG',
        })).toBe(true);
        expect(isBathProtectionCovered14555({
            qualifiedMethod: 'SG',
            productionMethod: 'NP',
        })).toBe(false);
    });

    it('dissimili tw > 100 → dedicata', () => {
        const r = isDissimilarMaterialsCovered14555({
            parentGroup: '8',
            studGroup: '1',
            weldingTimeMs: 101,
        });
        expect(r.dedicatedQualificationRequired).toBe(true);
        expect(r.covered).toBe(false);
    });

    it('through-deck più spessa copre più sottili', () => {
        expect(isThroughDeckSheetCovered14555({
            qualifiedSheetThicknessMm: 2,
            productionSheetThicknessMm: 1,
        }).covered).toBe(true);
    });

    it('Tabella 2 8/10/12', () => {
        expect(BOILER_PIN_BEND_MOMENTS_NM[8]).toBe(40);
        expect(BOILER_PIN_BEND_MOMENTS_NM[10]).toBe(60);
        expect(BOILER_PIN_BEND_MOMENTS_NM[12]).toBe(85);
        expect(evaluateBoilerPinBendAcceptance({
            diameterMm: 8,
            measuredMomentNm: 40,
        }).accepted).toBe(true);
    });
});
