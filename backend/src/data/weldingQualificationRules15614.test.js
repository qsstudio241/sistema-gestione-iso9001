'use strict';

const {
    computeQualifiedFilletThroatThicknessRange,
    computeQualifiedMaterialThicknessRangeLevel2,
    computeMinimumQualifiedThicknessWithImpactTest,
    isDiameterEssentialVariable,
    describeQualifiedPipeDiameterRangeLevel2,
    describePlateCoversPipeDiameterLevel2,
    normalizeMaterialGroupCode,
    isParentMaterialCombinationCovered,
    resolveSteelGradeToGroup,
    buildWpqrQualificationRulesPromptSection,
} = require('./weldingQualificationRules15614');

describe('weldingQualificationRules15614', () => {
    describe('computeQualifiedFilletThroatThicknessRange (Tabella 8)', () => {
        test('t <= 3mm -> [0,7t, 2t]', () => {
            expect(computeQualifiedFilletThroatThicknessRange({ testThicknessMm: 2 })).toEqual({ minMm: 1.4, maxMm: 4 });
        });

        test('3 < t < 30mm -> [3 (fisso), 2t]', () => {
            expect(computeQualifiedFilletThroatThicknessRange({ testThicknessMm: 10 })).toEqual({ minMm: 3, maxMm: 20 });
        });

        test('t >= 30mm -> [5, null]', () => {
            expect(computeQualifiedFilletThroatThicknessRange({ testThicknessMm: 40 })).toEqual({ minMm: 5, maxMm: null });
        });

        test('input non valido -> null', () => {
            expect(computeQualifiedFilletThroatThicknessRange({ testThicknessMm: null })).toBeNull();
            expect(computeQualifiedFilletThroatThicknessRange({})).toBeNull();
        });
    });

    describe('computeQualifiedMaterialThicknessRangeLevel2 (Tabella 7, bande 3-40mm)', () => {
        test('3 < t <= 12mm -> [max(0.5t,3), 1.3t]', () => {
            expect(computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm: 10 })).toEqual({ minMm: 5, maxMm: 13 });
            expect(computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm: 4 })).toEqual({ minMm: 3, maxMm: 5.2 });
        });

        test('12 < t <= 40mm -> [0.5t, 1.1t]', () => {
            expect(computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm: 20 })).toEqual({ minMm: 10, maxMm: 22 });
        });

        test('t <= 3mm o t > 40mm -> null (GAP dichiarato)', () => {
            expect(computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm: 3 })).toBeNull();
            expect(computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm: 50 })).toBeNull();
        });
    });

    describe('computeMinimumQualifiedThicknessWithImpactTest', () => {
        test('t >= 16mm -> minimo 16mm', () => {
            expect(computeMinimumQualifiedThicknessWithImpactTest({ testThicknessMm: 20 })).toBe(16);
        });

        test('6 < t < 16mm -> minimo = t', () => {
            expect(computeMinimumQualifiedThicknessWithImpactTest({ testThicknessMm: 10 })).toBe(10);
        });

        test('t <= 6mm -> minimo = 0,5t', () => {
            expect(computeMinimumQualifiedThicknessWithImpactTest({ testThicknessMm: 4 })).toBe(2);
        });

        test('input non valido -> null', () => {
            expect(computeMinimumQualifiedThicknessWithImpactTest({})).toBeNull();
        });
    });

    describe('isDiameterEssentialVariable', () => {
        test('Level 2 -> true', () => {
            expect(isDiameterEssentialVariable('2')).toBe(true);
            expect(isDiameterEssentialVariable(2)).toBe(true);
        });

        test('Level 1 o assente -> false', () => {
            expect(isDiameterEssentialVariable('1')).toBe(false);
            expect(isDiameterEssentialVariable(null)).toBe(false);
        });
    });

    describe('describeQualifiedPipeDiameterRangeLevel2 (Tabella 9)', () => {
        test('D -> [0,5D, null]', () => {
            expect(describeQualifiedPipeDiameterRangeLevel2({ testDiameterMm: 100 })).toEqual({ minMm: 50, maxMm: null });
        });

        test('input non valido -> null', () => {
            expect(describeQualifiedPipeDiameterRangeLevel2({ testDiameterMm: 0 })).toBeNull();
        });
    });

    describe('describePlateCoversPipeDiameterLevel2', () => {
        test('posizione PA non ruotata -> soglia 500mm (default generale)', () => {
            const note = describePlateCoversPipeDiameterLevel2({ weldingPositions: ['PA'], rotatedPosition: false });
            expect(note.minMm).toBe(500);
        });

        // Fix bug 08/08/2026: la norma raggruppa "PC, PF ruotata o PA ruotata" —
        // SOLO PF/PA richiedono la conferma "ruotata", PC da sola già qualifica.
        test('posizione PC da sola (senza flag ruotato) -> soglia 150mm', () => {
            const note = describePlateCoversPipeDiameterLevel2({ weldingPositions: ['PC'], rotatedPosition: false });
            expect(note.minMm).toBe(150);
        });

        test('posizione PC con flag ruotato (ridondante ma non deve rompere) -> soglia 150mm', () => {
            const note = describePlateCoversPipeDiameterLevel2({ weldingPositions: ['PC'], rotatedPosition: true });
            expect(note.minMm).toBe(150);
        });

        test('posizione PF senza flag ruotato -> resta soglia 500mm (non basta il codice posizione)', () => {
            const note = describePlateCoversPipeDiameterLevel2({ weldingPositions: ['PF'], rotatedPosition: false });
            expect(note.minMm).toBe(500);
        });

        test('posizione PF con flag ruotato -> soglia 150mm', () => {
            const note = describePlateCoversPipeDiameterLevel2({ weldingPositions: ['PF'], rotatedPosition: true });
            expect(note.minMm).toBe(150);
        });

        test('posizione PA con flag ruotato -> soglia 150mm', () => {
            const note = describePlateCoversPipeDiameterLevel2({ weldingPositions: ['PA'], rotatedPosition: true });
            expect(note.minMm).toBe(150);
        });
    });

    test('prompt section contiene le regole chiave', () => {
        const section = buildWpqrQualificationRulesPromptSection();
        expect(section).toContain('ISO 15614-1');
        expect(section).toContain('Level 2 qualifica anche Level 1');
        expect(section).toContain('isParentMaterialCombinationCovered');
    });

    describe('normalizeMaterialGroupCode', () => {
        test('accetta 1.2, 1, group 1.2', () => {
            expect(normalizeMaterialGroupCode('1.2')).toEqual({ group: 1, subgroup: '1.2' });
            expect(normalizeMaterialGroupCode('1')).toEqual({ group: 1, subgroup: null });
            expect(normalizeMaterialGroupCode('group 1.2')).toEqual({ group: 1, subgroup: '1.2' });
            expect(normalizeMaterialGroupCode('Gruppo 8.1')).toEqual({ group: 8, subgroup: '8.1' });
        });

        test('garbage -> null', () => {
            expect(normalizeMaterialGroupCode(null)).toBeNull();
            expect(normalizeMaterialGroupCode('acciaio')).toBeNull();
        });
    });

    describe('resolveSteelGradeToGroup', () => {
        test('S235 → 1.1, S355 → 1.2', () => {
            expect(resolveSteelGradeToGroup('S235').group).toBe('1.1');
            expect(resolveSteelGradeToGroup('S355').group).toBe('1.2');
            expect(resolveSteelGradeToGroup('S355J2+N').group).toBe('1.2');
        });

        test('codice gruppo passato attraverso', () => {
            expect(resolveSteelGradeToGroup('1.2').group).toBe('1.2');
        });

        test('sconosciuto → null + warning', () => {
            const r = resolveSteelGradeToGroup('InconelXYZ');
            expect(r.group).toBeNull();
            expect(r.warning).toMatch(/sconosciuto/i);
        });
    });

    describe('isParentMaterialCombinationCovered (Tabella 5)', () => {
        test('testato 1 o 1.2, genitori 1.2+1.1 (Mason) → covered', () => {
            expect(isParentMaterialCombinationCovered({
                materialGroupTested: '1.2',
                parentGroupA: '1.2',
                parentGroupB: '1.1',
            }).covered).toBe(true);

            expect(isParentMaterialCombinationCovered({
                materialGroupTested: '1',
                parentGroupA: '1.2',
                parentGroupB: '1.1',
            }).covered).toBe(true);
        });

        test('testato 8.1, genitori 1.2+1.1 → non coperto', () => {
            const r = isParentMaterialCombinationCovered({
                materialGroupTested: '8.1',
                parentGroupA: '1.2',
                parentGroupB: '1.1',
            });
            expect(r.covered).toBe(false);
        });

        test('testato 1.1, genitore omogeneo 1.2 → non coperto (footnote a)', () => {
            const r = isParentMaterialCombinationCovered({
                materialGroupTested: '1.1',
                parentGroupA: '1.2',
                parentGroupB: '1.2',
            });
            expect(r.covered).toBe(false);
            expect(r.reason).toMatch(/Footnote \(a\)|snervamento/i);
        });

        test('input null/garbage → covered false, no throw', () => {
            expect(isParentMaterialCombinationCovered({}).covered).toBe(false);
            expect(isParentMaterialCombinationCovered({
                materialGroupTested: 'xx',
                parentGroupA: '1.2',
                parentGroupB: '1.1',
            }).covered).toBe(false);
        });
    });
});
