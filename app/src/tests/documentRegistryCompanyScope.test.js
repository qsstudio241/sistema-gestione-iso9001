import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DOC_REGISTRY_COMPANY_SCOPE_KEY,
  resolveInitialRegistryCompanyScope,
  readStoredRegistryCompanyScope,
  persistRegistryCompanyScope,
} from '../utils/documentRegistryCompanyScope';

describe('documentRegistryCompanyScope', () => {
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

  it('resolveInitialRegistryCompanyScope preferisce URL', () => {
    localStorage.setItem(DOC_REGISTRY_COMPANY_SCOPE_KEY, '99');
    expect(resolveInitialRegistryCompanyScope(12)).toBe('12');
  });

  it('resolveInitialRegistryCompanyScope legge localStorage se URL assente', () => {
    localStorage.setItem(DOC_REGISTRY_COMPANY_SCOPE_KEY, '42');
    expect(resolveInitialRegistryCompanyScope(null)).toBe('42');
  });

  it('persistRegistryCompanyScope salva e rimuove', () => {
    persistRegistryCompanyScope('5');
    expect(readStoredRegistryCompanyScope()).toBe('5');
    persistRegistryCompanyScope('');
    expect(readStoredRegistryCompanyScope()).toBe('');
    expect(localStorage.getItem(DOC_REGISTRY_COMPANY_SCOPE_KEY)).toBeNull();
  });
});
