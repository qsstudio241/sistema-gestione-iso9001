import { describe, expect, it } from 'vitest';
import {
  DOC_ROLE_OPTIONS,
  buildBatchRoleSuggestions,
  groupAttachmentsByCatalogRole,
  honestSuggestLabel,
  isAnalyzableCatalogAttachment,
  isCatalogedDocRole,
  listAnalyzableCatalogAttachmentIds,
  roleLabel,
  suggestCommercialDocRoleFromName,
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

describe('caseDocCatalog (ING-1 batch suggest)', () => {
  it('suggestCommercialDocRoleFromName: ruoli da path/nome', () => {
    expect(suggestCommercialDocRoleFromName('Cliente/Capitolati/CAP_rev2.pdf').role).toBe(
      'capitolato',
    );
    expect(suggestCommercialDocRoleFromName('ordine_PO-123.pdf').role).toBe('order');
    expect(suggestCommercialDocRoleFromName('RFQ_LMCO.pdf').role).toBe('rfq');
    expect(suggestCommercialDocRoleFromName('Offerta_commerciale.pdf').role).toBe('quote');
    expect(suggestCommercialDocRoleFromName('Tavola_A1.dwg').role).toBe('drawing');
    expect(suggestCommercialDocRoleFromName('scan_sconosciuto.pdf').role).toBe(null);
  });

  it('suggestCommercialDocRoleFromName: mime immagine → drawing', () => {
    expect(
      suggestCommercialDocRoleFromName('foto_pezzo.bin', { mimeType: 'image/jpeg' }).role,
    ).toBe('drawing');
  });

  it('buildBatchRoleSuggestions: solo non catalogati, riordino, HITL selected', () => {
    const rows = buildBatchRoleSuggestions([
      { attachment_id: 10, commercial_doc_role: 'drawing', file_name: 'già_ok.png' },
      { attachment_id: 11, commercial_doc_role: null, file_name: 'Disegno_assieme.png' },
      { attachment_id: 12, commercial_doc_role: null, file_name: 'misc.pdf' },
      { attachment_id: 13, commercial_doc_role: null, file_name: 'Capitolato_cliente.pdf' },
    ]);
    expect(rows.map((r) => r.attachmentId)).toEqual([13, 11, 12]);
    expect(rows[0].suggestedRole).toBe('capitolato');
    expect(rows[0].selected).toBe(true);
    expect(rows[0].draftRole).toBe('capitolato');
    expect(rows[1].suggestedRole).toBe('drawing');
    expect(rows[2].suggestedRole).toBe(null);
    expect(rows[2].selected).toBe(false);
    expect(honestSuggestLabel(null)).toMatch(/scegli tu/i);
  });

  it('buildBatchRoleSuggestions: onlyUncataloged false include già catalogati', () => {
    const rows = buildBatchRoleSuggestions(
      [{ attachment_id: 1, commercial_doc_role: 'order', file_name: 'x.pdf' }],
      { onlyUncataloged: false },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].currentRole).toBe('order');
  });
});
