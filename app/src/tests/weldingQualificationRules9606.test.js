import { describe, expect, it } from 'vitest';
import {
  CONFIRMATION_INTERVAL_MONTHS,
  computeQualifiedPipeDiameterRange,
  computeQualifiedFilletThicknessRange,
  computeQualifiedThicknessRangeButtWeld,
  computeQualifiedWeldingPositions,
  isWeldingPositionQualified,
  describePlateOnlyRotatingPositionDiameterNote,
  buildWelderQualificationRulesPromptSection,
} from '../data/weldingQualificationRules9606.js';

describe('weldingQualificationRules9606', () => {
  it('conferma periodica fissa a 6 mesi (ISO 9606-1 §9.2)', () => {
    expect(CONFIRMATION_INTERVAL_MONTHS).toBe(6);
  });

  describe('computeQualifiedPipeDiameterRange (Tabella 7)', () => {
    it('D <= 25 mm -> [D, 2D]', () => {
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 20 })).toEqual({ minMm: 20, maxMm: 40 });
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 25 })).toEqual({ minMm: 25, maxMm: 50 });
    });

    it('D > 25 mm -> [max(0.5D, 25), null]', () => {
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 60 })).toEqual({ minMm: 30, maxMm: null });
      // 0.5*40 = 20 < 25 -> minimo forzato a 25
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 40 })).toEqual({ minMm: 25, maxMm: null });
    });

    it('input non valido -> null', () => {
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: null })).toBeNull();
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 'n/d' })).toBeNull();
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 0 })).toBeNull();
      expect(computeQualifiedPipeDiameterRange({})).toBeNull();
    });
  });

  describe('computeQualifiedFilletThicknessRange (Tabella 8, entrambe le righe verificate)', () => {
    it('t < 3 mm -> [t, max(2t, 3)]', () => {
      expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 2 })).toEqual({ minMm: 2, maxMm: 4 });
      expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 1 })).toEqual({ minMm: 1, maxMm: 3 });
    });

    it('t >= 3 mm -> [3, null] (GAP risolto 26/07/2026, ex t>=3 tornava null)', () => {
      expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 3 })).toEqual({ minMm: 3, maxMm: null });
      expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 10 })).toEqual({ minMm: 3, maxMm: null });
    });

    it('input non valido -> null', () => {
      expect(computeQualifiedFilletThicknessRange({ testThicknessMm: -1 })).toBeNull();
      expect(computeQualifiedFilletThicknessRange({})).toBeNull();
    });
  });

  describe('computeQualifiedThicknessRangeButtWeld (Tabella 6, GAP risolto 26/07/2026)', () => {
    it('s < 3 mm -> [s, max(2s, 3)]', () => {
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 2 })).toEqual({ minMm: 2, maxMm: 4 });
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 1 })).toEqual({ minMm: 1, maxMm: 3 });
    });

    it('3 <= s < 12 mm -> [3, 2s]', () => {
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 3 })).toEqual({ minMm: 3, maxMm: 6 });
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 8 })).toEqual({ minMm: 3, maxMm: 16 });
    });

    it('s >= 12 mm -> [3, null]', () => {
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 12 })).toEqual({ minMm: 3, maxMm: null });
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 20 })).toEqual({ minMm: 3, maxMm: null });
    });

    it('processo 311 (ossiacetilenica): moltiplicatore 1,5 invece di 2 (note c/d)', () => {
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 2, weldingProcessCode: '311' })).toEqual({ minMm: 2, maxMm: 3 });
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 8, weldingProcessCode: '311' })).toEqual({ minMm: 3, maxMm: 12 });
    });

    it('input non valido -> null', () => {
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: -1 })).toBeNull();
      expect(computeQualifiedThicknessRangeButtWeld({})).toBeNull();
    });
  });

  describe('computeQualifiedWeldingPositions / isWeldingPositionQualified (Tabelle 9/10, GAP risolto 26/07/2026)', () => {
    it('Tabella 9 (BW): PA qualifica solo PA', () => {
      expect(computeQualifiedWeldingPositions({ testPosition: 'PA', jointType: 'BW' })).toEqual(['PA']);
    });

    it('Tabella 9 (BW): H-L045 qualifica PA/PC/PE/PF', () => {
      expect(computeQualifiedWeldingPositions({ testPosition: 'H-L045', jointType: 'BW' })).toEqual(['PA', 'PC', 'PE', 'PF']);
    });

    it('Tabella 10 (FW): PH qualifica PA-PF (non PG)', () => {
      expect(computeQualifiedWeldingPositions({ testPosition: 'PH', jointType: 'FW' })).toEqual(['PA', 'PB', 'PC', 'PD', 'PE', 'PF']);
    });

    it('posizione non riconosciuta -> null', () => {
      expect(computeQualifiedWeldingPositions({ testPosition: 'ZZ', jointType: 'BW' })).toBeNull();
      expect(computeQualifiedWeldingPositions({})).toBeNull();
    });

    it('isWeldingPositionQualified: PC (BW) qualifica PA ma non PE', () => {
      expect(isWeldingPositionQualified({ testPosition: 'PC', targetPosition: 'PA', jointType: 'BW' })).toBe(true);
      expect(isWeldingPositionQualified({ testPosition: 'PC', targetPosition: 'PE', jointType: 'BW' })).toBe(false);
    });

    it('isWeldingPositionQualified: posizione testata sconosciuta -> null (nessun giudizio)', () => {
      expect(isWeldingPositionQualified({ testPosition: 'ZZ', targetPosition: 'PA' })).toBeNull();
    });
  });

  it('prompt section contiene le regole chiave', () => {
    const section = buildWelderQualificationRulesPromptSection();
    expect(section).toContain('ISO 9606-1');
    expect(section).toContain('6 mesi');
    expect(section).toContain('135');
  });

  describe('describePlateOnlyRotatingPositionDiameterNote (feedback cliente Studio Mason, da confermare)', () => {
    it('nessuna nota se il tubo e\u2019 stato testato direttamente', () => {
      expect(describePlateOnlyRotatingPositionDiameterNote({
        hasPipeDiameter: true,
        weldingPositions: ['PA'],
      })).toBeNull();
    });

    it('nessuna nota se le posizioni non includono PA/PB/PC/PD', () => {
      expect(describePlateOnlyRotatingPositionDiameterNote({
        hasPipeDiameter: false,
        weldingPositions: ['PF', 'PG'],
      })).toBeNull();
    });

    it('\u2265500 mm per piastra in posizione PA/PB/PC/PD non rotante', () => {
      const note = describePlateOnlyRotatingPositionDiameterNote({
        hasPipeDiameter: false,
        weldingPositions: ['PA'],
        rotatingPosition: false,
      });
      expect(note).toContain('\u2265500 mm');
      expect(note).toContain('da confermare');
    });

    it('\u226575 mm quando la posizione di prova e\u2019 rotante', () => {
      const note = describePlateOnlyRotatingPositionDiameterNote({
        hasPipeDiameter: false,
        weldingPositions: 'PC, PD',
        rotatingPosition: true,
      });
      expect(note).toContain('\u226575 mm');
    });
  });
});
