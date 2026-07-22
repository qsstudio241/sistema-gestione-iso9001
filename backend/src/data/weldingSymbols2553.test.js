'use strict';

const {
  BASIC_WELD_SYMBOLS,
  SUPPLEMENTARY_WELD_SYMBOLS,
  getWeldSymbolByKey,
  buildWeldingSymbolPromptSection,
} = require('./weldingSymbols2553');

describe('weldingSymbols2553', () => {
  test('cataloghi non vuoti e coerenti', () => {
    expect(BASIC_WELD_SYMBOLS.length).toBeGreaterThan(5);
    expect(SUPPLEMENTARY_WELD_SYMBOLS.length).toBeGreaterThan(3);
    for (const s of [...BASIC_WELD_SYMBOLS, ...SUPPLEMENTARY_WELD_SYMBOLS]) {
      expect(s.key).toBeTruthy();
      expect(s.labelIt).toBeTruthy();
      expect(s.shapeHint).toBeTruthy();
    }
  });

  test('getWeldSymbolByKey trova un simbolo elementare', () => {
    const s = getWeldSymbolByKey('fillet');
    expect(s).not.toBeNull();
    expect(s.labelIt).toMatch(/angolo/i);
  });

  test('getWeldSymbolByKey trova un simbolo supplementare (case-insensitive)', () => {
    const s = getWeldSymbolByKey('WELD_ALL_ROUND');
    expect(s).not.toBeNull();
    expect(s.labelIt).toMatch(/perimetrale/i);
  });

  test('getWeldSymbolByKey ritorna null per chiave inesistente o assente', () => {
    expect(getWeldSymbolByKey('non_esiste')).toBeNull();
    expect(getWeldSymbolByKey(null)).toBeNull();
    expect(getWeldSymbolByKey(undefined)).toBeNull();
  });

  test('buildWeldingSymbolPromptSection produce una sezione di prompt coerente', () => {
    const section = buildWeldingSymbolPromptSection();
    expect(section).toContain('SIMBOLI DI SALDATURA ISO 2553');
    expect(section).toContain('FINE SIMBOLI ISO 2553');
    expect(section).toContain('cateto');
    expect(section).toContain('ISO 4063');
  });

  test('buildWeldingSymbolPromptSection rispetta i limiti maxBasic/maxSupplementary', () => {
    const section = buildWeldingSymbolPromptSection({ maxBasic: 2, maxSupplementary: 1 });
    const basicCount = BASIC_WELD_SYMBOLS.slice(0, 2).filter((s) => section.includes(s.labelIt)).length;
    expect(basicCount).toBe(2);
  });
});
