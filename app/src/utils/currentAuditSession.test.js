/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  rememberCurrentAuditId,
  forgetCurrentAuditId,
  pickRestoredAuditId,
} from './currentAuditSession';

describe('currentAuditSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('dopo il refresh ritrova l audit se è ancora in lista', () => {
    rememberCurrentAuditId('uuid-oma');
    const id = pickRestoredAuditId([
      { metadata: { id: 'altro' } },
      { metadata: { id: 'uuid-oma' } },
    ]);
    expect(id).toBe('uuid-oma');
  });

  it('non seleziona un id che la lista non ha più', () => {
    rememberCurrentAuditId('sparito');
    expect(pickRestoredAuditId([{ metadata: { id: 'uuid-oma' } }])).toBeNull();
  });

  it('la deselezione esplicita non riapre l audit', () => {
    rememberCurrentAuditId('uuid-oma');
    forgetCurrentAuditId();
    expect(pickRestoredAuditId([{ metadata: { id: 'uuid-oma' } }])).toBeNull();
  });
});
