/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
    query: jest.fn().mockResolvedValue({ recordset: [] }),
}));

const {
  extractPatternsFromDiffs,
  formatReferencePatternsPromptSection,
  REFERENCE_PATTERN_ALLOWLIST,
} = require('./ingestReferencePattern.service');

describe('ingestReferencePattern', () => {
  it('estrae pattern su campi allowlist', () => {
    const p = extractPatternsFromDiffs({
      standard_code: { ai: 'ISO_TR_15608_2013', human: 'ISO/TR 15608:2013' },
      person_name: { ai: 'Mario', human: 'Luigi' },
    });
    expect(p).toHaveLength(1);
    expect(p[0].field_key).toBe('standard_code');
  });

  it('formatta sezione prompt', () => {
    const s = formatReferencePatternsPromptSection([
      { field_key: 'standard_code', from_pattern: 'ISO_TR_15608', to_pattern: 'ISO/TR 15608:2013', hit_count: 12 },
    ]);
    expect(s).toContain('Pattern di riferimento settore');
    expect(s).toContain('12×');
  });

  it('allowlist esclude PII', () => {
    expect(REFERENCE_PATTERN_ALLOWLIST.has('person_name')).toBe(false);
    expect(REFERENCE_PATTERN_ALLOWLIST.has('standard_code')).toBe(true);
  });
});
