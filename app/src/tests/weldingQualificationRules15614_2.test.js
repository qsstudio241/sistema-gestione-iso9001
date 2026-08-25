import {
  computeQualifiedMaterialThicknessRange15614_2,
  computeQualifiedFilletThroatThicknessRange15614_2,
  isIso15614Part2,
} from '../data/weldingQualificationRules15614_2';

describe('weldingQualificationRules15614_2 (FE mirror)', () => {
  it('Tabella 5 bande principali', () => {
    expect(computeQualifiedMaterialThicknessRange15614_2({ testThicknessMm: 25 }))
      .toEqual({ minMm: 5, maxMm: 50 });
  });

  it('Tabella 6 gola', () => {
    expect(computeQualifiedFilletThroatThicknessRange15614_2({ testThicknessMm: 5 }))
      .toEqual({ minMm: 3, maxMm: 10 });
  });

  it('isIso15614Part2', () => {
    expect(isIso15614Part2('EN ISO 15614-2')).toBe(true);
  });
});
