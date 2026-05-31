import { describe, it, expect } from 'vitest';
import { getCitationPath, buildSourcesFootnote, MODULE_ROUTES } from '../utils/aiCitations';

describe('aiCitations', () => {
  it('maps entity types to SGQ routes', () => {
    expect(getCitationPath({ entityType: 'non_conformity', entityId: '42' })).toBe('/nc?select=42');
    expect(getCitationPath({ entityType: 'audit_conclusion', entityId: 'uuid-1' })).toBe('/audit');
    expect(getCitationPath({ entityType: 'complaint', entityId: '7' })).toBe('/reclami');
    expect(getCitationPath({ entityType: 'document', entityId: '99' })).toBe('/documents?tab=tree&select=99');
    expect(getCitationPath({ entityType: 'norm_content', entityId: '12' })).toBe('/documents?tab=tree&select=12');
    expect(getCitationPath({ entityType: 'unknown', entityId: '1' })).toBeNull();
    expect(getCitationPath({ entityType: 'non_conformity', entityId: '' })).toBe('/nc');
    expect(getCitationPath({ entityType: 'complaint', entityId: '' })).toBe('/reclami');
    expect(getCitationPath({ entityType: 'document', entityId: 'abc' })).toBe('/documents');
  });

  it('buildSourcesFootnote distinguishes sources vs empty', () => {
    expect(buildSourcesFootnote(3, 5)).toContain('Basato su 3 record del SGQ');
    expect(buildSourcesFootnote(3, 5)).toContain('5 estratti');
    expect(buildSourcesFootnote(0, 0)).toContain('senza fonti verificabili');
  });

  it('MODULE_ROUTES covers indexer entity types used in chat', () => {
    const expected = [
      'audit_conclusion',
      'non_conformity',
      'nc_action',
      'complaint',
      'qualification',
      'risk',
      'document',
      'norm_content',
    ];
    for (const et of expected) {
      expect(MODULE_ROUTES[et]).toBeTruthy();
    }
  });
});
