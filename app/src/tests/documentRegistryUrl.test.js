import { describe, it, expect } from 'vitest';
import {
  parseDocumentRegistrySearch,
  buildDocumentRegistryPath,
  buildDocumentDeepLink,
  buildDocumentTreeQuery,
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

  it('parseDocumentRegistrySearch legge company_id', () => {
    const parsed = parseDocumentRegistrySearch('?tab=tree&company_id=12');
    expect(parsed.companyId).toBe(12);
    expect(parsed.tab).toBe('tree');
  });

  it('buildDocumentRegistryPath include company_id sulla tab albero', () => {
    expect(buildDocumentRegistryPath({ tab: 'tree', companyId: 5 })).toBe(
      '/documents?tab=tree&company_id=5'
    );
    expect(buildDocumentRegistryPath({ selectId: 9, companyId: 3 })).toBe(
      '/documents?tab=tree&select=9&company_id=3'
    );
    expect(buildDocumentRegistryPath({ tab: 'catalog', companyId: 3 })).toBe(
      '/documents?tab=catalog'
    );
  });

  it('buildDocumentTreeQuery passa company_id all API albero', () => {
    expect(buildDocumentTreeQuery({ depth: 2 })).toBe('depth=2');
    expect(buildDocumentTreeQuery({ depth: 2, companyId: 7 })).toBe(
      'depth=2&company_id=7'
    );
  });
});
