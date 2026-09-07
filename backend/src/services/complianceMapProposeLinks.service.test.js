'use strict';

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('./aiProviderAdapter', () => ({
  chat: jest.fn(),
  getActiveProvider: jest.fn(() => 'gemini'),
}));
jest.mock('./gapAnalysis.service', () => ({
  assertCompanyInOrganization: jest.fn(),
}));
jest.mock('./complianceMap.service', () => ({
  getMapDetail: jest.fn(),
  COVERAGE_VALUES: Object.freeze(['unknown', 'covered', 'partial', 'missing', 'na']),
}));
jest.mock('./normBroker.service', () => ({
  resolveClauseText: jest.fn(),
  searchClauses: jest.fn(),
  listAvailableStandards: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const { query } = require('../config/database');
const { chat, getActiveProvider } = require('./aiProviderAdapter');
const { assertCompanyInOrganization } = require('./gapAnalysis.service');
const { getMapDetail } = require('./complianceMap.service');
const normBroker = require('./normBroker.service');
const {
  proposeLinksForMap,
  parseProposedLinks,
  normalizeProposedLink,
} = require('./complianceMapProposeLinks.service');

describe('complianceMapProposeLinks.service — CM-3', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getActiveProvider.mockReturnValue('gemini');
    normBroker.listAvailableStandards.mockResolvedValue([
      { standard_code: 'ISO_9001_2015', clause_count: 10 },
    ]);
    normBroker.resolveClauseText.mockResolvedValue({
      hit: { text: 'testo', source: 'local_db' },
      textAvailable: true,
      absentMessage: null,
      code: null,
    });
    normBroker.searchClauses.mockResolvedValue([]);
  });

  it('parseProposedLinks: ignora item_id fuori set e coverage invalida → unknown', () => {
    const allowed = new Set([1, 2]);
    const links = parseProposedLinks(
      JSON.stringify({
        links: [
          { item_id: 1, standard_code: 'ISO_9001_2015', clause_ref: '8.2.1', coverage: 'accepted' },
          { item_id: 99, standard_code: 'ISO_9001_2015', clause_ref: '4.1', coverage: 'covered' },
          { item_id: 2, standard_code: 'ISO_9001_2015', clause_ref: '8.5', coverage: 'partial' },
        ],
      }),
      allowed
    );
    expect(links).toHaveLength(2);
    expect(links[0].coverage).toBe('unknown');
    expect(links[0].item_id).toBe(1);
    expect(links[1].coverage).toBe('partial');
  });

  it('normalizeProposedLink: null se nessun campo utile', () => {
    expect(normalizeProposedLink({ item_id: 1, coverage: 'unknown' }, new Set([1]))).toBeNull();
  });

  it('proposeLinks: null se company fuori org', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce(null);
    const r = await proposeLinksForMap(1001, 99, 5, {}, 1);
    expect(r).toBeNull();
    expect(getMapDetail).not.toHaveBeenCalled();
  });

  it('proposeLinks: notFound se mappa assente', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    getMapDetail.mockResolvedValueOnce({ notFound: true });
    const r = await proposeLinksForMap(1001, 10, 5, {}, 1);
    expect(r.notFound).toBe(true);
  });

  it('proposeLinks: conflict su mappa approved', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    getMapDetail.mockResolvedValueOnce({
      map: { id: 5, status: 'approved', title: 'X' },
      items: [{ id: 1, hitl_status: 'proposed', req_text: 'req' }],
    });
    const r = await proposeLinksForMap(1001, 10, 5, {}, 1);
    expect(r.conflict).toMatch(/approved/);
  });

  it('proposeLinks: validation se nessun item proposed', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    getMapDetail.mockResolvedValueOnce({
      map: { id: 5, status: 'draft', title: 'X' },
      items: [{ id: 1, hitl_status: 'accepted', req_text: 'req' }],
    });
    const r = await proposeLinksForMap(1001, 10, 5, {}, 1);
    expect(r.validationError).toMatch(/proposed/);
  });

  it('proposeLinks: Gemini → update solo proposed, mai accepted; NormBroker + event', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    getMapDetail.mockResolvedValueOnce({
      map: { id: 5, status: 'draft', title: 'Mappa demo', source_label: 'caso' },
      items: [
        {
          id: 11,
          hitl_status: 'proposed',
          req_key: 'iso',
          req_text: 'Sistema qualità ISO 9001',
        },
        {
          id: 12,
          hitl_status: 'accepted',
          req_key: 'skip',
          req_text: 'già accettato',
        },
      ],
    });
    chat.mockResolvedValueOnce({
      content: JSON.stringify({
        links: [
          {
            item_id: 11,
            standard_code: 'ISO_9001_2015',
            clause_ref: '8.2.1',
            coverage: 'partial',
            gap_note: 'manca procedura riesame',
          },
          {
            item_id: 12,
            standard_code: 'ISO_9001_2015',
            clause_ref: '4.1',
            coverage: 'covered',
          },
        ],
      }),
    });

    query.mockImplementation(async (sql) => {
      if (/FROM norm_requirements/.test(sql)) {
        return { recordset: [{ id: 501 }] };
      }
      if (/UPDATE compliance_map_items/.test(sql)) {
        return {
          recordset: [
            {
              id: 11,
              hitl_status: 'proposed',
              proposed_by: 'gemini',
              standard_code: 'ISO_9001_2015',
              clause_ref: '8.2.1',
              coverage: 'partial',
              norm_requirement_id: 501,
            },
          ],
        };
      }
      return { recordset: [] };
    });

    const r = await proposeLinksForMap(1001, 10, 5, {}, 7);
    expect(r.meta.hitl).toBe('proposed_only');
    expect(r.meta.proposed_by).toBe('gemini');
    expect(r.items).toHaveLength(1);
    expect(r.items[0].hitl_status).toBe('proposed');
    expect(normBroker.resolveClauseText).toHaveBeenCalledWith('ISO_9001_2015', '8.2.1', {
      organizationId: 1001,
    });

    const updateCall = query.mock.calls.find(([sql]) => /UPDATE compliance_map_items/.test(sql));
    expect(updateCall).toBeTruthy();
    expect(updateCall[0]).toMatch(/hitl_status = N'proposed'/);
    expect(updateCall[0]).toMatch(/hitl_status = N'proposed'/);
    expect(updateCall[1].proposedBy).toBe('gemini');
    expect(updateCall[1].itemId).toBe(11);

    const eventCalls = query.mock.calls.filter(([sql]) => /links_proposed/.test(sql));
    expect(eventCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('proposeLinks: senza AI → fallback searchClauses compiler proposed', async () => {
    getActiveProvider.mockReturnValue(null);
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    getMapDetail.mockResolvedValueOnce({
      map: { id: 5, status: 'in_review', title: 'M' },
      items: [{ id: 21, hitl_status: 'proposed', req_text: 'requisito saldatura ISO 3834' }],
    });
    normBroker.searchClauses.mockResolvedValueOnce([
      { standard_code: 'ISO_3834_2', clause_ref: '5', clause_title: 'Requisiti' },
    ]);
    normBroker.resolveClauseText.mockResolvedValueOnce({
      hit: null,
      textAvailable: false,
      absentMessage: 'Testo assente',
      code: 'NORM_TEXT_ABSENT',
    });

    query.mockImplementation(async (sql) => {
      if (/FROM norm_requirements/.test(sql)) return { recordset: [] };
      if (/UPDATE compliance_map_items/.test(sql)) {
        return {
          recordset: [
            {
              id: 21,
              hitl_status: 'proposed',
              proposed_by: 'compiler',
              standard_code: 'ISO_3834_2',
              clause_ref: '5',
              coverage: 'unknown',
            },
          ],
        };
      }
      return { recordset: [] };
    });

    const r = await proposeLinksForMap(1001, 10, 5, {}, 1);
    expect(r.meta.proposed_by).toBe('compiler');
    expect(r.meta.hitl).toBe('proposed_only');
    expect(r.items[0].hitl_status).toBe('proposed');
    expect(chat).not.toHaveBeenCalled();
    expect(normBroker.searchClauses).toHaveBeenCalled();
  });
});
