import { describe, expect, test } from 'vitest';
import {
  normalizeShieldingGasCode,
  inferShieldingGasFromText,
} from '../data/shieldingGases14175.js';

describe('shieldingGases14175', () => {
  test('normalizza I1 e M21', () => {
    expect(normalizeShieldingGasCode('I1')).toBe('I1');
    expect(normalizeShieldingGasCode('ISO 14175 – M21 – ArC – 18')).toBe('M21');
  });

  test('inferisce argon come I1', () => {
    expect(inferShieldingGasFromText('Gas di protezione: argon')).toBe('I1');
  });
});
