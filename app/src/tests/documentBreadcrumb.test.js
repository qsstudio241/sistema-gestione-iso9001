/**
 * Test L1 - DocumentBreadcrumb utility functions
 *
 * Copre: sanitizeSegment (rimozione U+FFFD), formatItemLabel (codice + titolo).
 * Verifica che mojibake residuo da DB/API venga ripulito nella navigazione.
 */
import { describe, it, expect } from 'vitest';

function sanitizeSegment(s) {
  if (s == null || typeof s !== "string") return s;
  return s.replace(/\uFFFD/g, "").trim();
}

function formatItemLabel(item) {
  const title = sanitizeSegment(item.title);
  const code = item.folder_code != null ? sanitizeSegment(String(item.folder_code)) : "";
  if (code) return `${code} - ${title}`;
  return title;
}

// -- sanitizeSegment --

describe('DocumentBreadcrumb - sanitizeSegment', () => {
  it('rimuove caratteri U+FFFD (replacement character)', () => {
    expect(sanitizeSegment('Qualit\uFFFD')).toBe('Qualit');
  });

  it('rimuove multipli U+FFFD nella stessa stringa', () => {
    expect(sanitizeSegment('\uFFFDTest\uFFFD testo\uFFFD')).toBe('Test testo');
  });

  it('trimma whitespace', () => {
    expect(sanitizeSegment('  Documento  ')).toBe('Documento');
  });

  it('ritorna null per input null', () => {
    expect(sanitizeSegment(null)).toBeNull();
  });

  it('ritorna undefined per input undefined', () => {
    expect(sanitizeSegment(undefined)).toBeUndefined();
  });

  it('non altera stringa ASCII pura', () => {
    expect(sanitizeSegment('Procedura Quality Control')).toBe('Procedura Quality Control');
  });

  it('gestisce stringa vuota', () => {
    expect(sanitizeSegment('')).toBe('');
  });

  it('gestisce numero passato come input non-stringa', () => {
    expect(sanitizeSegment(42)).toBe(42);
  });
});

// -- formatItemLabel --

describe('DocumentBreadcrumb - formatItemLabel', () => {
  it('con folder_code: produce "codice - titolo"', () => {
    const item = { title: 'Procedure Operative', folder_code: '2.1' };
    expect(formatItemLabel(item)).toBe('2.1 - Procedure Operative');
  });

  it('senza folder_code: produce solo titolo', () => {
    const item = { title: 'Documenti Generali' };
    expect(formatItemLabel(item)).toBe('Documenti Generali');
  });

  it('con folder_code null: produce solo titolo', () => {
    const item = { title: 'Root', folder_code: null };
    expect(formatItemLabel(item)).toBe('Root');
  });

  it('con folder_code numerico: lo converte in stringa', () => {
    const item = { title: 'Sezione', folder_code: 3 };
    expect(formatItemLabel(item)).toBe('3 - Sezione');
  });

  it('sanitizza U+FFFD dal titolo e dal codice', () => {
    const item = { title: 'Qualit\uFFFD', folder_code: '1\uFFFD.2' };
    expect(formatItemLabel(item)).toBe('1.2 - Qualit');
  });

  it('folder_code 0 e valido (non falsy per null check)', () => {
    const item = { title: 'Root', folder_code: 0 };
    expect(formatItemLabel(item)).toBe('0 - Root');
  });
});
