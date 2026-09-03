/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  catalogRoleLabel,
  hasLinkedAttachments,
  isAttachmentRequiredFlag,
  listMissingRequiredAttachmentRefs,
  missingRequiredAttachment,
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
});
