'use strict';

const {
  formatDocCode,
  sanitizeDocPrefix,
  computeExpiryFromMonths,
} = require('./docCodeGenerator.service');

describe('docCodeGenerator.service (pure helpers)', () => {
  it('formatDocCode produce PREFISSO-NNN', () => {
    expect(formatDocCode('pg', 1)).toBe('PG-001');
    expect(formatDocCode('PG', 42)).toBe('PG-042');
  });

  it('sanitizeDocPrefix rimuove caratteri non alfanumerici', () => {
    expect(sanitizeDocPrefix('P-G 1')).toBe('PG1');
    expect(sanitizeDocPrefix('')).toBeNull();
  });

  it('computeExpiryFromMonths aggiunge mesi a issue_date', () => {
    const result = computeExpiryFromMonths(24, '2024-01-15');
    expect(result).toBe('2026-01-15');
  });

  it('computeExpiryFromMonths ritorna null senza mesi o data', () => {
    expect(computeExpiryFromMonths(null, '2024-01-01')).toBeNull();
    expect(computeExpiryFromMonths(12, null)).toBeNull();
  });
});
