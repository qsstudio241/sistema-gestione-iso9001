const {
  sanitizePrefix,
  formatAuditNumber,
  getRomeCalendarParts,
  MASON_AUDIT_NUMBER_RE,
} = require('./auditNumberAllocation.core');

describe('auditNumberAllocation helpers', () => {
  test('sanitizePrefix default e pulizia', () => {
    expect(sanitizePrefix(null)).toBe('MSN');
    expect(sanitizePrefix('')).toBe('MSN');
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

  test('MASON_AUDIT_NUMBER_RE accetta formato task', () => {
    expect(MASON_AUDIT_NUMBER_RE.test('MSN-260417-01')).toBe(true);
    expect(MASON_AUDIT_NUMBER_RE.test('AUD-2026-01')).toBe(false);
  });
});
