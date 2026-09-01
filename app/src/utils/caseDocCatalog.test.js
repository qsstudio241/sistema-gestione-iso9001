import { describe, expect, it } from 'vitest';
import {
  DOC_ROLE_OPTIONS,
  groupAttachmentsByCatalogRole,
  isAnalyzableCatalogAttachment,
  isCatalogedDocRole,
  listAnalyzableCatalogAttachmentIds,
  roleLabel,
} from './caseDocCatalog';

describe('caseDocCatalog (VC-2)', () => {
  it('isCatalogedDocRole: whitelist + vuoto', () => {
    expect(isCatalogedDocRole('drawing')).toBe(true);
    expect(isCatalogedDocRole('ORDER')).toBe(true);
    expect(isCatalogedDocRole('')).toBe(false);
    expect(isCatalogedDocRole(null)).toBe(false);
    expect(isCatalogedDocRole('unknown')).toBe(false);
  });

  it('isAnalyzableCatalogAttachment: drawing e capitolato PDF', () => {
    expect(
      isAnalyzableCatalogAttachment({
        commercial_doc_role: 'drawing',
        mime_type: 'image/png',
      }),
    ).toBe(true);
    expect(
      isAnalyzableCatalogAttachment({
        commercial_doc_role: 'capitolato',
        mime_type: 'application/pdf',
      }),
    ).toBe(true);
    expect(
      isAnalyzableCatalogAttachment({
        commercial_doc_role: 'quote',
        mime_type: 'application/pdf',
      }),
    ).toBe(false);
    expect(
      isAnalyzableCatalogAttachment({
        commercial_doc_role: null,
        mime_type: 'application/pdf',
      }),
    ).toBe(false);
  });

  it('groupAttachmentsByCatalogRole: sezioni per ruolo + Da catalogare', () => {
    const groups = groupAttachmentsByCatalogRole([
      { attachment_id: 1, commercial_doc_role: 'drawing', file_name: 'a.png' },
      { attachment_id: 2, commercial_doc_role: null, file_name: 'b.pdf' },
      { attachment_id: 3, commercial_doc_role: 'drawing', file_name: 'c.png' },
      { attachment_id: 4, commercial_doc_role: 'order', file_name: 'd.pdf' },
    ]);
    expect(groups.map((g) => g.key)).toEqual(['order', 'drawing', '__uncataloged__']);
    expect(groups.find((g) => g.key === 'drawing').items).toHaveLength(2);
    expect(groups.find((g) => g.key === '__uncataloged__').label).toBe('Da catalogare');
  });

  it('listAnalyzableCatalogAttachmentIds', () => {
    const ids = listAnalyzableCatalogAttachmentIds([
      { attachment_id: 1, commercial_doc_role: 'drawing', mime_type: 'image/png' },
      { attachment_id: 2, commercial_doc_role: 'quote', mime_type: 'application/pdf' },
      { attachment_id: 3, commercial_doc_role: null, mime_type: 'application/pdf' },
      { attachment_id: 4, commercial_doc_role: 'order', mime_type: 'application/pdf' },
    ]);
    expect(ids).toEqual([1, 4]);
  });

  it('roleLabel e DOC_ROLE_OPTIONS allineati', () => {
    expect(DOC_ROLE_OPTIONS.length).toBeGreaterThanOrEqual(5);
    expect(roleLabel('capitolato')).toBe('Capitolato');
    expect(roleLabel(null)).toBe('Da catalogare');
  });
});
