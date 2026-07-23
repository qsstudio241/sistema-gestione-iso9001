/**
 * @jest-environment node
 */

/* eslint-env jest */

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('./aiProviderAdapter', () => ({
  chat: jest.fn(),
  getActiveProvider: jest.fn(() => 'gemini'),
}));

jest.mock('./documentTextExtractor.service', () => ({
  extractDocumentText: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const { query } = require('../config/database');
const { chat, getActiveProvider } = require('./aiProviderAdapter');
const { extractDocumentText } = require('./documentTextExtractor.service');
const {
  suggestWeldingCompliance,
  DEFAULT_TOP_LEVEL_CLAUSES,
} = require('./weldingAiSuggest.service');

const PROJECT_ROW = {
  id: 55,
  organization_id: 1,
  company_id: 7,
  company_name: 'Officine Mason',
  project_code: 'CM-2026-001',
  description: 'Realizzazione carpenteria in acciaio S355',
  notes: null,
  applicable_wps_ids: JSON.stringify([1]),
  technical_review_checklist: JSON.stringify({
    materiale_base: { checked: true, note: 'S355 con certificato 3.1' },
    controllo_qualita: { checked: false },
  }),
};

const CLAUSE_ROWS = [
  { id: 1, standard_code: 'ISO_3834_3_2021', clause_ref: '5', clause_title: 'RIESAME DEI REQUISITI E RIESAME TECNICO', requirement_text: 'Testo clausola 5.' },
  { id: 2, standard_code: 'ISO_3834_3_2021', clause_ref: '10.2', clause_title: 'Specifiche delle procedure di saldatura', requirement_text: 'Testo clausola 10.2.' },
];

/** Mock query router riusabile: progetto + WPS + clausole + documenti azienda. */
function mockQueryHappyPath({ docRows } = {}) {
  query.mockImplementation((sqlText) => {
    if (/FROM projects p/.test(sqlText)) {
      return { recordset: [PROJECT_ROW] };
    }
    if (/FROM welding_procedures/.test(sqlText)) {
      return { recordset: [{ id: 1, wps_code: 'WPS-01', revision: '0', welding_process: '141', material_group: '8.1', status: 'attiva' }] };
    }
    if (/FROM norm_requirements/.test(sqlText)) {
      return { recordset: CLAUSE_ROWS };
    }
    if (/FROM document_registry dr/.test(sqlText)) {
      return {
        recordset: docRows || [{
          document_id: 20,
          title: 'Manuale qualita\u2019 saldatura',
          storage_path: '/data/manuale.pdf',
          mime_type: 'application/pdf',
          file_name: 'manuale.pdf',
        }],
      };
    }
    return { recordset: [] };
  });
}

describe('weldingAiSuggest.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getActiveProvider.mockReturnValue('gemini');
  });

  test('commessa fuori scope organizzazione -> PROJECT_NOT_FOUND, nessuna chiamata AI', async () => {
    query.mockResolvedValue({ recordset: [] });
    const res = await suggestWeldingCompliance({ organizationId: 999, projectId: 55 });
    expect(res.error).toBe('PROJECT_NOT_FOUND');
    expect(chat).not.toHaveBeenCalled();
  });

  test('projectId non valido -> VALIDATION', async () => {
    const res = await suggestWeldingCompliance({ organizationId: 1, projectId: 'abc' });
    expect(res.error).toBe('VALIDATION');
  });

  test('provider AI assente -> aiAvailable=false, nessun errore (graceful degradation)', async () => {
    mockQueryHappyPath();
    getActiveProvider.mockReturnValue(null);
    const res = await suggestWeldingCompliance({ organizationId: 1, projectId: 55 });
    expect(res.error).toBeUndefined();
    expect(res.data.aiAvailable).toBe(false);
    expect(res.data.suggestions).toEqual([]);
    expect(chat).not.toHaveBeenCalled();
  });

  test('happy path: propone coverage+confidenza per clausola, nessuna scrittura su DB', async () => {
    mockQueryHappyPath();
    extractDocumentText.mockResolvedValue({ text: 'Il manuale qualita\u2019 descrive il controllo delle saldature.' });
    chat.mockResolvedValue({
      content: JSON.stringify({
        clauses: [
          { clauseRef: '5', coverage: 'partial', confidence: 'medium', rationale: 'Riesame tecnico parzialmente completato.' },
          { clauseRef: '10.2', coverage: 'covered', confidence: 'high', rationale: 'WPS presente e attiva.' },
        ],
      }),
      model: 'gemini-1.5-flash',
      tokens: { input: 300, output: 80 },
    });

    const res = await suggestWeldingCompliance({ organizationId: 1, projectId: 55 });

    expect(res.data.aiAvailable).toBe(true);
    expect(res.data.projectCode).toBe('CM-2026-001');
    expect(res.data.suggestions).toHaveLength(2);
    expect(res.data.suggestions[0]).toEqual(expect.objectContaining({
      clauseRef: '5', coverage: 'partial', confidence: 'medium',
    }));
    expect(res.data.suggestions[1]).toEqual(expect.objectContaining({
      clauseRef: '10.2', coverage: 'covered', confidence: 'high',
    }));
    expect(res.meta.contextSummary).toContain('CM-2026-001');

    const writeCalls = query.mock.calls.filter(([sql]) => /INSERT INTO|UPDATE /.test(sql));
    expect(writeCalls).toHaveLength(0);
  });

  test('errore chat AI -> risposta graceful con confidenza low per ogni clausola', async () => {
    mockQueryHappyPath();
    chat.mockRejectedValue(new Error('provider down'));

    const res = await suggestWeldingCompliance({ organizationId: 1, projectId: 55 });
    expect(res.data.aiAvailable).toBe(true);
    expect(res.data.suggestions).toHaveLength(2);
    expect(res.data.suggestions.every((s) => s.confidence === 'low' && s.coverage === null)).toBe(true);
  });

  test('nessuna clausola trovata per lo standard -> aiAvailable=false, messaggio dedicato', async () => {
    query.mockImplementation((sqlText) => {
      if (/FROM projects p/.test(sqlText)) return { recordset: [PROJECT_ROW] };
      if (/FROM norm_requirements/.test(sqlText)) return { recordset: [] };
      return { recordset: [] };
    });
    const res = await suggestWeldingCompliance({ organizationId: 1, projectId: 55 });
    expect(res.data.aiAvailable).toBe(false);
    expect(res.data.suggestions).toEqual([]);
    expect(chat).not.toHaveBeenCalled();
  });

  test('clauseRefs espliciti sovrascrivono le macro-clausole default', async () => {
    query.mockImplementation((sqlText, params) => {
      if (/FROM projects p/.test(sqlText)) return { recordset: [PROJECT_ROW] };
      if (/FROM welding_procedures/.test(sqlText)) return { recordset: [] };
      if (/FROM norm_requirements/.test(sqlText)) {
        expect(params.ref0).toBe('15');
        return { recordset: [{ id: 3, standard_code: 'ISO_3834_3_2021', clause_ref: '15', clause_title: 'NON CONFORMITA\u2019 ED AZIONI CORRETTIVE', requirement_text: 'Testo.' }] };
      }
      return { recordset: [] };
    });
    chat.mockResolvedValue({
      content: JSON.stringify({ clauses: [{ clauseRef: '15', coverage: 'missing', confidence: 'low', rationale: 'r' }] }),
      model: 'gemini', tokens: { input: 10, output: 5 },
    });

    const res = await suggestWeldingCompliance({ organizationId: 1, projectId: 55, clauseRefs: ['15'] });
    expect(res.data.suggestions).toHaveLength(1);
    expect(res.data.suggestions[0].clauseRef).toBe('15');
  });

  test('DEFAULT_TOP_LEVEL_CLAUSES include le macro-clausole operative chiave', () => {
    expect(DEFAULT_TOP_LEVEL_CLAUSES).toEqual(expect.arrayContaining(['5', '10', '14', '15', '17']));
  });
});
