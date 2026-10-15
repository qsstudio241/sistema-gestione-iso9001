jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('./auditMaintenance.service', () => ({
  hardDeleteAudit: jest.fn().mockResolvedValue(true),
}));

const { query } = require('../config/database');
const { hardDeleteAudit } = require('./auditMaintenance.service');
const { hardDeleteCompany } = require('./companyMaintenance.service');

describe('companyMaintenance.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ritorna false se azienda non trovata', async () => {
    query.mockResolvedValueOnce({ recordset: [] });

    const ok = await hardDeleteCompany(99, 3);

    expect(ok).toBe(false);
    expect(hardDeleteAudit).not.toHaveBeenCalled();
  });

  it('elimina dipendenze prima della riga companies', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [{
          id: 8,
          name: 'AAA-NN',
          logo_url: null,
          organization_id: 1002,
        }],
      })
      .mockResolvedValueOnce({ recordset: [{ audit_id: 101 }] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValue({ recordset: [{ id: 8 }] });

    const ok = await hardDeleteCompany(8, 3);

    expect(ok).toBe(true);
    expect(hardDeleteAudit).toHaveBeenCalledWith(101, 1002);

    const sqlCalls = query.mock.calls.map(([sql]) => sql.replace(/\s+/g, ' ').trim());
    const auditIdx = sqlCalls.findIndex((sql) => sql.includes('SELECT audit_id FROM audits'));
    const companyIdx = sqlCalls.findIndex((sql) => sql.startsWith('DELETE FROM companies'));
    expect(auditIdx).toBeGreaterThanOrEqual(0);
    expect(companyIdx).toBeGreaterThan(auditIdx);
  });

  it('cancella i link WPS-WPQR dell\'azienda (scope tenant) prima delle WPS', async () => {
    query
      .mockResolvedValueOnce({ recordset: [{ id: 8, name: 'AAA-NN', logo_url: null, organization_id: 1002 }] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValue({ recordset: [{ id: 8 }] });

    await hardDeleteCompany(8, 3);

    const calls = query.mock.calls.map(([sql, params]) => [sql.replace(/\s+/g, ' ').trim(), params]);
    const linksIdx = calls.findIndex(([sql]) => sql.startsWith('DELETE FROM wps_wpqr_links'));
    const wpsIdx = calls.findIndex(([sql]) => sql.startsWith('DELETE FROM welding_procedures'));
    expect(linksIdx).toBeGreaterThanOrEqual(0);
    expect(wpsIdx).toBeGreaterThan(linksIdx);
    const [linkSql, linkParams] = calls[linksIdx];
    expect(linkSql).toContain('organization_id = @organization_id');
    expect(linkSql).toContain('company_id = @company_id');
    expect(linkParams).toEqual({ company_id: 8, organization_id: 1002 });
  });

  it('un errore sulla tabella link assente (migrazione 174 non applicata) non blocca la cancellazione', async () => {
    query
      .mockResolvedValueOnce({ recordset: [{ id: 8, name: 'AAA-NN', logo_url: null, organization_id: 1002 }] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockImplementation(async (sql) => {
        if (sql.includes('wps_wpqr_links')) throw new Error("Invalid object name 'wps_wpqr_links'");
        return { recordset: [{ id: 8 }] };
      });

    await expect(hardDeleteCompany(8, 3)).resolves.toBe(true);
  });
});
