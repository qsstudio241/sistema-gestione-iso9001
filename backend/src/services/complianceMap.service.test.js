'use strict';

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('./gapAnalysis.service', () => ({
  assertCompanyInOrganization: jest.fn(),
}));

const { query } = require('../config/database');
const { assertCompanyInOrganization } = require('./gapAnalysis.service');
const {
  listMaps,
  getMapDetail,
  createMap,
  addItem,
  updateItemHitl,
} = require('./complianceMap.service');

describe('complianceMap.service — multi-tenant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('listMaps: null se company fuori org', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce(null);
    const r = await listMaps(1001, 99);
    expect(r).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('listMaps: WHERE organization_id + company_id', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    query.mockResolvedValueOnce({
      recordset: [{ id: 1, title: 'Capitolato v1', organization_id: 1001, company_id: 10 }],
    });
    const r = await listMaps(1001, 10);
    expect(r.maps).toHaveLength(1);
    const sql = String(query.mock.calls[0][0]);
    const params = query.mock.calls[0][1];
    expect(sql).toMatch(/organization_id\s*=\s*@organizationId/i);
    expect(sql).toMatch(/company_id\s*=\s*@companyId/i);
    expect(params).toEqual({ organizationId: 1001, companyId: 10 });
  });

  it('getMapDetail: 404 cross-company (header assente)', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    query.mockResolvedValueOnce({ recordset: [] }); // header
    const r = await getMapDetail(1001, 10, 5);
    expect(r.notFound).toBe(true);
    const params = query.mock.calls[0][1];
    expect(params.organizationId).toBe(1001);
    expect(params.companyId).toBe(10);
    expect(params.mapId).toBe(5);
  });

  it('createMap: scrive event map_created con actor', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    query
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 7,
            title: 'Ordine X',
            organization_id: 1001,
            company_id: 10,
            commercial_case_id: null,
            source_label: null,
            status: 'draft',
          },
        ],
      })
      .mockResolvedValueOnce({ recordset: [] }); // event

    const r = await createMap(1001, 10, { title: 'Ordine X' }, 42);
    expect(r.map.id).toBe(7);
    expect(query).toHaveBeenCalledTimes(2);
    const eventSql = String(query.mock.calls[1][0]);
    const eventParams = query.mock.calls[1][1];
    expect(eventSql).toMatch(/compliance_map_events/i);
    expect(eventParams.eventType).toBe('map_created');
    expect(eventParams.actorUserId).toBe(42);
    expect(eventParams.organizationId).toBe(1001);
  });

  it('createMap: org A non usa company di org B (assert null)', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce(null);
    const r = await createMap(1001, 55, { title: 'Hack' }, 1);
    expect(r).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('addItem: event item_created', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    query
      .mockResolvedValueOnce({
        recordset: [{ id: 7, status: 'draft', organization_id: 1001, company_id: 10 }],
      }) // header
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 3,
            map_id: 7,
            req_key: 'r1',
            hitl_status: 'proposed',
            coverage: 'unknown',
            proposed_by: 'user',
          },
        ],
      }) // insert item
      .mockResolvedValueOnce({ recordset: [] }) // touch map
      .mockResolvedValueOnce({ recordset: [] }); // event

    const r = await addItem(1001, 10, 7, { req_text: 'Requisito prova', req_key: 'r1' }, 9);
    expect(r.item.id).toBe(3);
    const eventParams = query.mock.calls[3][1];
    expect(eventParams.eventType).toBe('item_created');
    expect(eventParams.itemId).toBe(3);
    expect(eventParams.actorUserId).toBe(9);
  });

  it('updateItemHitl: scrive hitl_accepted e scope org+company', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 10 });
    query
      .mockResolvedValueOnce({
        recordset: [{ id: 7, status: 'draft', organization_id: 1001, company_id: 10 }],
      }) // header
      .mockResolvedValueOnce({
        recordset: [{ id: 3, map_id: 7, hitl_status: 'proposed', coverage: 'unknown' }],
      }) // existing item
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 3,
            hitl_status: 'accepted',
            coverage: 'covered',
            norm_requirement_id: 12,
          },
        ],
      }) // update
      .mockResolvedValueOnce({ recordset: [] }) // touch map
      .mockResolvedValueOnce({ recordset: [] }); // event

    const r = await updateItemHitl(
      1001,
      10,
      7,
      3,
      { hitl_status: 'accepted', coverage: 'covered', norm_requirement_id: 12 },
      99
    );
    expect(r.item.hitl_status).toBe('accepted');

    const existingParams = query.mock.calls[1][1];
    expect(existingParams).toMatchObject({
      organizationId: 1001,
      companyId: 10,
      mapId: 7,
      itemId: 3,
    });

    const eventParams = query.mock.calls[4][1];
    expect(eventParams.eventType).toBe('hitl_accepted');
    expect(eventParams.actorUserId).toBe(99);
  });

  it('updateItemHitl: company 1 ≠ company 2 stessa org (header miss)', async () => {
    assertCompanyInOrganization.mockResolvedValueOnce({ companyId: 20 });
    query.mockResolvedValueOnce({ recordset: [] });
    const r = await updateItemHitl(1001, 20, 7, 3, { hitl_status: 'accepted' }, 1);
    expect(r.notFound).toBe(true);
    expect(query.mock.calls[0][1].companyId).toBe(20);
  });
});
