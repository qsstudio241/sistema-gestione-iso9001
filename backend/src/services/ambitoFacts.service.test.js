jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const { query } = require('../config/database');
const { loadAmbitoFacts } = require('./ambitoFacts.service');

const user = { organization_id: 99, auditor_org_id: 10, user_id: 5 };

function mockFacts({ name = 'Mason', nc = 2, quals = 1, docs = 3 } = {}) {
  query
    .mockResolvedValueOnce({ recordset: [{ name }] })
    .mockResolvedValueOnce({ recordset: [{ nc_open: nc }] })
    .mockResolvedValueOnce({ recordset: [{ quals_expiring_30: quals }] })
    .mockResolvedValueOnce({ recordset: [{ docs_expiring_30: docs }] });
}

describe('ambitoFacts.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('companyId assente → ready false, nessuna query conteggi', async () => {
    const out = await loadAmbitoFacts(user, null);
    expect(out.ready).toBe(false);
    expect(out.reason).toBe('seleziona_azienda');
    expect(out.counts).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('isola i conteggi per company_id (A vs B)', async () => {
    mockFacts({ name: 'Mason', nc: 4, quals: 2, docs: 1 });
    const a = await loadAmbitoFacts(user, 11);
    expect(a.ready).toBe(true);
    expect(a.companyId).toBe(11);
    expect(a.companyName).toBe('Mason');
    expect(a.counts).toEqual({ ncOpen: 4, qualsExpiring30: 2, docsExpiring30: 1 });
    expect(query.mock.calls.some((c) => c[1].companyId === 11)).toBe(true);

    jest.clearAllMocks();
    mockFacts({ name: 'Camellini', nc: 0, quals: 9, docs: 0 });
    const b = await loadAmbitoFacts(user, 22);
    expect(b.companyId).toBe(22);
    expect(b.counts.qualsExpiring30).toBe(9);
    expect(b.counts.ncOpen).toBe(0);
    expect(query.mock.calls.some((c) => c[1].companyId === 22)).toBe(true);
    expect(query.mock.calls.every((c) => c[1].companyId !== 11)).toBe(true);
  });
});
