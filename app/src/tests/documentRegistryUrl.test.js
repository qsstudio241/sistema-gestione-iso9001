import { describe, it, expect } from 'vitest';
import {
  parseDocumentRegistrySearch,
  buildDocumentRegistryPath,
  buildDocumentDeepLink,
  VALID_DOC_REGISTRY_TABS,
} from '../utils/documentRegistryUrl';

describe('documentRegistryUrl', () => {
  it('parseDocumentRegistrySearch legge tab e select', () => {
    const parsed = parseDocumentRegistrySearch('?tab=tree&select=42');
    expect(parsed.tab).toBe('tree');
    expect(parsed.selectId).toBe(42);
  });

  it('ignora tab non validi', () => {
    expect(parseDocumentRegistrySearch('?tab=invalid').tab).toBeNull();
    expect(parseDocumentRegistrySearch('?select=5').selectId).toBe(5);
  });

  it('buildDocumentRegistryPath con select forza tab albero', () => {
    expect(buildDocumentRegistryPath({ selectId: 99 })).toBe('/documents?tab=tree&select=99');
    expect(buildDocumentRegistryPath({ tab: 'catalog' })).toBe('/documents?tab=catalog');
    expect(buildDocumentRegistryPath({ tab: 'priority' })).toBe('/documents');
  });

  it('buildDocumentDeepLink allinea citazioni e ricerca', () => {
    expect(buildDocumentDeepLink('77')).toBe('/documents?tab=tree&select=77');
    expect(buildDocumentDeepLink('x')).toBe('/documents');
  });

  it('VALID_DOC_REGISTRY_TABS copre le tre tab UI', () => {
    expect(VALID_DOC_REGISTRY_TABS).toEqual(['priority', 'catalog', 'tree']);
  });
});
