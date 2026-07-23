import { describe, expect, it } from 'vitest';
import {
  isExpiredSemaforo,
  isExpiringSemaforo,
  isExpiredOrExpiringSemaforo,
  getWelderQualificationWarning,
} from '../utils/welderQualificationExpiryWarnings.js';

describe('welderQualificationExpiryWarnings', () => {
  it('isExpiredSemaforo riconosce solo "rosso"', () => {
    expect(isExpiredSemaforo('rosso')).toBe(true);
    expect(isExpiredSemaforo('giallo')).toBe(false);
    expect(isExpiredSemaforo('verde')).toBe(false);
  });

  it('isExpiringSemaforo riconosce giallo/arancione', () => {
    expect(isExpiringSemaforo('giallo')).toBe(true);
    expect(isExpiringSemaforo('arancione')).toBe(true);
    expect(isExpiringSemaforo('rosso')).toBe(false);
    expect(isExpiringSemaforo('verde')).toBe(false);
  });

  it('isExpiredOrExpiringSemaforo copre entrambi i casi', () => {
    expect(isExpiredOrExpiringSemaforo('rosso')).toBe(true);
    expect(isExpiredOrExpiringSemaforo('giallo')).toBe(true);
    expect(isExpiredOrExpiringSemaforo('verde')).toBe(false);
    expect(isExpiredOrExpiringSemaforo('grigio')).toBe(false);
  });

  describe('getWelderQualificationWarning', () => {
    it('null se la qualifica non esiste', () => {
      expect(getWelderQualificationWarning(null)).toBeNull();
    });

    it('null se la qualifica e\u2019 valida (verde)', () => {
      expect(getWelderQualificationWarning({ semaforo: 'verde', person_name: 'Mario Rossi' })).toBeNull();
    });

    it('danger se scaduta (rosso)', () => {
      const w = getWelderQualificationWarning({ semaforo: 'rosso', person_name: 'Mario Rossi', expiry_date: '2026-01-01' });
      expect(w.level).toBe('danger');
      expect(w.text).toContain('Mario Rossi');
      expect(w.text).toContain('scaduta');
    });

    it('warning se in scadenza (arancione/giallo)', () => {
      const w1 = getWelderQualificationWarning({ semaforo: 'arancione', person_name: 'Luigi Bianchi' });
      expect(w1.level).toBe('warning');
      expect(w1.text).toContain('in scadenza');

      const w2 = getWelderQualificationWarning({ semaforo: 'giallo' });
      expect(w2.level).toBe('warning');
      expect(w2.text).toContain('saldatore selezionato');
    });
  });
});
