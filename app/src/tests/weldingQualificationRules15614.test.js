import { describe, expect, it } from 'vitest';
import {
  computeQualifiedFilletThroatThicknessRange,
  computeQualifiedMaterialThicknessRangeLevel2,
  computeMinimumQualifiedThicknessWithImpactTest,
  isDiameterEssentialVariable,
  describeQualifiedPipeDiameterRangeLevel2,
  describePlateCoversPipeDiameterLevel2,
  buildWpqrQualificationRulesPromptSection,
} from '../data/weldingQualificationRules15614.js';

describe('weldingQualificationRules15614', () => {
  describe('computeQualifiedFilletThroatThicknessRange (Tabella 8)', () => {
    it('t <= 3mm -> [0,7t, 2t]', () => {
      expect(computeQualifiedFilletThroatThicknessRange({ testThicknessMm: 2 })).toEqual({ minMm: 1.4, maxMm: 4 });
    });

    it('3 < t < 30mm -> [3 (fisso), 2t]', () => {
      expect(computeQualifiedFilletThroatThicknessRange({ testThicknessMm: 10 })).toEqual({ minMm: 3, maxMm: 20 });
    });

    it('t >= 30mm -> [5, null]', () => {
      expect(computeQualifiedFilletThroatThicknessRange({ testThicknessMm: 40 })).toEqual({ minMm: 5, maxMm: null });
    });

    it('input non valido -> null', () => {
      expect(computeQualifiedFilletThroatThicknessRange({ testThicknessMm: null })).toBeNull();
      expect(computeQualifiedFilletThroatThicknessRange({})).toBeNull();
    });
  });

  describe('computeQualifiedMaterialThicknessRangeLevel2 (Tabella 7, bande 3-40mm)', () => {
    it('3 < t <= 12mm -> [max(0.5t,3), 1.3t]', () => {
      expect(computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm: 10 })).toEqual({ minMm: 5, maxMm: 13 });
      expect(computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm: 4 })).toEqual({ minMm: 3, maxMm: 5.2 });
    });

    it('12 < t <= 40mm -> [0.5t, 1.1t]', () => {
      expect(computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm: 20 })).toEqual({ minMm: 10, maxMm: 22 });
    });

    it('t <= 3mm o t > 40mm -> null (GAP dichiarato)', () => {
      expect(computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm: 3 })).toBeNull();
      expect(computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm: 50 })).toBeNull();
    });
  });

  describe('computeMinimumQualifiedThicknessWithImpactTest', () => {
    it('t >= 16mm -> minimo 16mm', () => {
      expect(computeMinimumQualifiedThicknessWithImpactTest({ testThicknessMm: 20 })).toBe(16);
    });

    it('6 < t < 16mm -> minimo = t', () => {
      expect(computeMinimumQualifiedThicknessWithImpactTest({ testThicknessMm: 10 })).toBe(10);
    });

    it('t <= 6mm -> minimo = 0,5t', () => {
      expect(computeMinimumQualifiedThicknessWithImpactTest({ testThicknessMm: 4 })).toBe(2);
    });

    it('input non valido -> null', () => {
      expect(computeMinimumQualifiedThicknessWithImpactTest({})).toBeNull();
    });
  });

  describe('isDiameterEssentialVariable', () => {
    it('Level 2 -> true', () => {
      expect(isDiameterEssentialVariable('2')).toBe(true);
      expect(isDiameterEssentialVariable(2)).toBe(true);
    });

    it('Level 1 o assente -> false', () => {
      expect(isDiameterEssentialVariable('1')).toBe(false);
      expect(isDiameterEssentialVariable(null)).toBe(false);
    });
  });

  describe('describeQualifiedPipeDiameterRangeLevel2 (Tabella 9)', () => {
    it('D -> [0,5D, null]', () => {
      expect(describeQualifiedPipeDiameterRangeLevel2({ testDiameterMm: 100 })).toEqual({ minMm: 50, maxMm: null });
    });

    it('input non valido -> null', () => {
      expect(describeQualifiedPipeDiameterRangeLevel2({ testDiameterMm: 0 })).toBeNull();
    });
  });

  describe('describePlateCoversPipeDiameterLevel2', () => {
    it('posizione non ruotata -> soglia 500mm', () => {
      const note = describePlateCoversPipeDiameterLevel2({ weldingPositions: ['PA'], rotatedPosition: false });
      expect(note.minMm).toBe(500);
    });

    it('posizione PC/PF/PA ruotata -> soglia 150mm', () => {
      const note = describePlateCoversPipeDiameterLevel2({ weldingPositions: ['PC'], rotatedPosition: true });
      expect(note.minMm).toBe(150);
    });
  });

  it('prompt section contiene le regole chiave', () => {
    const section = buildWpqrQualificationRulesPromptSection();
    expect(section).toContain('ISO 15614-1');
    expect(section).toContain('Level 2 qualifica anche Level 1');
  });
});
