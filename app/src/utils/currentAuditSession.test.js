/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  rememberCurrentAuditId,
  forgetCurrentAuditId,
  pickRestoredAuditId,
  resolveAuditId,
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

  it('dopo il refresh ritrova l audit anche se il server cambia il maiuscolo', () => {
    rememberCurrentAuditId('134d6814-d2e9-4c89-b4cd-57d4f03a691e');
    const id = pickRestoredAuditId([
      { metadata: { id: '134D6814-D2E9-4C89-B4CD-57D4F03A691E' } },
    ]);
    expect(id).toBe('134D6814-D2E9-4C89-B4CD-57D4F03A691E');
    expect(resolveAuditId(
      [{ metadata: { id: '134D6814-D2E9-4C89-B4CD-57D4F03A691E' } }],
      '134d6814-d2e9-4c89-b4cd-57d4f03a691e',
    )).toBe('134D6814-D2E9-4C89-B4CD-57D4F03A691E');
  });
});
