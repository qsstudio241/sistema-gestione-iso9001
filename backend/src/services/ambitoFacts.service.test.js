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
const {
  loadAmbitoFacts,
  formatAmbitoFactsPromptBlock,
} = require('./ambitoFacts.service');

const user = { organization_id: 99, auditor_org_id: 10, user_id: 5 };

function mockCompanyFacts({ name = 'Mason', nc = 2, quals = 1, docs = 3 } = {}) {
  query
    .mockResolvedValueOnce({ recordset: [{ name }] })
    .mockResolvedValueOnce({ recordset: [{ nc_open: nc }] })
    .mockResolvedValueOnce({ recordset: [{ quals_expiring_30: quals }] })
    .mockResolvedValueOnce({ recordset: [{ docs_expiring_30: docs }] });
}

function mockStudioFacts({
  nc = 7,
  quals = 4,
  docs = 5,
  topNc = [{ company_id: 11, company_name: 'Mason', nc_open: 4 }],
  topQual = [{ company_id: 22, company_name: 'Camellini', quals_expiring_30: 3 }],
  topDoc = [{ company_id: 11, company_name: 'Mason', docs_expiring_30: 2 }],
} = {}) {
  query
    .mockResolvedValueOnce({ recordset: [{ nc_open: nc }] })
    .mockResolvedValueOnce({ recordset: [{ quals_expiring_30: quals }] })
    .mockResolvedValueOnce({ recordset: [{ docs_expiring_30: docs }] })
    .mockResolvedValueOnce({ recordset: topNc })
    .mockResolvedValueOnce({ recordset: topQual })
    .mockResolvedValueOnce({ recordset: topDoc });
}

describe('ambitoFacts.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('SB-4: companyId assente → aggregati studio ready + top aziende', async () => {
    mockStudioFacts();
    const out = await loadAmbitoFacts(user, null);
    expect(out.ready).toBe(true);
    expect(out.scope).toBe('studio');
    expect(out.companyId).toBeNull();
    expect(out.counts).toEqual({ ncOpen: 7, qualsExpiring30: 4, docsExpiring30: 5 });
    expect(out.topCompanies.length).toBeGreaterThanOrEqual(1);
    expect(out.topCompanies.some((c) => c.companyName === 'Mason')).toBe(true);
    expect(out.topCompanies.some((c) => c.companyName === 'Camellini')).toBe(true);
    expect(query.mock.calls.every((c) => c[1].organizationId === 99)).toBe(true);
    expect(query.mock.calls.every((c) => c[1].auditorOrgId === 10)).toBe(true);
    const ncSql = query.mock.calls.find((c) => String(c[0]).includes('non_conformities'))[0];
    expect(ncSql).not.toMatch(/@companyId/);
  });

  it('isola i conteggi per company_id (A vs B)', async () => {
    mockCompanyFacts({ name: 'Mason', nc: 4, quals: 2, docs: 1 });
    const a = await loadAmbitoFacts(user, 11);
    expect(a.ready).toBe(true);
    expect(a.scope).toBe('company');
    expect(a.companyId).toBe(11);
    expect(a.companyName).toBe('Mason');
    expect(a.counts).toEqual({ ncOpen: 4, qualsExpiring30: 2, docsExpiring30: 1 });
    expect(a.topCompanies).toBeNull();
    expect(query.mock.calls.some((c) => c[1].companyId === 11)).toBe(true);
    const ncSql = query.mock.calls.find((c) => String(c[0]).includes('non_conformities'))[0];
    expect(ncSql).toMatch(/nc\.audit_id = a\.audit_id/);
    expect(ncSql).not.toMatch(/a\.id = nc\.audit_id/);

    jest.clearAllMocks();
    mockCompanyFacts({ name: 'Camellini', nc: 0, quals: 9, docs: 0 });
    const b = await loadAmbitoFacts(user, 22);
    expect(b.companyId).toBe(22);
    expect(b.counts.qualsExpiring30).toBe(9);
    expect(b.counts.ncOpen).toBe(0);
    expect(query.mock.calls.some((c) => c[1].companyId === 22)).toBe(true);
    expect(query.mock.calls.every((c) => c[1].companyId !== 11)).toBe(true);
  });

  it('formatAmbitoFactsPromptBlock include i conteggi solo se ready', () => {
    expect(formatAmbitoFactsPromptBlock(null)).toBe('');
    expect(formatAmbitoFactsPromptBlock({ ready: false })).toBe('');
    const block = formatAmbitoFactsPromptBlock({
      ready: true,
      scope: 'company',
      companyId: 11,
      companyName: 'Mason',
      counts: { ncOpen: 3, qualsExpiring30: 1, docsExpiring30: 4 },
    });
    expect(block).toContain('FATTI AMBITO');
    expect(block).toContain('Mason');
    expect(block).toContain('company_id=11');
    expect(block).toContain('NC aperte: 3');
    expect(block).toContain('Qualifiche in scadenza entro 30 giorni: 1');
    expect(block).toContain('Documenti in scadenza entro 30 giorni: 4');
  });

  it('SB-4: format studio = aggregati + top, senza mescolare testi', () => {
    const block = formatAmbitoFactsPromptBlock({
      ready: true,
      scope: 'studio',
      companyId: null,
      counts: { ncOpen: 7, qualsExpiring30: 2, docsExpiring30: 1 },
      topCompanies: [
        { companyId: 11, companyName: 'Mason', ncOpen: 4, qualsExpiring30: 0, docsExpiring30: 1 },
        { companyId: 22, companyName: 'Camellini', ncOpen: 3, qualsExpiring30: 2, docsExpiring30: 0 },
      ],
    });
    expect(block).toContain('FATTI STUDIO');
    expect(block).toContain('Tutto lo studio');
    expect(block).toContain('NC aperte (totale studio): 7');
    expect(block).toContain('Mason');
    expect(block).toContain('Camellini');
    expect(block).toContain('Non mescolare testi o documenti');
    expect(block).not.toContain('company_id=11');
  });
});
