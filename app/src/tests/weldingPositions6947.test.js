import { describe, expect, it } from 'vitest';
import {
  extractWeldingPositionsFromText,
  normalizeWeldingPositions,
  buildWeldingPositionPromptSection,
} from '../data/weldingPositions6947.js';

describe('weldingPositions6947', () => {
  it('estrae posizioni multiple', () => {
    expect(extractWeldingPositionsFromText('Posizioni PA, PF e PE')).toEqual(
      expect.arrayContaining(['PA', 'PF', 'PE']),
    );
  });

  it('normalizza H-L045', () => {
    expect(normalizeWeldingPositions('HL045')).toEqual(['H-L045']);
  });

  it('prompt section contiene PA e PE', () => {
    const section = buildWeldingPositionPromptSection();
    expect(section).toContain('PA');
    expect(section).toContain('ISO 6947');
  });
});
