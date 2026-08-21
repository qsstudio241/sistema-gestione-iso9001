import { describe, it, expect } from 'vitest';
import {
  parseDocumentRegistrySearch,
  buildDocumentRegistryPath,
  buildDocumentDeepLink,
  buildDocumentTreeQuery,
  buildIncompleteQueuePath,
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

  it('buildDocumentRegistryPath include company_id su tutte le tab', () => {
    expect(buildDocumentRegistryPath({ tab: 'tree', companyId: 5 })).toBe(
      '/documents?tab=tree&company_id=5'
    );
    expect(buildDocumentRegistryPath({ selectId: 9, companyId: 3 })).toBe(
      '/documents?tab=tree&select=9&company_id=3'
    );
    expect(buildDocumentRegistryPath({ tab: 'catalog', companyId: 3 })).toBe(
      '/documents?tab=catalog&company_id=3'
    );
    expect(buildDocumentRegistryPath({ tab: 'priority', companyId: 7 })).toBe(
      '/documents?company_id=7'
    );
  });

  it('parse e build tengono incomplete=1 sulla coda catalogo', () => {
    expect(parseDocumentRegistrySearch('?tab=catalog&incomplete=1').incomplete).toBe(true);
    expect(parseDocumentRegistrySearch('?tab=catalog').incomplete).toBe(false);
    expect(buildDocumentRegistryPath({ incomplete: true })).toBe(
      '/documents?tab=catalog&incomplete=1'
    );
    expect(buildDocumentRegistryPath({ tab: 'catalog', incomplete: true, companyId: 4 })).toBe(
      '/documents?tab=catalog&company_id=4&incomplete=1'
    );
    expect(buildDocumentRegistryPath({ selectId: 9, incomplete: true })).toBe(
      '/documents?tab=tree&select=9'
    );
  });

  it('buildDocumentTreeQuery passa company_id all API albero', () => {
    expect(buildDocumentTreeQuery({ depth: 2 })).toBe('depth=2');
    expect(buildDocumentTreeQuery({ depth: 2, companyId: 7 })).toBe(
      'depth=2&company_id=7'
    );
  });

  it('buildIncompleteQueuePath aggiunge company_id solo se azienda cliente', () => {
    expect(buildIncompleteQueuePath({ companyId: 11 })).toBe(
      '/documents?tab=catalog&company_id=11&incomplete=1'
    );
    expect(buildIncompleteQueuePath({ companyId: '11' })).toBe(
      '/documents?tab=catalog&company_id=11&incomplete=1'
    );
    expect(buildIncompleteQueuePath({})).toBe('/documents?tab=catalog&incomplete=1');
    expect(buildIncompleteQueuePath({ companyId: null })).toBe(
      '/documents?tab=catalog&incomplete=1'
    );
    expect(buildIncompleteQueuePath({ companyId: '' })).toBe(
      '/documents?tab=catalog&incomplete=1'
    );
    expect(buildIncompleteQueuePath({ companyId: 'studio' })).toBe(
      '/documents?tab=catalog&incomplete=1'
    );
  });
});
