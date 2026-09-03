/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const { query } = require('../config/database');
const svc = require('./commercialChecklistAttachment.service');

afterEach(() => jest.clearAllMocks());

describe('commercialChecklistAttachment.service', () => {
  it('parsePositiveInt', () => {
    expect(svc.parsePositiveInt('12')).toBe(12);
    expect(svc.parsePositiveInt(0)).toBe(null);
    expect(svc.parsePositiveInt('x')).toBe(null);
  });

  it('groupLinksByItemId', () => {
    const map = svc.groupLinksByItemId([
      { checklist_item_id: 1, attachment_id: 10 },
      { checklist_item_id: 1, attachment_id: 11 },
      { checklist_item_id: 2, attachment_id: 20 },
    ]);
    expect(map.get(1)).toHaveLength(2);
    expect(map.get(2)).toHaveLength(1);
  });

  it('listMissingRequiredAttachmentRefs', async () => {
    query.mockResolvedValueOnce({ recordset: [{ item_ref: 'P3' }, { item_ref: 'P7' }] });
    const refs = await svc.listMissingRequiredAttachmentRefs(9, 'preliminary');
    expect(refs).toEqual(['P3', 'P7']);
    expect(query).toHaveBeenCalled();
  });

  it('linkAttachment — allegato non del caso', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [{ id: 5, case_id: 1, item_ref: 'P3', phase: 'preliminary', attachment_required: 1 }],
      })
      .mockResolvedValueOnce({ recordset: [] });
    const result = await svc.linkAttachment({
      caseId: 1,
      organizationId: 1001,
      itemId: 5,
      attachmentId: 99,
      userId: 7,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('linkAttachment — ok nuovo link', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [{ id: 5, case_id: 1, item_ref: 'P3', phase: 'preliminary', attachment_required: 1 }],
      })
      .mockResolvedValueOnce({
        recordset: [
          {
            attachment_id: 44,
            file_name: 'disegno.pdf',
            commercial_doc_role: 'drawing',
            attachment_uuid: 'u-1',
          },
        ],
      })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 100,
            checklist_item_id: 5,
            attachment_id: 44,
            created_at: '2026-09-03',
          },
        ],
      });
    const result = await svc.linkAttachment({
      caseId: 1,
      organizationId: 1001,
      itemId: 5,
      attachmentId: 44,
      userId: 7,
    });
    expect(result.ok).toBe(true);
    expect(result.already).toBe(false);
    expect(result.link.file_name).toBe('disegno.pdf');
  });
});
