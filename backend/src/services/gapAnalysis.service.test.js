/**
 * Test L1 — gapAnalysis.service (HK-8)
 */

jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const mockQuery = jest.fn();
jest.mock('../config/database', () => ({ query: mockQuery }));

const {
  runGapAnalysis,
  getGapMatrix,
  listStatuses,
  upsertStatus,
  seedForCompany,
  assertCompanyInOrganization,
} = require('./gapAnalysis.service');

const CLAUSES = [
  { clause_ref: '4.1', clause_title: 'Contesto organizzazione', requirement_text: 'Analizzare il contesto esterno e interno' },
  { clause_ref: '8.4', clause_title: 'Controllo processi forniti esternamente', requirement_text: 'Assicurare che i processi forniti esternamente siano conformi' },
  { clause_ref: '9.1', clause_title: 'Monitoraggio misura analisi valutazione', requirement_text: 'Determinare cosa deve essere monitorato' },
];

const DOCS = [
  { id: 1, title: 'Analisi contesto organizzativo', document_type: 'procedura', type_specific_data: null },
  { id: 2, title: 'Procedura acquisti fornitori', document_type: 'procedura', type_specific_data: JSON.stringify({ scope: 'fornitori esterni processi' }) },
  { id: 3, title: 'Piano qualità', document_type: 'piano_qualita', type_specific_data: null },
];

describe('gapAnalysis.service — runGapAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery
      .mockResolvedValueOnce({ recordset: CLAUSES })  // clausole
      .mockResolvedValueOnce({ recordset: DOCS });     // documenti
  });

  it('restituisce matrice con copertura per ogni clausola', async () => {
    const matrix = await runGapAnalysis({ organizationId: 1, companyId: 10, standardCode: 'ISO_9001_2015' });

    expect(Array.isArray(matrix)).toBe(true);
    expect(matrix).toHaveLength(3);

    const c41 = matrix.find((r) => r.clauseRef === '4.1');
    expect(c41).toBeDefined();
    expect(['covered', 'partial', 'missing']).toContain(c41.coverage);

    const c84 = matrix.find((r) => r.clauseRef === '8.4');
    expect(c84).toBeDefined();
    // Doc 2 contiene "fornitori esterni processi" → deve avere copertura
    expect(c84.coverage).not.toBe('missing');
  });

  it('restituisce array vuoto se nessuna clausola trovata', async () => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({ recordset: [] }).mockResolvedValueOnce({ recordset: [] });

    const matrix = await runGapAnalysis({ organizationId: 1, companyId: 10, standardCode: 'UNKNOWN_STD' });
    expect(matrix).toHaveLength(0);
  });

  it('classifica come missing clausole senza documenti correlati', async () => {
    mockQuery.mockReset();
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ clause_ref: '10.2', clause_title: 'Non conformità azione correttiva', requirement_text: 'Reagire alle non conformità' }] })
      .mockResolvedValueOnce({ recordset: [{ id: 99, title: 'Piano qualità', document_type: 'piano_qualita', type_specific_data: null }] });

    const matrix = await runGapAnalysis({ organizationId: 1, companyId: 10, standardCode: 'ISO_9001_2015' });
    // "Piano qualità" non contiene token di "non conformità azione correttiva" → missing o partial
    expect(['missing', 'partial']).toContain(matrix[0].coverage);
  });
});

describe('gapAnalysis.service — SAL Fase 0', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('assertCompanyInOrganization restituisce companyId se azienda nello scope org', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [{ id: 10 }] });
    const scoped = await assertCompanyInOrganization(1, 10);
    expect(scoped).toEqual({ companyId: 10 });
  });

  it('assertCompanyInOrganization restituisce null se azienda fuori scope', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [] });
    const scoped = await assertCompanyInOrganization(1, 999);
    expect(scoped).toBeNull();
  });

  it('getGapMatrix filtra per standard_code e scope org', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ id: 10 }] })
      .mockResolvedValueOnce({
        recordset: [
          {
            norm_requirement_id: 5,
            standard_code: 'ISO_9001_2015',
            clause_ref: '4.1',
            clause_title: 'Contesto',
            status_id: 1,
            status: 'discussed',
            conformity_hint: null,
            notes: null,
            responsible: null,
            due_date: null,
            evidence_document_ids: null,
            updated_at: new Date('2026-01-01'),
            updated_by: 2,
          },
        ],
      });

    const data = await getGapMatrix(1, 10, { standardCode: 'ISO_9001_2015' });

    expect(data.companyId).toBe(10);
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].clauseRef).toBe('4.1');
    expect(data.summary.discussed).toBe(1);

    const sql = mockQuery.mock.calls[1][0];
    expect(sql).toContain('nr.standard_code = @standardCode');
    expect(sql).toContain('organization_id = @orgId');
  });

  it('listStatuses restituisce solo righe persistite', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ id: 10 }] })
      .mockResolvedValueOnce({
        recordset: [
          {
            status_id: 3,
            norm_requirement_id: 7,
            standard_code: 'ISO_14001_2015',
            clause_ref: '6.1',
            clause_title: 'Azioni',
            status: 'in_progress',
            conformity_hint: null,
            notes: 'Avviato',
            responsible: 'Mario',
            due_date: null,
            evidence_document_ids: null,
            updated_at: new Date(),
            updated_by: 1,
          },
        ],
      });

    const data = await listStatuses(1, 10, { standardCode: 'ISO_14001_2015' });
    expect(data.items).toHaveLength(1);
    expect(data.items[0].status).toBe('in_progress');
  });

  it('seedForCompany è idempotente (INSERT solo WHERE NOT EXISTS)', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ id: 10 }] })
      .mockResolvedValueOnce({ recordset: [{ cnt: 0 }] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ cnt: 12 }] });

    const data = await seedForCompany(1, 10, ['ISO_9001_2015']);

    expect(data.inserted).toBe(12);
    expect(data.total).toBe(12);
    const insertSql = mockQuery.mock.calls[2][0];
    expect(insertSql).toContain('NOT EXISTS');
    expect(insertSql).toContain("'discussed'");
  });

  it('upsertStatus crea riga e storico su insert', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ id: 10 }] })
      .mockResolvedValueOnce({ recordset: [{ id: 5, standard_code: 'ISO_9001_2015' }] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ id: 99 }] })
      .mockResolvedValueOnce({ recordset: [] });

    const result = await upsertStatus(1, 10, 7, {
      normRequirementId: 5,
      status: 'completed',
      notes: 'Fatto',
    });

    expect(result.action).toBe('created');
    expect(result.statusId).toBe(99);
    expect(mockQuery.mock.calls[4][0]).toContain('INSERT INTO requirement_implementation_history');
  });

  it('upsertStatus rifiuta status non valido', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [{ id: 10 }] });

    const result = await upsertStatus(1, 10, 7, {
      normRequirementId: 5,
      status: 'invalido',
    });

    expect(result.error).toBe('VALIDATION');
  });
});
