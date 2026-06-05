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
});
