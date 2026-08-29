import { describe, expect, it } from 'vitest';
import {
  BOILER_PIN_BEND_MOMENTS_NM,
  isIso14555,
  describeQualifiedStudSectionRange,
  describeQualifiedParentThicknessRange14555,
  describeQualifiedPositions14555,
  isPositionCovered14555,
  isBathProtectionCovered14555,
  isSimilarMaterialsCovered14555,
  isDissimilarMaterialsCovered14555,
  isThroughDeckSheetThickness,
  isThroughDeckSheetCovered14555,
  getBoilerPinMinimumBendMomentNm,
  evaluateBoilerPinBendAcceptance,
} from '../data/weldingQualificationRules14555.js';

describe('weldingQualificationRules14555', () => {
  describe('isIso14555', () => {
    it('riconosce 14555 in standard_reference', () => {
      expect(isIso14555('UNI EN ISO 14555:2025')).toBe(true);
      expect(isIso14555('ISO 14555')).toBe(true);
      expect(isIso14555('UNI EN ISO 15614-1:2017')).toBe(false);
    });
  });

  describe('describeQualifiedStudSectionRange (§10.2.8.8)', () => {
    it('una prova → solo quella sezione', () => {
      expect(describeQualifiedStudSectionRange({ testSectionsMm: 12 })).toEqual(
        expect.objectContaining({ minMm: 12, maxMm: 12, allForms: true }),
      );
    });

    it('due prove → intervallo tra le sezioni', () => {
      expect(describeQualifiedStudSectionRange({ testSectionsMm: [8, 16] })).toEqual(
        expect.objectContaining({ minMm: 8, maxMm: 16, allForms: true }),
      );
    });

    it('input non valido → null', () => {
      expect(describeQualifiedStudSectionRange({})).toBeNull();
      expect(describeQualifiedStudSectionRange({ testSectionsMm: 0 })).toBeNull();
    });
  });

  describe('describeQualifiedParentThicknessRange14555 (§10.2.8.6)', () => {
    it('pWPS applicabile → tutti gli spessori (non Tabella 7)', () => {
      const r = describeQualifiedParentThicknessRange14555({ pWpsApplies: true });
      expect(r.allThicknesses).toBe(true);
      expect(r.minMm).toBeNull();
      expect(r.maxMm).toBeNull();
      expect(r.clause).toMatch(/non Tabella 7/);
    });

    it('pWPS non applicabile → nessuna copertura automatica', () => {
      expect(describeQualifiedParentThicknessRange14555({ pWpsApplies: false }).allThicknesses)
        .toBe(false);
    });
  });

  describe('posizioni (§10.2.8.9)', () => {
    it('tw ≤ 100 ms → una posizione copre tutte', () => {
      const r = describeQualifiedPositions14555({
        weldingTimeMs: 80,
        testPosition: 'PA',
      });
      expect(r.covers).toEqual(['PA', 'PC', 'PE']);
      expect(isPositionCovered14555({
        weldingTimeMs: 80,
        testPosition: 'PA',
        productionPosition: 'PE',
      })).toBe(true);
    });

    it('tw > 100 ms → PC copre PE e PA; PE copre PA; PA solo PA', () => {
      expect(describeQualifiedPositions14555({
        weldingTimeMs: 150,
        testPosition: 'PC',
      }).covers).toEqual(['PC', 'PE', 'PA']);
      expect(isPositionCovered14555({
        weldingTimeMs: 150,
        testPosition: 'PE',
        productionPosition: 'PA',
      })).toBe(true);
      expect(isPositionCovered14555({
        weldingTimeMs: 150,
        testPosition: 'PA',
        productionPosition: 'PC',
      })).toBe(false);
    });

    it('through-deck solo PA', () => {
      expect(describeQualifiedPositions14555({
        weldingTimeMs: 50,
        testPosition: 'PC',
        throughDeck: true,
      }).covers).toEqual([]);
      expect(describeQualifiedPositions14555({
        weldingTimeMs: 50,
        testPosition: 'PA',
        throughDeck: true,
      }).covers).toEqual(['PA']);
    });
  });

  describe('protezione bagno (§10.2.8.12)', () => {
    it('metodo specifico → solo quel metodo; NP copre SG', () => {
      expect(isBathProtectionCovered14555({ qualifiedMethod: 'CF', productionMethod: 'CF' })).toBe(true);
      expect(isBathProtectionCovered14555({ qualifiedMethod: 'CF', productionMethod: 'SG' })).toBe(false);
      expect(isBathProtectionCovered14555({ qualifiedMethod: 'SG', productionMethod: 'NP' })).toBe(false);
      expect(isBathProtectionCovered14555({ qualifiedMethod: 'NP', productionMethod: 'SG' })).toBe(true);
      expect(isBathProtectionCovered14555({ qualifiedMethod: 'NP', productionMethod: 'NP' })).toBe(true);
      expect(isBathProtectionCovered14555({ qualifiedMethod: 'NP', productionMethod: 'CF' })).toBe(false);
    });
  });

  describe('materiali simili (§10.2.8.4)', () => {
    it('stesso gruppo → coperto', () => {
      expect(isSimilarMaterialsCovered14555({
        parentGroup: '1.1',
        studGroup: '1',
      }).covered).toBe(true);
    });

    it('(a) d ≤ 13: 8 ↔ 1 / 2.1', () => {
      expect(isSimilarMaterialsCovered14555({
        parentGroup: '8',
        studGroup: '1',
        studDiameterMm: 12,
      }).covered).toBe(true);
      expect(isSimilarMaterialsCovered14555({
        parentGroup: '8',
        studGroup: '1',
        studDiameterMm: 16,
      }).covered).toBe(false);
    });

    it('(b) tw < 10 ms: 8 ↔ 1–6 e 11.1', () => {
      expect(isSimilarMaterialsCovered14555({
        parentGroup: '8',
        studGroup: '5',
        weldingTimeMs: 5,
      }).covered).toBe(true);
      expect(isSimilarMaterialsCovered14555({
        parentGroup: '8',
        studGroup: '11.1',
        weldingTimeMs: 5,
      }).covered).toBe(true);
    });
  });

  describe('materiali dissimili (§10.2.8.5)', () => {
    it('(a) tw > 100 ms → qualifica dedicata, nessuna matrice', () => {
      const r = isDissimilarMaterialsCovered14555({
        parentGroup: '8',
        studGroup: '1',
        weldingTimeMs: 120,
      });
      expect(r.covered).toBe(false);
      expect(r.dedicatedQualificationRequired).toBe(true);
    });

    it('(b) tw ≤ 100 ms: 8/10 ↔ 1 e 2.1', () => {
      expect(isDissimilarMaterialsCovered14555({
        parentGroup: '10',
        studGroup: '2.1',
        weldingTimeMs: 90,
      }).covered).toBe(true);
    });

    it('(c) tw < 10 ms: 8 ↔ 1–6 e 11.1', () => {
      expect(isDissimilarMaterialsCovered14555({
        parentGroup: '8',
        studGroup: '4',
        weldingTimeMs: 8,
      }).covered).toBe(true);
    });
  });

  describe('through-deck (§10.2.8.7 + §3.14)', () => {
    it('soglia lastra < 3 mm', () => {
      expect(isThroughDeckSheetThickness({ sheetThicknessMm: 2.5 })).toBe(true);
      expect(isThroughDeckSheetThickness({ sheetThicknessMm: 3 })).toBe(false);
    });

    it('lastra più spessa copre più sottili', () => {
      expect(isThroughDeckSheetCovered14555({
        qualifiedSheetThicknessMm: 2.5,
        productionSheetThicknessMm: 1.5,
      }).covered).toBe(true);
      expect(isThroughDeckSheetCovered14555({
        qualifiedSheetThicknessMm: 1.5,
        productionSheetThicknessMm: 2.5,
      }).covered).toBe(false);
    });
  });

  describe('Tabella 2 boiler pins', () => {
    it('8→40, 10→60, 12→85 Nm', () => {
      expect(BOILER_PIN_BEND_MOMENTS_NM).toEqual({ 8: 40, 10: 60, 12: 85 });
      expect(getBoilerPinMinimumBendMomentNm(8)).toBe(40);
      expect(getBoilerPinMinimumBendMomentNm(10)).toBe(60);
      expect(getBoilerPinMinimumBendMomentNm(12)).toBe(85);
      expect(getBoilerPinMinimumBendMomentNm(14)).toBeNull();
    });

    it('criterio §12.3 OR Tabella 2 (salvo specifica diversa)', () => {
      expect(evaluateBoilerPinBendAcceptance({
        diameterMm: 8,
        measuredMomentNm: 40,
      })).toEqual(expect.objectContaining({ accepted: true, criterion: 'table_2' }));

      expect(evaluateBoilerPinBendAcceptance({
        diameterMm: 10,
        measuredMomentNm: 50,
        clause123Ok: true,
      })).toEqual(expect.objectContaining({ accepted: true, criterion: 'clause_12_3' }));

      expect(evaluateBoilerPinBendAcceptance({
        diameterMm: 12,
        measuredMomentNm: 80,
      })).toEqual(expect.objectContaining({ accepted: false, criterion: 'fail' }));

      expect(evaluateBoilerPinBendAcceptance({
        diameterMm: 12,
        measuredMomentNm: 10,
        alternativeSpecification: true,
      })).toEqual(expect.objectContaining({
        accepted: true,
        criterion: 'alternative_specification',
      }));
    });
  });
});
