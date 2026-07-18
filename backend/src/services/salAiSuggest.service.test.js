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

jest.mock('./gapAnalysis.service', () => ({
  assertCompanyInOrganization: jest.fn(),
  SAL_STATUS_VALUES: ['discussed', 'in_progress', 'to_validate', 'completed', 'na'],
}));

jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const { query } = require('../config/database');
const { chat, getActiveProvider } = require('./aiProviderAdapter');
const { extractDocumentText } = require('./documentTextExtractor.service');
const { assertCompanyInOrganization } = require('./gapAnalysis.service');
const {
  suggestSalStatus,
  suggestForClause,
  normalizeSuggestedStatus,
  normalizeConfidence,
} = require('./salAiSuggest.service');

const CLAUSE_ROW = {
  id: 501,
  standard_code: 'ISO_9001_2015',
  clause_ref: '8.4',
  clause_title: 'Controllo processi/prodotti esterni',
  requirement_text: 'L\u2019organizzazione deve controllare i processi forniti dall\u2019esterno.',
};

/** Mock query router riusabile: clausola + evidenze + testo. */
function mockQueryHappyPath({ evidenceIds = [10], docRows } = {}) {
  query.mockImplementation((sqlText) => {
    if (/FROM norm_requirements\s+WHERE id = @id/.test(sqlText)) {
      return { recordset: [CLAUSE_ROW] };
    }
    if (/SELECT evidence_document_ids/.test(sqlText)) {
      return { recordset: [{ evidence_document_ids: JSON.stringify(evidenceIds) }] };
    }
    if (/FROM document_registry dr/.test(sqlText)) {
      return {
        recordset: docRows || [{
          document_id: 10,
          title: 'Procedura acquisti PG-07',
          storage_path: '/data/pg07.pdf',
          mime_type: 'application/pdf',
          file_name: 'pg07.pdf',
        }],
      };
    }
    return { recordset: [] };
  });
}

