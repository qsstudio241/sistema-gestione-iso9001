'use strict';

const {
  extractEmailFromText,
  extractNameFromText,
  resolveContactEmail,
  normalizeNameKey,
} = require('./importNotificationContactsHelpers');

describe('importNotificationContactsHelpers', () => {
  it('estrae email da testo libero', () => {
    expect(extractEmailFromText('Mario Rossi mario@studio.it')).toBe('mario@studio.it');
    expect(extractEmailFromText('  ')).toBeNull();
  });

  it('estrae solo il nome senza email', () => {
    expect(extractNameFromText('Mario Rossi mario@studio.it')).toBe('Mario Rossi');
    expect(extractNameFromText('  Luigi Verdi  ')).toBe('Luigi Verdi');
  });

  it('genera placeholder email se non deducibile', () => {
    const email = resolveContactEmail('Mario Rossi');
    expect(email).toMatch(/@import\.placeholder\.local$/);
    expect(resolveContactEmail('Anna B. anna@test.it')).toBe('anna@test.it');
  });

  it('normalizza chiave nome case-insensitive', () => {
    expect(normalizeNameKey(' Mario Rossi ')).toBe('mario rossi');
  });
});
