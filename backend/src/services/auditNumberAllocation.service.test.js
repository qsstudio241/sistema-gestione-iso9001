const {
  sanitizePrefix,
  formatAuditNumber,
  getRomeCalendarParts,
} = require('./auditNumberAllocation.service');

describe('auditNumberAllocation helpers', () => {
  test('sanitizePrefix default e pulizia', () => {
    // Default 'AUD' (generico): 'MSN' era il prefisso di un tenant specifico,
    // rimosso come fallback globale in 7c42b6dd (10/05/2026).
    expect(sanitizePrefix(null)).toBe('AUD');
    expect(sanitizePrefix('')).toBe('AUD');
    expect(sanitizePrefix('  msn  ')).toBe('MSN');
    expect(sanitizePrefix('AB-12')).toBe('AB12');
    expect(sanitizePrefix('x'.repeat(20))).toBe('XXXXXXXXXXXXXXXX');
  });

  test('formatAuditNumber', () => {
    expect(formatAuditNumber('MSN', 1, { yymmdd: '260417' })).toBe('MSN-260417-01');
    expect(formatAuditNumber('MSN', 9, { yymmdd: '260417' })).toBe('MSN-260417-09');
    expect(formatAuditNumber('MSN', 10, { yymmdd: '260417' })).toBe('MSN-260417-10');
  });

  test('getRomeCalendarParts ha yymmdd a 6 cifre', () => {
    const p = getRomeCalendarParts(new Date('2026-04-17T12:00:00Z'));
    expect(p.sqlDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p.yymmdd).toMatch(/^\d{6}$/);
  });
});
