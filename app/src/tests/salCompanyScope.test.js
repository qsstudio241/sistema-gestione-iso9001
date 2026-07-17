import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SAL_COMPANY_SCOPE_KEY,
  resolveInitialSalCompanyScope,
  readStoredSalCompanyScope,
  persistSalCompanyScope,
} from '../utils/salCompanyScope';

describe('salCompanyScope', () => {
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

  it('resolveInitialSalCompanyScope preferisce URL', () => {
    localStorage.setItem(SAL_COMPANY_SCOPE_KEY, '99');
    expect(resolveInitialSalCompanyScope(12)).toBe('12');
  });

  it('resolveInitialSalCompanyScope legge localStorage se URL assente', () => {
    localStorage.setItem(SAL_COMPANY_SCOPE_KEY, '42');
    expect(resolveInitialSalCompanyScope(null)).toBe('42');
  });

  it('persistSalCompanyScope salva e rimuove', () => {
    persistSalCompanyScope('5');
    expect(readStoredSalCompanyScope()).toBe('5');
    persistSalCompanyScope('');
    expect(readStoredSalCompanyScope()).toBe('');
    expect(localStorage.getItem(SAL_COMPANY_SCOPE_KEY)).toBeNull();
  });
});
