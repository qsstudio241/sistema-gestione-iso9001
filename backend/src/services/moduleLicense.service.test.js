/**
 * Test moduleLicense.service — merge e append idempotente
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');
const svc = require('./moduleLicense.service');

afterEach(() => jest.clearAllMocks());

describe('moduleLicense.service', () => {
  it('mergeModuleKeys mantiene ordine canonico e audit', () => {
    expect(svc.mergeModuleKeys(['documents', 'audit'], ['ai_assist', 'audit'])).toEqual([
      'audit',
      'documents',
      'ai_assist',
    ]);
  });

  it('mergeModuleKeys ignora chiavi sconosciute', () => {
    expect(svc.mergeModuleKeys(['audit'], ['foo', 'nc'])).toEqual(['audit', 'nc']);
  });

  it('parseLicensedModulesColumn NULL restituisce null', () => {
    expect(svc.parseLicensedModulesColumn(null)).toBeNull();
    expect(svc.parseLicensedModulesColumn('')).toBeNull();
  });

  it('appendLicensedModulesForOrg no-op se licensed_modules NULL', async () => {
    query
      .mockResolvedValueOnce({ recordset: [{ licensed_modules: null }] })
      .mockResolvedValueOnce({ recordset: [{ licensed_modules: null }] });

    const result = await svc.appendLicensedModulesForOrg(1004, ['ai_assist']);
    expect(result).toEqual(expect.arrayContaining(['ai_assist', 'audit']));
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('appendLicensedModulesForOrg aggiunge moduli mancanti', async () => {
    const before = JSON.stringify(['audit', 'documents', 'nc']);
    query
      .mockResolvedValueOnce({ recordset: [{ licensed_modules: before }] })
      .mockResolvedValueOnce({ recordset: [] });

    const result = await svc.appendLicensedModulesForOrg(1004, ['ai_assist', 'ai_chat']);
    expect(result).toEqual(expect.arrayContaining(['ai_assist', 'ai_chat', 'audit', 'documents']));
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE organizations SET licensed_modules'),
      expect.objectContaining({ organization_id: 1004 })
    );
  });

  it('appendLicensedModulesForOrg idempotente se moduli già presenti', async () => {
    const before = JSON.stringify(['audit', 'ai_assist', 'ai_chat']);
    query.mockResolvedValueOnce({ recordset: [{ licensed_modules: before }] });

    const result = await svc.appendLicensedModulesForOrg(1004, ['ai_assist']);
    expect(result).toEqual(['audit', 'ai_assist', 'ai_chat']);
    expect(query).toHaveBeenCalledTimes(1);
  });

  describe('hasSalLegalConformityCapability (seam SAL_LEGAL_CONFORMITY)', () => {
    it('oggi il seam mappa su ai_norms', () => {
      expect(svc.SAL_LEGAL_CONFORMITY_MODULE_KEY).toBe('ai_norms');
    });

    it('admin/superadmin hanno sempre la capability senza query DB', async () => {
      expect(await svc.hasSalLegalConformityCapability(1004, 'admin')).toBe(true);
      expect(await svc.hasSalLegalConformityCapability(1004, 'SuperAdmin')).toBe(true);
      expect(query).not.toHaveBeenCalled();
    });

    it('org con ai_norms licenziato -> capability ON', async () => {
      query.mockResolvedValueOnce({ recordset: [{ licensed_modules: JSON.stringify(['audit', 'sal', 'ai_norms']) }] });
      expect(await svc.hasSalLegalConformityCapability(1004, 'user')).toBe(true);
    });

    it('org senza ai_norms -> capability OFF', async () => {
      query.mockResolvedValueOnce({ recordset: [{ licensed_modules: JSON.stringify(['audit', 'sal']) }] });
      expect(await svc.hasSalLegalConformityCapability(1004, 'user')).toBe(false);
    });
  });
});
