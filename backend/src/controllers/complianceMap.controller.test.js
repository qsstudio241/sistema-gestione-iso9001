'use strict';

jest.mock('../services/complianceMap.service', () => ({
  listMaps: jest.fn(),
  getMapDetail: jest.fn(),
  createMap: jest.fn(),
  addItem: jest.fn(),
  updateItemHitl: jest.fn(),
}));

jest.mock('../services/companyAccess.service', () => ({
  assertCompanyRead: jest.fn(),
  assertMutatingAllowed: jest.fn(),
  sendAccessDenied: jest.fn((res, denied) => {
    res.status(denied?.status || 403).json({
      error: denied?.message || 'Access denied',
      code: denied?.code || 'ACCESS_DENIED',
    });
  }),
}));

jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const svc = require('../services/complianceMap.service');
const { assertCompanyRead, assertMutatingAllowed } = require('../services/companyAccess.service');
const ctrl = require('./complianceMap.controller');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('complianceMap.controller — access scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('list: 403 se assertCompanyRead nega (cross-tenant)', async () => {
    assertCompanyRead.mockResolvedValueOnce({ status: 403, code: 'ACCESS_DENIED', message: 'no' });
    const req = {
      params: { companyId: '10' },
      user: { organization_id: 1001, user_id: 1 },
    };
    const res = mockRes();
    await ctrl.listComplianceMaps(req, res);
    expect(svc.listMaps).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('list: passa organization_id JWT + companyId', async () => {
    assertCompanyRead.mockResolvedValueOnce(null);
    svc.listMaps.mockResolvedValueOnce({ companyId: 10, maps: [] });
    const req = {
      params: { companyId: '10' },
      user: { organization_id: 1001, user_id: 1 },
    };
    const res = mockRes();
    await ctrl.listComplianceMaps(req, res);
    expect(svc.listMaps).toHaveBeenCalledWith(1001, 10);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { companyId: 10, maps: [] },
    });
  });

  it('get: 404 mappa altra company', async () => {
    assertCompanyRead.mockResolvedValueOnce(null);
    svc.getMapDetail.mockResolvedValueOnce({ notFound: true });
    const req = {
      params: { companyId: '10', mapId: '99' },
      user: { organization_id: 1001, user_id: 1 },
    };
    const res = mockRes();
    await ctrl.getComplianceMap(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('create: richiede write gate + 201', async () => {
    assertMutatingAllowed.mockResolvedValueOnce(null);
    svc.createMap.mockResolvedValueOnce({
      companyId: 10,
      map: { id: 1, title: 'T', status: 'draft' },
    });
    const req = {
      params: { companyId: '10' },
      body: { title: 'T' },
      user: { organization_id: 1001, user_id: 5 },
    };
    const res = mockRes();
    await ctrl.createComplianceMap(req, res);
    expect(svc.createMap).toHaveBeenCalledWith(1001, 10, { title: 'T' }, 5);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('hitl: 403 write negata', async () => {
    assertMutatingAllowed.mockResolvedValueOnce({
      status: 403,
      code: 'ACCESS_DENIED',
      message: 'no write',
    });
    const req = {
      params: { companyId: '10', mapId: '1', itemId: '2' },
      body: { hitl_status: 'accepted' },
      user: { organization_id: 1001, user_id: 5 },
    };
    const res = mockRes();
    await ctrl.patchComplianceMapItemHitl(req, res);
    expect(svc.updateItemHitl).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('hitl: happy path', async () => {
    assertMutatingAllowed.mockResolvedValueOnce(null);
    svc.updateItemHitl.mockResolvedValueOnce({
      companyId: 10,
      item: { id: 2, hitl_status: 'accepted' },
    });
    const req = {
      params: { companyId: '10', mapId: '1', itemId: '2' },
      body: { hitl_status: 'accepted' },
      user: { organization_id: 1001, user_id: 5 },
    };
    const res = mockRes();
    await ctrl.patchComplianceMapItemHitl(req, res);
    expect(svc.updateItemHitl).toHaveBeenCalledWith(
      1001,
      10,
      '1',
      '2',
      { hitl_status: 'accepted' },
      5
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { companyId: 10, item: { id: 2, hitl_status: 'accepted' } },
    });
  });
});
