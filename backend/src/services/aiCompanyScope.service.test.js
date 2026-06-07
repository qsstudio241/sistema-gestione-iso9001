jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const { query } = require('../config/database');
const { resolveAiCompanyScope } = require('./aiCompanyScope.service');

describe('aiCompanyScope.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cliente azienda: forza la propria azienda se companyId assente', async () => {
    const user = {
      user_id: 1,
      company_access: [{ company_id: 45, permission: 'read' }],
    };
    const r = await resolveAiCompanyScope(user, null);
    expect(r.denied).toBeNull();
    expect(r.companyId).toBe(45);
  });

  it('cliente azienda: ignora companyId di altra azienda e forza la propria (no 403)', async () => {
    const user = {
      user_id: 1,
      company_access: [{ company_id: 45, permission: 'read' }],
    };
    const r = await resolveAiCompanyScope(user, 99);
    expect(r.denied).toBeNull();
    expect(r.companyId).toBe(45);
  });

  it('cliente azienda multi-accesso: blocca sull anagrafica primaria (company_id piu basso), no 403', async () => {
    const user = {
      user_id: 1,
      company_access: [
        { company_id: 45, permission: 'read' },
        { company_id: 46, permission: 'read' },
      ],
    };
    // anche passando una seconda azienda consentita, resta bloccato sulla primaria
    const r = await resolveAiCompanyScope(user, 46);
    expect(r.denied).toBeNull();
    expect(r.companyId).toBe(45);
  });

  it('cliente azienda multi-accesso: nessun companyId -> primaria, no 403', async () => {
    const user = {
      user_id: 1,
      company_access: [
        { company_id: 45, permission: 'read' },
        { company_id: 46, permission: 'read' },
      ],
    };
    const r = await resolveAiCompanyScope(user, null);
    expect(r.denied).toBeNull();
    expect(r.companyId).toBe(45);
  });

  it('studio: overview se companyId assente', async () => {
    const user = { user_id: 2, auditor_org_id: 3, company_access: [] };
    const r = await resolveAiCompanyScope(user, null);
    expect(r.denied).toBeNull();
    expect(r.companyId).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('studio: valida company nel auditor_org', async () => {
    query.mockResolvedValue({ recordset: [{ id: 8 }] });
    const user = { user_id: 2, auditor_org_id: 3, company_access: [] };
    const r = await resolveAiCompanyScope(user, 8);
    expect(r.denied).toBeNull();
    expect(r.companyId).toBe(8);
  });

  it('studio: 403 se azienda fuori ambito', async () => {
    query.mockResolvedValue({ recordset: [] });
    const user = { user_id: 2, auditor_org_id: 3, company_access: [] };
    const r = await resolveAiCompanyScope(user, 8);
    expect(r.denied?.status).toBe(403);
  });
});
