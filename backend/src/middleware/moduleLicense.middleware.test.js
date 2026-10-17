/**
 * Test moduleLicense.middleware — bridge P0 ISO 3834 (saldatura implica cnd)
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../services/moduleLicense.service', () => {
  const actual = jest.requireActual('../services/moduleLicense.service');
  return {
    ...actual,
    getLicensedModuleKeysForOrg: jest.fn(),
    hasMaterialComplianceCapability: jest.fn(),
  };
});
jest.mock('../utils/logger', () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }));

const { getLicensedModuleKeysForOrg, hasMaterialComplianceCapability } = require('../services/moduleLicense.service');
const { requireLicensedModule, requireLicensedModuleAny, requireMaterialComplianceCapability } = require('./moduleLicense.middleware');

function buildReqRes(organizationId, role = 'user') {
  const req = { user: { organization_id: organizationId, role }, path: '/test' };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

afterEach(() => jest.clearAllMocks());

describe("moduleLicense.middleware — bridge saldatura -> cnd", () => {
  it("requireLicensedModule('cnd') consente l'accesso a un'org con solo 'saldatura'", async () => {
    getLicensedModuleKeysForOrg.mockResolvedValue(['audit', 'saldatura']);
    const { req, res, next } = buildReqRes(1004);

    await requireLicensedModule('cnd')(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("requireLicensedModule('cnd') nega l'accesso se l'org non ha ne' cnd ne' saldatura", async () => {
    getLicensedModuleKeysForOrg.mockResolvedValue(['audit', 'nc']);
    const { req, res, next } = buildReqRes(1004);

    await requireLicensedModule('cnd')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("requireLicensedModuleAny(['cnd','strumenti']) consente l'accesso con solo 'saldatura' (equipment CRUD)", async () => {
    getLicensedModuleKeysForOrg.mockResolvedValue(['audit', 'saldatura']);
    const { req, res, next } = buildReqRes(1004);

    await requireLicensedModuleAny(['cnd', 'strumenti'])(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('admin con elenco scritto senza il modulo riceve 403', async () => {
    getLicensedModuleKeysForOrg.mockResolvedValue(['audit', 'nc']);
    const { req, res, next } = buildReqRes(1004, 'admin');

    await requireLicensedModule('saldatura')(req, res, next);

    expect(getLicensedModuleKeysForOrg).toHaveBeenCalledWith(1004);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'MODULE_NOT_LICENSED',
      module: 'saldatura',
    }));
  });

  it('superadmin con elenco scritto senza il modulo riceve 403', async () => {
    getLicensedModuleKeysForOrg.mockResolvedValue(['audit', 'nc']);
    const { req, res, next } = buildReqRes(1004, 'superadmin');

    await requireLicensedModule('saldatura')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('admin passa se l\'elenco effettivo contiene il modulo (vuoto/NULL = tutti)', async () => {
    const { KNOWN_MODULE_KEYS } = jest.requireActual('../services/moduleLicense.service');
    getLicensedModuleKeysForOrg.mockResolvedValue([...KNOWN_MODULE_KEYS]);
    const { req, res, next } = buildReqRes(1005, 'admin');

    await requireLicensedModule('saldatura')(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireMaterialComplianceCapability (AND saldatura + ai_import)', () => {
  it('403 con code MODULE_NOT_LICENSED e module MATERIAL_COMPLIANCE', async () => {
    hasMaterialComplianceCapability.mockResolvedValue(false);
    const { req, res, next } = buildReqRes(1004);

    await requireMaterialComplianceCapability()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'MODULE_NOT_LICENSED',
      module: 'MATERIAL_COMPLIANCE',
    }));
  });

  it('next() se la capability è ON', async () => {
    hasMaterialComplianceCapability.mockResolvedValue(true);
    const { req, res, next } = buildReqRes(1004);
    await requireMaterialComplianceCapability()(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});
