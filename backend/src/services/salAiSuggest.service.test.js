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

jest.mock('./normBroker.service', () => ({
  getClauseText: jest.fn(),
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
const normBroker = require('./normBroker.service');
const { assertCompanyInOrganization } = require('./gapAnalysis.service');
const {
  suggestSalStatus,
  suggestForClause,
  parseLinkedLegislation,
  decreeLabelToStandardCode,
  normalizeSuggestedStatus,
  normalizeConfidence,
  normalizeCoverage,
} = require('./salAiSuggest.service');

const CLAUSE_ROW = {
  id: 501,
  standard_code: 'ISO_9001_2015',
  clause_ref: '8.4',
  clause_title: 'Controllo processi/prodotti esterni',
  requirement_text: 'L\u2019organizzazione deve controllare i processi forniti dall\u2019esterno.',
};

/** Clausola ISO 45001 con leggi collegate (asse legislativo, SAL 5-B). */
const CLAUSE_ROW_LEGAL = {
  id: 610,
  standard_code: 'ISO_45001_2018',
  clause_ref: '6.1.2',
  clause_title: 'Identificazione dei pericoli e valutazione dei rischi',
  requirement_text: 'L\u2019organizzazione deve stabilire processi di identificazione dei pericoli.',
  linked_legislation: 'D.Lgs. 81/2008 art.28; art.29',
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

/** Mock query router per clausola con leggi collegate + evidenze con testo. */
function mockQueryLegalPath({ clause = CLAUSE_ROW_LEGAL } = {}) {
  query.mockImplementation((sqlText) => {
    if (/FROM norm_requirements\s+WHERE id = @id/.test(sqlText)) {
      return { recordset: [clause] };
    }
    if (/SELECT evidence_document_ids/.test(sqlText)) {
      return { recordset: [{ evidence_document_ids: JSON.stringify([10]) }] };
    }
    if (/FROM document_registry dr/.test(sqlText)) {
      return {
        recordset: [{
          document_id: 10,
          title: 'DVR aziendale',
          storage_path: '/data/dvr.pdf',
          mime_type: 'application/pdf',
          file_name: 'dvr.pdf',
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
    normBroker.getClauseText.mockResolvedValue(null);
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

  // ---------------------------------------------------------------------------
  // SAL Fase 5-B: conformita' legislativa
  // ---------------------------------------------------------------------------

  describe('normalizeCoverage', () => {
    test('valori canonici e sinonimi IT', () => {
      expect(normalizeCoverage('covered')).toBe('covered');
      expect(normalizeCoverage('Parziale')).toBe('partial');
      expect(normalizeCoverage('non conforme')).toBe('missing');
      expect(normalizeCoverage('conforme')).toBe('covered');
    });
    test('valore ignoto/nullo -> null', () => {
      expect(normalizeCoverage('boh')).toBeNull();
      expect(normalizeCoverage(null)).toBeNull();
    });
  });

  describe('decreeLabelToStandardCode', () => {
    test('mappa etichetta discorsiva -> standard_code', () => {
      expect(decreeLabelToStandardCode('D.Lgs. 81/2008')).toBe('DLgs_81_2008');
      expect(decreeLabelToStandardCode('D.Lgs. 152/2006')).toBe('DLgs_152_2006');
    });
    test('etichetta non riconosciuta -> null', () => {
      expect(decreeLabelToStandardCode('Regolamento UE 2016/679')).toBeNull();
    });
  });

  describe('parseLinkedLegislation', () => {
    test('estrae piu articoli dello stesso decreto in ordine', () => {
      const refs = parseLinkedLegislation('D.Lgs. 81/2008 art.28; art.29');
      expect(refs).toEqual([
        expect.objectContaining({ standardCode: 'DLgs_81_2008', clauseRef: 'art.28', articleRef: 'D.Lgs. 81/2008 art.28' }),
        expect.objectContaining({ standardCode: 'DLgs_81_2008', clauseRef: 'art.29' }),
      ]);
    });
    test('gestisce piu decreti nella stessa stringa', () => {
      const refs = parseLinkedLegislation('D.Lgs. 81/2008 art.15; D.Lgs. 152/2006 art.6');
      expect(refs).toHaveLength(2);
      expect(refs[0]).toEqual(expect.objectContaining({ standardCode: 'DLgs_81_2008', clauseRef: 'art.15' }));
      expect(refs[1]).toEqual(expect.objectContaining({ standardCode: 'DLgs_152_2006', clauseRef: 'art.6' }));
    });
    test('deduplica articoli ripetuti', () => {
      const refs = parseLinkedLegislation('D.Lgs. 81/2008 art.28; art.28');
      expect(refs).toHaveLength(1);
    });
    test('stringa vuota/nulla -> []', () => {
      expect(parseLinkedLegislation('')).toEqual([]);
      expect(parseLinkedLegislation(null)).toEqual([]);
    });
  });

  describe('suggestForClause - asse legislativo', () => {
    test('clausola SENZA linked_legislation: nessuna sezione legale (graceful)', async () => {
      mockQueryHappyPath();
      extractDocumentText.mockResolvedValue({ text: 'Procedura acquisti valida.' });
      chat.mockResolvedValue({
        content: JSON.stringify({ suggestedStatus: 'completed', confidence: 'high', rationale: 'ok', evidenceRefs: [10] }),
        model: 'gemini', tokens: { input: 10, output: 5 },
      });

      const out = await suggestForClause(1, 42, 501);
      expect(out.legal).toBeUndefined();
      expect(normBroker.getClauseText).not.toHaveBeenCalled();
    });

    test('mappa linked_legislation, carica testo articoli e produce output per-articolo', async () => {
      mockQueryLegalPath();
      extractDocumentText.mockResolvedValue({ text: 'Il DVR valuta tutti i rischi presenti in azienda.' });
      normBroker.getClauseText.mockImplementation(async (std, ref) => {
        if (std === 'DLgs_81_2008' && ref === 'art.28') {
          return { text: 'Art. 28 - Oggetto della valutazione dei rischi...', title: 'Oggetto DVR', fullRef: 'DLgs_81_2008 art.28', sourceUrl: 'https://normattiva.it/28', source: 'local_db' };
        }
        if (std === 'DLgs_81_2008' && ref === 'art.29') {
          return { text: 'Art. 29 - Modalita di effettuazione della valutazione...', title: 'Modalita DVR', fullRef: 'DLgs_81_2008 art.29', sourceUrl: 'https://normattiva.it/29', source: 'local_db' };
        }
        return null;
      });
      chat.mockResolvedValue({
        content: JSON.stringify({
          suggestedStatus: 'to_validate',
          confidence: 'medium',
          rationale: 'DVR presente ma da validare.',
          evidenceRefs: [10],
          legalConfidence: 'medium',
          legalConformity: [
            { articleRef: 'D.Lgs. 81/2008 art.28', coverage: 'covered', gap: '', rationale: 'Il DVR copre la valutazione.' },
            { articleRef: 'D.Lgs. 81/2008 art.29', coverage: 'partial', gap: 'Manca aggiornamento periodico.', rationale: 'Aggiornamento non documentato.' },
          ],
        }),
        model: 'gemini', tokens: { input: 200, output: 60 },
      });

      const out = await suggestForClause(1, 42, 610);

      // Assi separati: stato tecnico + conformita' legislativa distinti.
      expect(out.suggestedStatus).toBe('to_validate');
      expect(out.legal).toBeDefined();
      expect(out.legal.evaluated).toBe(true);
      expect(out.legal.confidence).toBe('medium');
      expect(out.legal.articles).toHaveLength(2);
      expect(out.legal.articles[0]).toEqual(expect.objectContaining({
        articleRef: 'D.Lgs. 81/2008 art.28',
        standardCode: 'DLgs_81_2008',
        clauseRef: 'art.28',
        coverage: 'covered',
        sourceUrl: 'https://normattiva.it/28',
        textAvailable: true,
      }));
      expect(out.legal.articles[1].coverage).toBe('partial');
      expect(out.legal.articles[1].gap).toMatch(/aggiornamento/i);

      // Nessuna scrittura DB: solo SELECT.
      const writeCalls = query.mock.calls.filter(([sql]) => /INSERT INTO|UPDATE /.test(sql));
      expect(writeCalls).toHaveLength(0);
    });

    test('articolo di legge non trovato in local_db: coverage null, non rompe', async () => {
      mockQueryLegalPath();
      extractDocumentText.mockResolvedValue({ text: 'Evidenza con testo valido.' });
      normBroker.getClauseText.mockResolvedValue(null); // nessun articolo trovato
      chat.mockResolvedValue({
        content: JSON.stringify({ suggestedStatus: 'in_progress', confidence: 'medium', rationale: 'ok', evidenceRefs: [10] }),
        model: 'gemini', tokens: { input: 50, output: 10 },
      });

      const out = await suggestForClause(1, 42, 610);
      expect(out.legal).toBeDefined();
      expect(out.legal.evaluated).toBe(false);
      expect(out.legal.articles).toHaveLength(2);
      expect(out.legal.articles.every((a) => a.coverage === null && a.textAvailable === false)).toBe(true);
    });

    test('broker in errore su un articolo: graceful, articolo marcato non disponibile', async () => {
      mockQueryLegalPath();
      extractDocumentText.mockResolvedValue({ text: 'Evidenza valida.' });
      normBroker.getClauseText.mockImplementation(async (std, ref) => {
        if (ref === 'art.28') throw new Error('DB down');
        return { text: 'Art. 29 testo', title: 'A29', fullRef: 'x', sourceUrl: null, source: 'local_db' };
      });
      chat.mockResolvedValue({
        content: JSON.stringify({
          suggestedStatus: 'in_progress', confidence: 'low', rationale: 'ok', evidenceRefs: [10],
          legalConfidence: 'low',
          legalConformity: [{ articleRef: 'D.Lgs. 81/2008 art.29', coverage: 'missing', gap: 'gap', rationale: 'r' }],
        }),
        model: 'gemini', tokens: { input: 20, output: 5 },
      });

      const out = await suggestForClause(1, 42, 610);
      expect(out.legal.articles).toHaveLength(2);
      const a28 = out.legal.articles.find((a) => a.clauseRef === 'art.28');
      const a29 = out.legal.articles.find((a) => a.clauseRef === 'art.29');
      expect(a28.textAvailable).toBe(false);
      expect(a28.coverage).toBeNull();
      expect(a29.coverage).toBe('missing');
    });

    test('nessun testo evidenza: AI non chiamata ma articoli legge elencati senza verdetto', async () => {
      mockQueryLegalPath();
      extractDocumentText.mockResolvedValue({ text: null, reason: 'pdf_no_text_layer' });
      normBroker.getClauseText.mockResolvedValue({ text: 'Art. testo', title: 'T', fullRef: 'x', sourceUrl: null, source: 'local_db' });

      const out = await suggestForClause(1, 42, 610);
      expect(chat).not.toHaveBeenCalled();
      expect(out.legal).toBeDefined();
      expect(out.legal.evaluated).toBe(false);
      expect(out.legal.articles).toHaveLength(2);
    });
  });

  describe('suggestSalStatus - meta legislativa nel context summary', () => {
    test('context_summary segnala conformita legislativa quando valutata', async () => {
      mockQueryLegalPath();
      extractDocumentText.mockResolvedValue({ text: 'Evidenza con testo.' });
      normBroker.getClauseText.mockResolvedValue({ text: 'Art. 28 testo', title: 'T', fullRef: 'x', sourceUrl: null, source: 'local_db' });
      chat.mockResolvedValue({
        content: JSON.stringify({
          suggestedStatus: 'completed', confidence: 'high', rationale: 'ok', evidenceRefs: [10],
          legalConfidence: 'high',
          legalConformity: [{ articleRef: 'D.Lgs. 81/2008 art.28', coverage: 'covered', gap: '', rationale: 'r' }],
        }),
        model: 'gemini', tokens: { input: 100, output: 30 },
      });

      const res = await suggestSalStatus({ organizationId: 1, companyId: 42, normRequirementId: 610 });
      expect(res.meta.contextSummary).toMatch(/conformita legislativa/i);
      expect(res.data.suggestions[0].legal.evaluated).toBe(true);
    });
  });
});
