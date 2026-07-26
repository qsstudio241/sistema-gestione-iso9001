/**
 * @jest-environment node
 */

const {
  EXAMPLE_COMPOSITION_SYMBOLS,
  IMPACT_SYMBOLS,
  STRENGTH_SYMBOLS_A,
  buildFillerWire14341PromptSection,
} = require('./fillerWire14341');

describe('fillerWire14341', () => {
  test('simboli resistenza A e impatto', () => {
    expect(STRENGTH_SYMBOLS_A).toContain('42');
    expect(IMPACT_SYMBOLS['4']).toBe('-40');
    expect(EXAMPLE_COMPOSITION_SYMBOLS).toContain('3Si1');
  });

  test('prompt section menziona filler_material e designazione tipica', () => {
    const section = buildFillerWire14341PromptSection();
    expect(section).toContain('filler_material');
    expect(section).toMatch(/ISO 14341/);
    expect(section).toContain('G 42 4 M21 4Si1');
  });
});
