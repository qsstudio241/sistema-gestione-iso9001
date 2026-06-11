import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  QUALIFICATIONS_COMPANY_SCOPE_KEY,
  resolveInitialQualificationsCompanyScope,
  readStoredQualificationsCompanyScope,
  persistQualificationsCompanyScope,
} from '../utils/qualificationsCompanyScope';

describe('qualificationsCompanyScope', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {},
      getItem(key) {
        return this.store[key] ?? null;
      },
      setItem(key, val) {
        this.store[key] = String(val);
      },
      removeItem(key) {
        delete this.store[key];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolveInitialQualificationsCompanyScope preferisce URL', () => {
    localStorage.setItem(QUALIFICATIONS_COMPANY_SCOPE_KEY, '99');
    expect(resolveInitialQualificationsCompanyScope(12)).toBe('12');
  });

  it('resolveInitialQualificationsCompanyScope legge localStorage se URL assente', () => {
    localStorage.setItem(QUALIFICATIONS_COMPANY_SCOPE_KEY, '42');
    expect(resolveInitialQualificationsCompanyScope(null)).toBe('42');
  });

  it('persistQualificationsCompanyScope salva e rimuove', () => {
    persistQualificationsCompanyScope('5');
    expect(readStoredQualificationsCompanyScope()).toBe('5');
    persistQualificationsCompanyScope('');
    expect(readStoredQualificationsCompanyScope()).toBe('');
    expect(localStorage.getItem(QUALIFICATIONS_COMPANY_SCOPE_KEY)).toBeNull();
  });
});
