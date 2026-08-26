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
  getStatusHistory,
  validateEvidenceDocumentIds,
  syncAuditConformityHints,
  getNormCoverageForReview,
  mapSalStatusToNormCoverage,
  mapSalStatusToGapCoverage,
  extractSalMacroClauseRef,
  clauseRefToSectionCode,
  pickWorstConformityHint,
  assertCompanyInOrganization,
} = require('./gapAnalysis.service');

const CLAUSES = [
  { clause_ref: '4.1', clause_title: 'Contesto organizzazione', requirement_text: 'Analizzare il contesto esterno e interno' },
  { clause_ref: '8.4', clause_title: 'Controllo processi forniti esternamente', requirement_text: 'Assicurare che i processi forniti esternamente siano conformi' },
  { clause_ref: '9.1', clause_title: 'Monitoraggio misura analisi valutazione', requirement_text: 'Determinare cosa deve essere monitorato' },
];

const DOCS = [
  { id: 1, title: 'Analisi contesto organizzativo', doc_type: 'procedura', type_specific_data: null },
  { id: 2, title: 'Procedura acquisti fornitori', doc_type: 'procedura', type_specific_data: JSON.stringify({ scope: 'fornitori esterni processi' }) },
  { id: 3, title: 'Piano qualità', doc_type: 'piano_qualita', type_specific_data: null },
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

  it('interroga document_registry con le colonne reali dello schema (doc_type, non document_type/is_current)', async () => {
    await runGapAnalysis({ organizationId: 1, companyId: 10, standardCode: 'ISO_9001_2015' });

    const docSql = mockQuery.mock.calls[1][0];
    expect(docSql).toContain('doc_type');
    expect(docSql).not.toContain('document_type');
    expect(docSql).toContain("status <> 'obsoleto'");
    expect(docSql).not.toContain('is_current');
  });

  it('restituisce array vuoto se nessuna clausola trovata, con messaggio norma assente', async () => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({ recordset: [] }).mockResolvedValueOnce({ recordset: [] });

    const matrix = await runGapAnalysis({ organizationId: 1, companyId: 10, standardCode: 'UNKNOWN_STD' });
    expect(matrix).toHaveLength(0);
    expect(matrix.normAbsent).toEqual(expect.objectContaining({
      textAvailable: false,
      code: 'NORM_TEXT_ABSENT',
      standardCode: 'UNKNOWN_STD',
    }));
    expect(matrix.normAbsent.message).toMatch(/UNKNOWN STD/);
    expect(matrix.normAbsent.message).toMatch(/archivio locale/);
    expect(matrix.normAbsent.message).toMatch(/Registro Documenti/);
    expect(matrix.normAbsent.message).not.toMatch(/il requisito è/i);
  });

  it('classifica come missing clausole senza documenti correlati', async () => {
    mockQuery.mockReset();
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ clause_ref: '10.2', clause_title: 'Non conformità azione correttiva', requirement_text: 'Reagire alle non conformità' }] })
      .mockResolvedValueOnce({ recordset: [{ id: 99, title: 'Piano qualità', doc_type: 'piano_qualita', type_specific_data: null }] });

    const matrix = await runGapAnalysis({ organizationId: 1, companyId: 10, standardCode: 'ISO_9001_2015' });
    // "Piano qualità" non contiene token di "non conformità azione correttiva" → missing o partial
    expect(['missing', 'partial']).toContain(matrix[0].coverage);
  });

  it('senza stato SAL tracciato (query SAL fallisce/azienda fuori scope) resta sull\'euristica (coverageSource: heuristic)', async () => {
    // beforeEach ha già accodato solo 2 risposte (clausole, documenti): la successiva
    // chiamata di getGapMatrix (assertCompanyInOrganization) trova la coda esaurita
    // e fallisce — deve degradare in modo silenzioso, non rompere l'euristica.
    const matrix = await runGapAnalysis({ organizationId: 1, companyId: 10, standardCode: 'ISO_9001_2015' });

    for (const row of matrix) {
      expect(row.coverageSource).toBe('heuristic');
    }
  });

  it('sovrascrive la copertura con lo stato SAL quando la macro-clausola è tracciata (GAP↔SAL dialogano)', async () => {
    mockQuery
      // getGapMatrix → assertCompanyInOrganization
      .mockResolvedValueOnce({ recordset: [{ id: 10 }] })
      // getGapMatrix → query principale matrice SAL
      .mockResolvedValueOnce({
        recordset: [
          {
            norm_requirement_id: 5,
            standard_code: 'ISO_9001_2015',
            clause_ref: '4.1',
            clause_title: 'Contesto organizzazione',
            status_id: 1,
            status: 'completed',
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

    const matrix = await runGapAnalysis({ organizationId: 1, companyId: 10, standardCode: 'ISO_9001_2015' });

    const c41 = matrix.find((r) => r.clauseRef === '4.1');
    expect(c41.coverage).toBe('covered');
    expect(c41.coverageSource).toBe('sal');
    expect(c41.sal).toEqual({ macroClauseRef: '4.1', exactMatch: true, status: 'completed' });

    // Le altre clausole non hanno riga SAL corrispondente → resta euristica
    const c84 = matrix.find((r) => r.clauseRef === '8.4');
    expect(c84.coverageSource).toBe('heuristic');
  });

  it('una sotto-clausola NON eredita lo stato della sua macro-clausola SAL (resta euristica, ma espone sal.macroClauseRef come suggerimento)', async () => {
    mockQuery.mockReset();
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ clause_ref: '4.1.2', clause_title: 'Sotto-punto contesto', requirement_text: 'Dettaglio operativo' }] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ id: 10 }] })
      .mockResolvedValueOnce({
        recordset: [{
          norm_requirement_id: 5,
          standard_code: 'ISO_9001_2015',
          clause_ref: '4.1',
          clause_title: 'Contesto organizzazione',
          status_id: 1,
          status: 'discussed',
          conformity_hint: null,
          notes: null,
          responsible: null,
          due_date: null,
          evidence_document_ids: null,
          updated_at: null,
          updated_by: null,
        }],
      });

    const matrix = await runGapAnalysis({ organizationId: 1, companyId: 10, standardCode: 'ISO_9001_2015' });

    expect(matrix[0].clauseRef).toBe('4.1.2');
    expect(matrix[0].coverageSource).toBe('heuristic');
    expect(matrix[0].sal).toEqual({ macroClauseRef: '4.1', exactMatch: false, status: 'discussed' });
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

  it('validateEvidenceDocumentIds filtra solo documenti in scope org/azienda', async () => {
    mockQuery.mockResolvedValueOnce({
      recordset: [{ id: 10 }, { id: 99 }],
    });

    const ids = await validateEvidenceDocumentIds(1, 10, [10, 99, 100, 'bad']);

    expect(ids).toEqual([10, 99]);
    expect(mockQuery.mock.calls[0][0]).toContain('document_registry');
    expect(mockQuery.mock.calls[0][0]).toContain("status <> 'obsoleto'");
  });

  it('getStatusHistory restituisce revisioni ordinate per status_id', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ id: 10 }] })
      .mockResolvedValueOnce({
        recordset: [{
          status_id: 55,
          clause_ref: '8.4',
          clause_title: 'Controllo fornitori',
          standard_code: 'ISO_9001_2015',
        }],
      })
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 2,
            status: 'in_progress',
            notes: 'Avviato',
            changed_at: new Date('2026-02-01'),
            changed_by: 3,
            changed_by_name: 'Mario Rossi',
          },
          {
            id: 1,
            status: 'discussed',
            notes: null,
            changed_at: new Date('2026-01-15'),
            changed_by: 3,
            changed_by_name: 'Mario Rossi',
          },
        ],
      });

    const data = await getStatusHistory(1, 10, 5);

    expect(data.clauseRef).toBe('8.4');
    expect(data.history).toHaveLength(2);
    expect(data.history[0].status).toBe('in_progress');
    expect(data.history[0].changedByName).toBe('Mario Rossi');
  });

  it('upsertStatus con evidenceDocumentIds valida contro document_registry', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ id: 10 }] })
      .mockResolvedValueOnce({ recordset: [{ id: 5, standard_code: 'ISO_9001_2015' }] })
      .mockResolvedValueOnce({ recordset: [{ id: 77 }] })
      .mockResolvedValueOnce({ recordset: [{ id: 10, status: 'completed' }] })
      .mockResolvedValueOnce({ recordset: [] });

    const result = await upsertStatus(1, 10, 7, {
      normRequirementId: 5,
      status: 'completed',
      evidenceDocumentIds: [77, 999],
    });

    expect(result.action).toBe('updated');
    const updateCall = mockQuery.mock.calls.find((c) => c[0].includes('UPDATE requirement_implementation_status'));
    expect(updateCall[1].evidenceJson).toBe('[77]');
  });

  it('clauseRefToSectionCode mappa macro-clausola a section checklist', () => {
    expect(clauseRefToSectionCode('8.4')).toBe('clause8');
    expect(clauseRefToSectionCode('4.1')).toBe('clause4');
    expect(clauseRefToSectionCode('')).toBeNull();
  });

  it('extractSalMacroClauseRef estrae la macro-clausola N.N o null per titoli di sezione', () => {
    expect(extractSalMacroClauseRef('4.1')).toBe('4.1');
    expect(extractSalMacroClauseRef('8.1.4.2')).toBe('8.1');
    expect(extractSalMacroClauseRef('10')).toBeNull();
    expect(extractSalMacroClauseRef('')).toBeNull();
  });

  it('mapSalStatusToGapCoverage mappa gli stati SAL sulla scala a 3 livelli del GAP', () => {
    expect(mapSalStatusToGapCoverage('completed')).toBe('covered');
    expect(mapSalStatusToGapCoverage('to_validate')).toBe('covered');
    expect(mapSalStatusToGapCoverage('na')).toBe('covered');
    expect(mapSalStatusToGapCoverage('in_progress')).toBe('partial');
    expect(mapSalStatusToGapCoverage('discussed')).toBe('missing');
    expect(mapSalStatusToGapCoverage(null)).toBe('missing');
  });

  it('pickWorstConformityHint preferisce NC su C', () => {
    expect(pickWorstConformityHint(['C', 'NC', 'NA'])).toBe('NC');
    expect(pickWorstConformityHint(['OSS', 'OM'])).toBe('OSS');
  });

  it('syncAuditConformityHints aggiorna conformity_hint da audit recente', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ id: 10 }] })
      .mockResolvedValueOnce({
        recordset: [
          { standard_code: 'ISO_9001_2015', section_code: 'clause8', conformity_status: 'NC' },
          { standard_code: 'ISO_9001_2015', section_code: 'clause8', conformity_status: 'C' },
        ],
      })
      .mockResolvedValueOnce({
        recordset: [
          {
            status_id: 5,
            standard_code: 'ISO_9001_2015',
            clause_ref: '8.4',
            conformity_hint: null,
          },
        ],
      })
      .mockResolvedValueOnce({ recordset: [] });

    const data = await syncAuditConformityHints(1, 10, 7, { monthsBack: 12 });

    expect(data.updated).toBe(1);
    expect(data.matchedRows).toBe(1);
    const updateCall = mockQuery.mock.calls.find((c) => c[0].includes('conformity_hint = @hint'));
    expect(updateCall[1].hint).toBe('NC');
  });

  it('mapSalStatusToNormCoverage mappa stati implementazione SAL', () => {
    expect(mapSalStatusToNormCoverage('completed')).toBe('ok');
    expect(mapSalStatusToNormCoverage('to_validate')).toBe('ok');
    expect(mapSalStatusToNormCoverage('in_progress')).toBe('gap');
    expect(mapSalStatusToNormCoverage(null)).toBe('gap');
  });

  it('getNormCoverageForReview legge matrice SAL escludendo na', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ id: 10 }] })
      .mockResolvedValueOnce({
        recordset: [
          {
            norm_requirement_id: 1,
            standard_code: 'ISO_9001_2015',
            clause_ref: '9.3',
            clause_title: 'Riesame',
            status_id: 2,
            status: 'completed',
            conformity_hint: 'C',
            notes: null,
            responsible: null,
            due_date: null,
            evidence_document_ids: null,
            updated_at: new Date('2026-03-01'),
            updated_by: 1,
          },
          {
            norm_requirement_id: 2,
            standard_code: 'ISO_9001_2015',
            clause_ref: '8.4',
            clause_title: 'Fornitori',
            status_id: 3,
            status: 'na',
            conformity_hint: null,
            notes: null,
            responsible: null,
            due_date: null,
            evidence_document_ids: null,
            updated_at: null,
            updated_by: null,
          },
        ],
      });

    const coverage = await getNormCoverageForReview(1, 10);

    expect(coverage).toHaveLength(1);
    expect(coverage[0]).toMatchObject({
      clause: '9.3',
      status: 'ok',
      sal_status: 'completed',
      last_verified: '2026-03-01',
    });
  });
});
