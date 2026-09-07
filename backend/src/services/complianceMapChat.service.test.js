'use strict';

/**
 * CM-5 — blocco prompt + citazioni + export (HITL confermati).
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('./gapAnalysis.service', () => ({
  assertCompanyInOrganization: jest.fn(),
}));

const { query } = require('../config/database');
const { assertCompanyInOrganization } = require('./gapAnalysis.service');
const {
  CONFIRMED_HITL,
  isConfirmedHitl,
  loadApprovedMapForChat,
  loadMapExport,
  formatComplianceMapPromptBlock,
  buildComplianceMapCitations,
  buildExportPayload,
  buildExportMarkdown,
} = require('./complianceMapChat.service');

describe('complianceMapChat.service — CM-5', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assertCompanyInOrganization.mockResolvedValue({ companyId: 11 });
  });

  it('CONFIRMED_HITL = accepted|edited only', () => {
    expect(CONFIRMED_HITL).toEqual(['accepted', 'edited']);
    expect(isConfirmedHitl('accepted')).toBe(true);
    expect(isConfirmedHitl('edited')).toBe(true);
    expect(isConfirmedHitl('proposed')).toBe(false);
    expect(isConfirmedHitl('rejected')).toBe(false);
  });

  it('formatComplianceMapPromptBlock vuoto senza mappa o senza confermati', () => {
    expect(formatComplianceMapPromptBlock(null)).toBe('');
    expect(formatComplianceMapPromptBlock({ map: null, items: [] })).toBe('');
    expect(
      formatComplianceMapPromptBlock({
        map: { id: 1, title: 'X', status: 'approved', map_version: 1 },
        items: [{ id: 9, hitl_status: 'proposed', req_key: 'R1' }],
      })
    ).toBe('');
  });

  it('formatComplianceMapPromptBlock include node_id e clausola, esclude proposed', () => {
    const block = formatComplianceMapPromptBlock({
      map: {
        id: 7,
        title: 'Capitolato v3',
        status: 'approved',
        map_version: 2,
        source_label: 'Ordine 123',
      },
      items: [
        {
          id: 101,
          req_key: 'REQ-A',
          req_text: 'Saldatura certificata ISO 3834',
          standard_code: 'ISO_3834',
          clause_ref: '5.2',
          coverage: 'covered',
          hitl_status: 'accepted',
        },
        {
          id: 102,
          req_key: 'REQ-B',
          req_text: 'Non deve apparire',
          hitl_status: 'proposed',
        },
        {
          id: 103,
          req_key: 'REQ-C',
          standard_code: 'ISO_9001',
          clause_ref: '8.2',
          coverage: 'partial',
          hitl_status: 'edited',
        },
      ],
    });
    expect(block).toContain('MAPPA CONFORMITÀ');
    expect(block).toContain('node_id=101');
    expect(block).toContain('clausola=ISO_3834 5.2');
    expect(block).toContain('node_id=103');
    expect(block).not.toContain('node_id=102');
    expect(block).not.toContain('Non deve apparire');
    expect(block).toContain('non NC live');
  });

  it('buildComplianceMapCitations solo confermati con entityType compliance_map_item', () => {
    const cites = buildComplianceMapCitations({
      map: { id: 7 },
      items: [
        {
          id: 101,
          req_key: 'REQ-A',
          standard_code: 'ISO_3834',
          clause_ref: '5.2',
          hitl_status: 'accepted',
        },
        { id: 102, req_key: 'X', hitl_status: 'rejected' },
      ],
    });
    expect(cites).toHaveLength(1);
    expect(cites[0]).toMatchObject({
      entityType: 'compliance_map_item',
      entityId: '101',
      mapId: '7',
      clauseRef: 'ISO_3834 5.2',
    });
    expect(cites[0].label).toContain('REQ-A');
  });

  it('loadApprovedMapForChat filtra approved + HITL confermati', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 7,
            title: 'Mappa',
            status: 'approved',
            map_version: 1,
            company_id: 11,
            organization_id: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        recordset: [
          { id: 1, hitl_status: 'accepted', req_key: 'A' },
          { id: 2, hitl_status: 'edited', req_key: 'B' },
        ],
      });

    const snap = await loadApprovedMapForChat(1, 11);
    expect(assertCompanyInOrganization).toHaveBeenCalledWith(1, 11);
    expect(snap.map.id).toBe(7);
    expect(snap.items).toHaveLength(2);
    const mapSql = query.mock.calls[0][0];
    expect(mapSql).toMatch(/status = N'approved'/i);
    const itemSql = query.mock.calls[1][0];
    expect(itemSql).toMatch(/hitl_status IN \(N'accepted', N'edited'\)/i);
  });

  it('loadMapExport notFound se mappa assente', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const res = await loadMapExport(1, 11, 99);
    expect(res.notFound).toBe(true);
  });

  it('buildExportPayload esclude proposed', () => {
    const payload = buildExportPayload({
      map: {
        id: 7,
        title: 'T',
        status: 'approved',
        company_id: 11,
        organization_id: 1,
        map_version: 1,
      },
      items: [
        { id: 1, req_key: 'A', hitl_status: 'accepted', clause_ref: '8.2' },
        { id: 2, req_key: 'B', hitl_status: 'proposed' },
      ],
    });
    expect(payload.itemCount).toBe(1);
    expect(payload.items[0].node_id).toBe(1);
    expect(payload.policy.hitl).toEqual(['accepted', 'edited']);
  });

  it('buildExportMarkdown contiene node_id', () => {
    const md = buildExportMarkdown({
      map: { id: 7, title: 'Capitolato', status: 'approved', map_version: 1 },
      items: [
        {
          id: 55,
          req_key: 'R1',
          req_text: 'Testo',
          standard_code: 'ISO_9001',
          clause_ref: '8.2',
          coverage: 'covered',
          hitl_status: 'accepted',
        },
      ],
    });
    expect(md).toContain('node_id=55');
    expect(md).toContain('ISO_9001 8.2');
  });
});
