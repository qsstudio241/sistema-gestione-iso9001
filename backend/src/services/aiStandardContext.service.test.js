const {
  buildStandardContextBlock,
  resolveStandardCodesForFilter,
} = require('./aiStandardContext.service');

describe('aiStandardContext.service', () => {
  it('returns empty block when standard is null', () => {
    expect(buildStandardContextBlock(null)).toBe('');
  });

  it('includes norm label and filtering instruction', () => {
    const block = buildStandardContextBlock({
      standard_id: 1,
      standard_code: 'ISO_9001_2015',
      standard_name: 'ISO 9001',
      standard_full_name: 'ISO 9001:2015 - Qualit\u00e0',
      version: '2015',
    });

    expect(block).toContain('NORMA ATTIVA');
    expect(block).toContain('ISO 9001:2015 - Qualit\u00e0');
    expect(block).toContain('ISO_9001_2015');
    expect(block).toContain('Filtra audit');
  });

  it('resolves code variants for norm_chunks filter', () => {
    const codes = resolveStandardCodesForFilter({
      standard_id: 1,
      standard_code: 'ISO_9001_2015',
    });

    expect(codes).toEqual(expect.arrayContaining(['ISO_9001', 'ISO_9001_2015']));
  });

  it('returns empty codes when standard is null', () => {
    expect(resolveStandardCodesForFilter(null)).toEqual([]);
  });
});
