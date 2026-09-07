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
  createMap: jest.fn(),
  addItem: jest.fn(),
  COVERAGE_VALUES: Object.freeze(['unknown', 'covered', 'partial', 'missing', 'na']),
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
const { createMap, addItem } = require('./complianceMap.service');
const {
  compileFromCommercialCase,
  parseProposedItems,
  seedFromExtracts,
} = require('./complianceMapCompile.service');

describe('complianceMapCompile.service — CM-2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getActiveProvider.mockReturnValue('gemini');
  });

  it('parseProposedItems: forza coverage ammessa e ignora hitl', () => {
    const items = parseProposedItems(
      JSON.stringify({
        items: [
          {
            req_key: 'r1',
            req_text: 'Certificazione ISO 9001 del fabbricante',
            coverage: 'accepted',
            hitl_status: 'accepted',
          },
          { req_key: 'r2', req_text: 'Consegna 30gg', coverage: 'partial' },
        ],
      })
    );
    expect(items).toHaveLength(2);
    expect(items[0].coverage).toBe('unknown');
    expect(items[0].hitl_status).toBeUndefined();
    expect(items[1].coverage).toBe('partial');
  });

  it('seedFromExtracts: un item per value_text', () => {
    const seeded = seedFromExtracts([
      { id: 1, field_key: 'delivery_date', value_text: '30 giorni', req_type: 'delivery' },
      { id: 2, field_key: null, value_text: '  ', req_type: 'note' },
    ]);
    expect(seeded).toHaveLength(1);
    expect(seeded[0].req_key).toBe('delivery_date');
    expect(seeded[0].req_text).toContain('30 giorni');
  });

  it('compile: null se company fuori org', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce(null);
    const r = await compileFromCommercialCase(1001, 99, { commercial_case_id: 1 }, 1);
    expect(r).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('compile: validation senza commercial_case_id', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    const r = await compileFromCommercialCase(1001, 10, {}, 1);
    expect(r.validationError).toMatch(/commercial_case_id/);
  });

  it('compile: notFound caso altra company', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    query.mockResolvedValueOnce({ recordset: [] }); // load case
    const r = await compileFromCommercialCase(1001, 10, { commercial_case_id: 7 }, 1);
    expect(r.notFound).toBe(true);
    expect(query.mock.calls[0][1]).toMatchObject({
      organizationId: 1001,
      companyId: 10,
      caseId: 7,
    });
  });

  it('compile: Gemini → items solo proposed, mai accepted', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    query
      .mockResolvedValueOnce({
        recordset: [{ id: 7, title: 'Ordine Alfa', external_ref: 'OA-1', organization_id: 1001, company_id: 10 }],
      }) // case
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 101,
            req_type: 'legal',
            field_key: 'iso9001',
            value_text: 'Fabbricante certificato ISO 9001',
            confidence: 0.9,
            review_status: 'extracted',
          },
        ],
      }) // extracts
      .mockResolvedValueOnce({ recordset: [] }); // compile_proposed event

    chat.mockResolvedValueOnce({
      content: JSON.stringify({
        items: [
          {
            req_key: 'legal-iso9001',
            req_text: 'Fabbricante certificato ISO 9001',
            standard_code: 'ISO_9001_2015',
            clause_ref: '8.4',
            coverage: 'unknown',
            hitl_status: 'accepted',
          },
        ],
      }),
    });

    createMap.mockResolvedValueOnce({
      companyId: 10,
      map: { id: 55, title: 'Compliance Map — Ordine Alfa', status: 'draft', commercial_case_id: 7 },
    });
    addItem.mockResolvedValueOnce({
      item: {
        id: 1,
        req_key: 'legal-iso9001',
        hitl_status: 'proposed',
        proposed_by: 'gemini',
      },
    });

    const r = await compileFromCommercialCase(
      1001,
      10,
      { commercial_case_id: 7 },
      42
    );

    expect(r.map.id).toBe(55);
    expect(r.items).toHaveLength(1);
    expect(r.meta.proposed_by).toBe('gemini');
    expect(r.meta.hitl).toBe('proposed_only');

    const addBody = addItem.mock.calls[0][3];
    expect(addBody.hitl_status).toBe('proposed');
    expect(addBody.proposed_by).toBe('gemini');
    expect(addBody.req_source).toBe('ai');
    expect(addBody.hitl_status).not.toBe('accepted');

    const eventParams = query.mock.calls[2][1];
    expect(eventParams.eventType || JSON.parse(eventParams.payloadJson).proposed_by).toBeTruthy();
    const sql = String(query.mock.calls[2][0]);
    expect(sql).toMatch(/compile_proposed/);
    expect(JSON.parse(eventParams.payloadJson).proposed_by).toBe('gemini');
  });

  it('compile: senza provider AI → seed compiler proposed', async () => {
    getActiveProvider.mockReturnValueOnce(null);
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    query
      .mockResolvedValueOnce({
        recordset: [{ id: 7, title: 'Caso', organization_id: 1001, company_id: 10 }],
      })
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 5,
            req_type: 'delivery',
            field_key: 'lead_time',
            value_text: '45 gg',
            confidence: 0.8,
            review_status: 'confirmed',
          },
        ],
      })
      .mockResolvedValueOnce({ recordset: [] });

    createMap.mockResolvedValueOnce({
      companyId: 10,
      map: { id: 9, title: 'T', status: 'draft' },
    });
    addItem.mockResolvedValueOnce({
      item: { id: 3, hitl_status: 'proposed', proposed_by: 'compiler' },
    });

    const r = await compileFromCommercialCase(1001, 10, { commercial_case_id: 7 }, 1);
    expect(chat).not.toHaveBeenCalled();
    expect(r.meta.proposed_by).toBe('compiler');
    expect(addItem.mock.calls[0][3]).toMatchObject({
      hitl_status: 'proposed',
      proposed_by: 'compiler',
      req_source: 'ingest',
    });
  });

  it('compile: isolamento org sul load extracts', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    query
      .mockResolvedValueOnce({
        recordset: [{ id: 7, title: 'X', organization_id: 1001, company_id: 10 }],
      })
      .mockResolvedValueOnce({ recordset: [] });

    const r = await compileFromCommercialCase(1001, 10, { commercial_case_id: 7 }, 1);
    expect(r.validationError).toMatch(/estratto/i);
    const extractParams = query.mock.calls[1][1];
    expect(extractParams.organizationId).toBe(1001);
    expect(extractParams.caseId).toBe(7);
    const sql = String(query.mock.calls[1][0]);
    expect(sql).toMatch(/c\.organization_id\s*=\s*@organizationId/i);
  });
});