describe('salAiSuggest.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getActiveProvider.mockReturnValue('gemini');
    assertCompanyInOrganization.mockResolvedValue({ companyId: 42 });
  });

  describe('normalizeSuggestedStatus', () => {
    test('accetta codici SAL validi', () => {
      expect(normalizeSuggestedStatus('completed')).toBe('completed');
      expect(normalizeSuggestedStatus('to_validate')).toBe('to_validate');
    });
    test('mappa sinonimi IT/EN', () => {
      expect(normalizeSuggestedStatus('Completato')).toBe('completed');
      expect(normalizeSuggestedStatus('in corso')).toBe('in_progress');
      expect(normalizeSuggestedStatus('N/A')).toBe('na');
    });
    test('valore ignoto -> null', () => {
      expect(normalizeSuggestedStatus('boh')).toBeNull();
      expect(normalizeSuggestedStatus(null)).toBeNull();
    });
  });

  describe('normalizeConfidence', () => {
    test('valori canonici e italiani', () => {
      expect(normalizeConfidence('high')).toBe('high');
      expect(normalizeConfidence('Media')).toBe('medium');
      expect(normalizeConfidence('bassa')).toBe('low');
    });
    test('default low se ignoto', () => {
      expect(normalizeConfidence('xyz')).toBe('low');
      expect(normalizeConfidence(undefined)).toBe('low');
    });
  });

  describe('suggestSalStatus - scoping multi-tenant', () => {
    test('azienda fuori scope -> NOT_FOUND, nessuna chiamata AI', async () => {
      assertCompanyInOrganization.mockResolvedValue(null);
      const res = await suggestSalStatus({ organizationId: 1, companyId: 999, normRequirementId: 501 });
      expect(res.error).toBe('NOT_FOUND');
      expect(chat).not.toHaveBeenCalled();
    });

    test('nessun id richiesto -> VALIDATION', async () => {
      const res = await suggestSalStatus({ organizationId: 1, companyId: 42 });
      expect(res.error).toBe('VALIDATION');
    });
  });

  describe('suggestSalStatus - provider assente (graceful degradation)', () => {
    test('senza provider AI ritorna aiAvailable=false senza rompere', async () => {
      getActiveProvider.mockReturnValue(null);
      const res = await suggestSalStatus({ organizationId: 1, companyId: 42, normRequirementId: 501 });
      expect(res.error).toBeUndefined();
      expect(res.data.aiAvailable).toBe(false);
      expect(res.data.suggestions).toEqual([]);
      expect(chat).not.toHaveBeenCalled();
    });
  });

  describe('suggestForClause - happy path', () => {
    test('propone stato+confidenza dalle evidenze, senza scrivere su DB', async () => {
      mockQueryHappyPath();
      extractDocumentText.mockResolvedValue({ text: 'Procedura per la qualifica dei fornitori esterni...' });
      chat.mockResolvedValue({
        content: JSON.stringify({
          suggestedStatus: 'completed',
          confidence: 'high',
          rationale: 'La procedura copre il controllo dei fornitori esterni.',
          evidenceRefs: [10],
        }),
        model: 'gemini-1.5-flash',
        tokens: { input: 120, output: 30 },
      });

      const out = await suggestForClause(1, 42, 501);

      expect(out.suggestedStatus).toBe('completed');
      expect(out.confidence).toBe('high');
      expect(out.aiUsed).toBe(true);
      expect(out.clauseRef).toBe('8.4');
      expect(out.evidenceRefs).toEqual([
        expect.objectContaining({ documentId: 10, used: true }),
      ]);

      // Nessuna scrittura automatica: solo SELECT, mai INSERT/UPDATE sullo stato.
      const writeCalls = query.mock.calls.filter(([sql]) => /INSERT INTO|UPDATE /.test(sql));
      expect(writeCalls).toHaveLength(0);
    });

    test('normalizza uno stato AI fuori vocabolario', async () => {
      mockQueryHappyPath();
      extractDocumentText.mockResolvedValue({ text: 'Contenuto documento sufficiente.' });
      chat.mockResolvedValue({
        content: JSON.stringify({
          suggestedStatus: 'Completato',
          confidence: 'Media',
          rationale: 'ok',
          evidenceRefs: [10],
        }),
        model: 'gemini',
        tokens: { input: 10, output: 5 },
      });

      const out = await suggestForClause(1, 42, 501);
      expect(out.suggestedStatus).toBe('completed');
      expect(out.confidence).toBe('medium');
    });
  });

  describe('suggestForClause - documento senza testo', () => {
    test('nessun testo estraibile -> confidence low, AI non chiamata', async () => {
      mockQueryHappyPath();
      extractDocumentText.mockResolvedValue({ text: null, reason: 'pdf_no_text_layer' });

      const out = await suggestForClause(1, 42, 501);

      expect(out.aiUsed).toBe(false);
      expect(out.confidence).toBe('low');
      expect(out.suggestedStatus).toBeNull();
      expect(chat).not.toHaveBeenCalled();
    });

    test('nessuna evidenza collegata -> messaggio dedicato', async () => {
      query.mockImplementation((sqlText) => {
        if (/FROM norm_requirements\s+WHERE id = @id/.test(sqlText)) {
          return { recordset: [CLAUSE_ROW] };
        }
        if (/SELECT evidence_document_ids/.test(sqlText)) {
          return { recordset: [] };
        }
        return { recordset: [] };
      });

      const out = await suggestForClause(1, 42, 501);
      expect(out.aiUsed).toBe(false);
      expect(out.evidenceRefs).toEqual([]);
      expect(out.rationale).toMatch(/Nessuna evidenza/i);
      expect(chat).not.toHaveBeenCalled();
    });
  });

  describe('suggestForClause - clausola inesistente', () => {
    test('CLAUSE_NOT_FOUND', async () => {
      query.mockResolvedValue({ recordset: [] });
      const out = await suggestForClause(1, 42, 999);
      expect(out.error).toBe('CLAUSE_NOT_FOUND');
    });
  });

  describe('suggestSalStatus - batch', () => {
    test('aggrega piu clausole e conta i token', async () => {
      mockQueryHappyPath();
      extractDocumentText.mockResolvedValue({ text: 'Testo evidenza valido.' });
      chat.mockResolvedValue({
        content: JSON.stringify({ suggestedStatus: 'in_progress', confidence: 'medium', rationale: 'parziale', evidenceRefs: [10] }),
        model: 'gemini',
        tokens: { input: 50, output: 10 },
      });

      const res = await suggestSalStatus({ organizationId: 1, companyId: 42, normRequirementIds: [501, 501] });
      // 501 duplicato -> deduplicato a 1 clausola
      expect(res.data.suggestions).toHaveLength(1);
      expect(res.meta.tokens.input).toBe(50);
      expect(res.data.aiAvailable).toBe(true);
    });
  });
});
