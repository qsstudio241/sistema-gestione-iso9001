/**
 * Vitest — helper puri ponte checklist ↔ allegati (PONTE-1)
 */
import { describe, expect, it } from 'vitest';
import {
  catalogRoleLabel,
  hasLinkedAttachments,
  isAttachmentRequiredFlag,
  listMissingRequiredAttachmentRefs,
  missingRequiredAttachment,
  normalizeChecklistRow,
} from '../utils/contractReviewChecklistAttachments';

describe('contractReviewChecklistAttachments', () => {
  it('flag required default OFF', () => {
    expect(isAttachmentRequiredFlag(0)).toBe(false);
    expect(isAttachmentRequiredFlag(false)).toBe(false);
    expect(isAttachmentRequiredFlag(undefined)).toBe(false);
    expect(isAttachmentRequiredFlag(1)).toBe(true);
    expect(isAttachmentRequiredFlag(true)).toBe(true);
  });

  it('soft missing badge solo se required senza link', () => {
    expect(missingRequiredAttachment({ attachment_required: 1, linked_attachments: [] })).toBe(true);
    expect(
      missingRequiredAttachment({
        attachment_required: 1,
        linked_attachments: [{ attachment_id: 9 }],
      }),
    ).toBe(false);
    expect(missingRequiredAttachment({ attachment_required: 0, linked_attachments: [] })).toBe(false);
    expect(hasLinkedAttachments({ linked_attachments: [{ attachment_id: 1 }] })).toBe(true);
  });

  it('lista ref mancanti per soft export / UI', () => {
    const refs = listMissingRequiredAttachmentRefs([
      { item_ref: 'P1', attachment_required: 0, linked_attachments: [] },
      { item_ref: 'P3', attachment_required: 1, linked_attachments: [] },
      { item_ref: 'P4', attachment_required: 1, linked_attachments: [{ attachment_id: 2 }] },
    ]);
    expect(refs).toEqual(['P3']);
  });

  it('etichetta ruolo catalogo', () => {
    expect(catalogRoleLabel('drawing', [{ value: 'drawing', label: 'Disegno' }])).toBe('Disegno');
    expect(catalogRoleLabel('other')).toBe('other');
  });

  it('normalizeChecklistRow conserva attachment_required e linked_attachments', () => {
    const links = [{ attachment_id: 42, file_name: 'spec.pdf' }];
    const normalized = normalizeChecklistRow({
      id: 7,
      phase: 'offer',
      item_ref: 'P3',
      item_text: 'Capitolato',
      answer: 'yes',
      notes: 'ok',
      attachment_required: 1,
      linked_attachments: links,
      extra_ignored: true,
    });
    expect(normalized).toMatchObject({
      id: 7,
      phase: 'offer',
      item_ref: 'P3',
      item_text: 'Capitolato',
      answer: 'yes',
      notes: 'ok',
      attachment_required: 1,
      linked_attachments: links,
    });
    expect(normalized).not.toHaveProperty('extra_ignored');
    expect(missingRequiredAttachment(normalized)).toBe(false);
    expect(hasLinkedAttachments(normalized)).toBe(true);

    const missing = normalizeChecklistRow({
      id: 8,
      itemRef: 'P4',
      itemText: 'Disegno',
      attachmentRequired: true,
      linkedAttachments: [],
    });
    expect(missing.attachment_required).toBe(1);
    expect(missing.linked_attachments).toEqual([]);
    expect(missing.item_ref).toBe('P4');
    expect(missingRequiredAttachment(missing)).toBe(true);

    const off = normalizeChecklistRow({ id: 9, item_ref: 'P1' });
    expect(off.attachment_required).toBe(0);
    expect(off.linked_attachments).toEqual([]);
  });
});
