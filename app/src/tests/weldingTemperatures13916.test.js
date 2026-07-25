import { describe, expect, test } from 'vitest';
import {
  EQUIPMENT_CODES,
  TEMPERATURE_SYMBOLS,
  buildWeldingTemperaturePromptSection,
} from '../data/weldingTemperatures13916.js';

describe('weldingTemperatures13916', () => {
  test('simboli e attrezzatura', () => {
    expect(TEMPERATURE_SYMBOLS.Tp).toMatch(/preheating/i);
    expect(TEMPERATURE_SYMBOLS.Ti).toMatch(/interpass/i);
    expect(Object.keys(EQUIPMENT_CODES)).toContain('CT');
  });

  test('prompt section menziona campi WPS', () => {
    const section = buildWeldingTemperaturePromptSection();
    expect(section).toContain('preheat_temp');
    expect(section).toContain('interpass_temp');
    expect(section).toContain('Tp 155');
  });
});
