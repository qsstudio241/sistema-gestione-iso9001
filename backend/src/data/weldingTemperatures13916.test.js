/**
 * @jest-environment node
 */

const {
  TEMPERATURE_SYMBOLS,
  EQUIPMENT_CODES,
  buildWeldingTemperaturePromptSection,
} = require('./weldingTemperatures13916');

describe('weldingTemperatures13916', () => {
  it('espone simboli Tp Ti Tm e attrezzatura TS CT TE TB', () => {
    expect(TEMPERATURE_SYMBOLS.Tp).toMatch(/preheating/i);
    expect(TEMPERATURE_SYMBOLS.Ti).toMatch(/interpass/i);
    expect(TEMPERATURE_SYMBOLS.Tm).toMatch(/maintenance/i);
    expect(Object.keys(EQUIPMENT_CODES).sort()).toEqual(['CT', 'TB', 'TE', 'TS']);
  });

  it('buildWeldingTemperaturePromptSection guida preheat/interpass', () => {
    const section = buildWeldingTemperaturePromptSection();
    expect(section).toContain('preheat_temp');
    expect(section).toContain('interpass_temp');
    expect(section).toContain('ISO 13916');
    expect(section).toContain('PWHT');
  });
});
