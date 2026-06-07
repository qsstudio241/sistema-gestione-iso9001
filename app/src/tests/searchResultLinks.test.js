import { describe, it, expect } from 'vitest';
import {
  getSearchResultPath,
  SEARCH_GROUP_LABELS,
  SEARCH_GROUP_ORDER,
  SEARCH_ENTITY_ROUTES,
} from '../utils/searchResultLinks';

describe('searchResultLinks', () => {
  it('maps unified search entity types to SGQ routes', () => {
    expect(getSearchResultPath({ entityType: 'non_conformity', id: 42 })).toBe('/nc?select=42');
    expect(getSearchResultPath({ entityType: 'document', id: 99 })).toBe('/documents?tab=tree&select=99');
    expect(getSearchResultPath({ entityType: 'audit', id: 7 })).toBe('/audit');
    expect(getSearchResultPath({ entityType: 'complaint', id: 3 })).toBe('/reclami');
    expect(getSearchResultPath({ entityType: 'risk', id: 1 })).toBe('/rischi');
    expect(getSearchResultPath({ entityType: 'qualification', id: 5 })).toBe('/qualifiche');
    expect(getSearchResultPath({ entityType: 'unknown', id: 1 })).toBeNull();
  });

  it('exposes group labels and order for UI rendering', () => {
    for (const type of SEARCH_GROUP_ORDER) {
      expect(SEARCH_GROUP_LABELS[type]).toBeTruthy();
      expect(SEARCH_ENTITY_ROUTES[type]).toBeTruthy();
    }
    expect(SEARCH_GROUP_ORDER).toContain('non_conformity');
    expect(SEARCH_GROUP_ORDER).toContain('document');
  });
});
