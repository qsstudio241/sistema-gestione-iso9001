'use strict';

const {
  normalizeShieldingGasCode,
  inferShieldingGasFromText,
  buildShieldingGasPromptSection,
} = require('./shieldingGases14175');

describe('shieldingGases14175', () => {
  test('normalizza M21', () => {
    expect(normalizeShieldingGasCode('M21')).toBe('M21');
    expect(normalizeShieldingGasCode('m21')).toBe('M21');
  });

  test('estrae simbolo da designazione lunga', () => {
    expect(normalizeShieldingGasCode('ISO 14175 – M21 – ArC – 18')).toBe('M21');
    expect(normalizeShieldingGasCode('ISO 14175-I1')).toBe('I1');
  });

  test('inferisce CO2 puro come C1', () => {
    expect(inferShieldingGasFromText('Gas: CO2 puro')).toBe('C1');
  });

  test('prompt section menziona ISO 14175', () => {
    const section = buildShieldingGasPromptSection();
    expect(section).toMatch(/ISO 14175/);
    expect(section).toMatch(/M21/);
  });
});
