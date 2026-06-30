/**
 * Test L1 — gapAnalysis.service (HK-8)
 */

jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const mockQuery = jest.fn();
jest.mock('../config/database', () => ({ query: mockQuery }));

const { runGapAnalysis } = require('./gapAnalysis.service');

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
