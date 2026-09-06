jest.mock('../services/aiProviderAdapter', () => ({
  chat: jest.fn(),
  getActiveProvider: jest.fn(),
}));

jest.mock('../services/knowledgeIndexer.service', () => ({
  searchKnowledge: jest.fn(),
}));

jest.mock('../services/aiOrganizationContext.service', () => ({
  enrichSystemPromptWithOrganization: jest.fn(async (prompt) => prompt),
}));

jest.mock('../services/aiStandardContext.service', () => ({
  loadStandardProfile: jest.fn(),
  resolveStandardCodesForFilter: jest.fn(),
  buildStandardContextBlock: jest.fn(),
}));

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../services/aiCompanyScope.service', () => ({
  resolveAiCompanyScope: jest.fn(),
}));

jest.mock('../services/companyAccess.service', () => ({
  sendAccessDenied: jest.fn((res, denied) => res.status(denied.status).json(denied.body)),
}));

jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../services/ambitoFacts.service', () => {
  const actual = jest.requireActual('../services/ambitoFacts.service');
  return {
    ...actual,
    loadAmbitoFacts: jest.fn(),
  };
});

jest.mock('../services/normBroker.service', () => ({
  resolveClauseText: jest.fn(),
}));

jest.mock('../services/librarySourceRequest.service', () => ({
  processGapsFromChat: jest.fn(async () => []),
}));

const { chat, getActiveProvider } = require('../services/aiProviderAdapter');
const { searchKnowledge } = require('../services/knowledgeIndexer.service');
const {
  loadStandardProfile,
  resolveStandardCodesForFilter,
  buildStandardContextBlock,
} = require('../services/aiStandardContext.service');
const { resolveAiCompanyScope } = require('../services/aiCompanyScope.service');
const { loadAmbitoFacts } = require('../services/ambitoFacts.service');
const { resolveClauseText } = require('../services/normBroker.service');
const { processGapsFromChat } = require('../services/librarySourceRequest.service');
const { aiChat, getAmbitoFacts } = require('./aiChat.controller');

function createRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn(function status(code) {
    this.statusCode = code;
    return this;
  });
  res.json = jest.fn(function json() {
    return this;
  });
  return res;
}

describe('aiChat.controller — aiChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveAiCompanyScope.mockResolvedValue({ companyId: null, denied: null });
    getActiveProvider.mockReturnValue('gemini');
    searchKnowledge.mockResolvedValue([
      { id: 1, entity_type: 'audit_conclusion', entity_id: 1, chunk_text: 'Audit 2024-01 del 2024-01-15', score: 0.9 },
    ]);
    chat.mockResolvedValue({
      content: 'Risposta di test',
      model: 'gemini-pro',
      tokens: { input: 10, output: 20 },
      cost: 0.0001,
    });
    loadStandardProfile.mockResolvedValue({
      standard_id: 1,
      standard_code: 'ISO_9001_2015',
      standard_name: 'ISO 9001',
      standard_full_name: 'ISO 9001:2015',
    });
    resolveStandardCodesForFilter.mockReturnValue(['ISO_9001', 'ISO_9001_2015']);
    buildStandardContextBlock.mockReturnValue('\n--- NORMA ATTIVA ---\nISO 9001\n');
    resolveClauseText.mockResolvedValue({
      hit: { text: 'Testo clausola in archivio', title: 'Documentazione', source: 'local_db' },
      textAvailable: true,
      absentMessage: null,
      code: null,
    });
  });

  it('passes standardId filter to searchKnowledge when provided', async () => {
    const req = {
      body: { message: 'Quante NC?', standardId: 1 },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();

    await aiChat(req, res);

    expect(loadStandardProfile).toHaveBeenCalledWith(1);
    expect(buildStandardContextBlock).toHaveBeenCalled();
    expect(searchKnowledge).toHaveBeenCalledWith(
      'Quante NC?',
      99,
      expect.objectContaining({
        standardId: 1,
        standardCodes: ['ISO_9001', 'ISO_9001_2015'],
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        reply: 'Risposta di test',
        standardId: 1,
        sourcesCount: 1,
        citations: [
          expect.objectContaining({
            entityType: 'audit_conclusion',
            entityId: '1',
            label: expect.any(String),
            score: 0.9,
          }),
        ],
      })
    );
  });

  it('returns empty citations when searchKnowledge finds nothing', async () => {
    searchKnowledge.mockResolvedValue([]);
    const req = {
      body: { message: 'Domanda generica' },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();

    await aiChat(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        citations: [],
        sourcesCount: 0,
        contextUsed: 0,
      })
    );
  });

  it('gracefully skips standard filter when standardId is absent', async () => {
    const req = {
      body: { message: 'Stato audit' },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();

    await aiChat(req, res);

    expect(loadStandardProfile).not.toHaveBeenCalled();
    expect(searchKnowledge).toHaveBeenCalledWith(
      'Stato audit',
      99,
      expect.objectContaining({
        standardId: null,
        standardCodes: [],
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ standardId: null })
    );
  });

  it('proceeds without standard block when profile is not found', async () => {
    loadStandardProfile.mockResolvedValue(null);
    const req = {
      body: { message: 'Domanda', standardId: 999 },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();

    await aiChat(req, res);

    expect(buildStandardContextBlock).not.toHaveBeenCalled();
    expect(searchKnowledge).toHaveBeenCalledWith(
      'Domanda',
      99,
      expect.objectContaining({ standardId: null })
    );
  });

  it('adds audit focus block when clauseRef is provided', async () => {
    const req = {
      body: {
        message: 'Cosa dice la norma?',
        auditId: 'uuid-audit-1',
        clauseRef: '7.5',
        questionId: '2',
        questionText: 'Documentazione controllata',
        standardKey: 'ISO_9001',
      },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();

    await aiChat(req, res);

    expect(chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('CONTESTO AUDIT APERTO'),
        }),
      ]),
      expect.any(Object)
    );
    expect(chat.mock.calls[0][0][0].content).toContain('7.5');
    expect(resolveClauseText).toHaveBeenCalledWith(
      'ISO_9001',
      '7.5',
      expect.objectContaining({ organizationId: 99 })
    );
    expect(res.json.mock.calls[0][0].normAbsent).toBeUndefined();
  });

  it('con clausola assente: chat resta attiva, avviso onesto, nessuna allucinazione di testo norma', async () => {
    const absentMsg = 'Il testo di ISO 9712 2022 §8.2 non è presente nell\'archivio locale. Non valuto a caso.';
    resolveClauseText.mockResolvedValue({
      hit: null,
      textAvailable: false,
      absentMessage: absentMsg,
      code: 'NORM_TEXT_ABSENT',
    });
    chat.mockResolvedValue({
      content: 'Posso aiutarti sui dati aziendali indicizzati.',
      model: 'gemini-pro',
      tokens: { input: 10, output: 20 },
      cost: 0.0001,
    });

    const req = {
      body: {
        message: 'Cosa dice la clausola 8.2?',
        clauseRef: '8.2',
        standardKey: 'ISO_9712_2022',
      },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();

    await aiChat(req, res);

    const systemContent = chat.mock.calls[0][0][0].content;
    expect(systemContent).toContain('NORMA ASSENTE');
    expect(systemContent).toContain(absentMsg);
    expect(systemContent).toMatch(/NON citare/);
    expect(chat).toHaveBeenCalled();

    const body = res.json.mock.calls[0][0];
    expect(body.reply).toContain(absentMsg);
    expect(body.reply).toContain('Posso aiutarti sui dati aziendali indicizzati.');
    expect(body.normAbsent).toEqual(expect.objectContaining({
      code: 'NORM_TEXT_ABSENT',
      textAvailable: false,
      clauseRef: '8.2',
      standardCode: 'ISO_9712_2022',
    }));
    expect(body.reply).not.toMatch(/il requisito della clausola 8\.2 è/i);
  });

  it('LG-1: estrae blocco SGQ_SOURCE_GAPS, pulisce reply e persiste', async () => {
    chat.mockResolvedValue({
      content: `Serve la ISO 14555 per i range.

<<<SGQ_SOURCE_GAPS
[{"code":"ISO 14555:2025","title":"Stud welding","reason":"range piega","qualityNotes":"verificare Tabella 2","closurePath":"platform"}]
SGQ_SOURCE_GAPS>>>`,
      model: 'gemini-pro',
      tokens: { input: 10, output: 20 },
      cost: 0.0001,
    });
    processGapsFromChat.mockResolvedValue([
      {
        created: true,
        emailed: true,
        row: {
          id: 42,
          source_code: 'ISO 14555:2025',
          source_title: 'Stud welding',
          reason: 'range piega',
          quality_notes: 'verificare Tabella 2',
          closure_path: 'platform',
          status: 'open',
        },
      },
    ]);

    const req = {
      body: { message: 'Range stud welding?' },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();
    await aiChat(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.reply).toContain('Serve la ISO 14555');
    expect(body.reply).not.toContain('SGQ_SOURCE_GAPS');
    expect(processGapsFromChat).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          code: 'ISO 14555:2025',
          closurePath: 'platform',
        }),
      ],
      expect.objectContaining({ organizationId: 99, userId: 5 })
    );
    expect(body.sourceGaps).toEqual([
      expect.objectContaining({
        id: 42,
        code: 'ISO 14555:2025',
        emailed: true,
      }),
    ]);
  });

  it('returns 403 when company scope is denied (studio fuori ambito)', async () => {
    resolveAiCompanyScope.mockResolvedValue({
      companyId: null,
      denied: { status: 403, body: { error: 'Azienda non nel tuo ambito studio', code: 'FORBIDDEN' } },
    });
    const req = {
      body: { message: 'Quante NC?', companyId: 99 },
      user: { organization_id: 99, user_id: 5, auditor_org_id: 10 },
    };
    const res = createRes();
    await aiChat(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(chat).not.toHaveBeenCalled();
  });

  it('forza lo scope sulla azienda del cliente e filtra il RAG su quella company', async () => {
    // Cliente azienda: lo scope service forza la sua azienda (45) ignorando il companyId del client.
    resolveAiCompanyScope.mockResolvedValue({ companyId: 45, denied: null });
    const req = {
      body: { message: 'Quante NC aperte?', companyId: 99 },
      user: { organization_id: 99, user_id: 5, company_access: [{ company_id: 45, permission: 'read' }] },
    };
    const res = createRes();
    await aiChat(req, res);
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(searchKnowledge).toHaveBeenCalledWith(
      'Quante NC aperte?',
      99,
      expect.objectContaining({ companyId: 45 })
    );
  });

  it('passes resolved companyId to searchKnowledge for studio user', async () => {
    resolveAiCompanyScope.mockResolvedValue({ companyId: 45, denied: null });
    const req = {
      body: { message: 'Documenti in scadenza', companyId: 45 },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();
    await aiChat(req, res);
    expect(searchKnowledge).toHaveBeenCalledWith(
      'Documenti in scadenza',
      99,
      expect.objectContaining({ companyId: 45 })
    );
  });

  it('injects learned preferences from rephrased feedback into system prompt', async () => {
    const { query: dbQuery } = require('../config/database');
    dbQuery.mockResolvedValueOnce({
      recordset: [
        {
          feature: 'audit_conclusions',
          action: 'rephrased',
          ai_text: 'L\'audit mostra conformita\'.',
          final_text: 'L\'audit ha evidenziato piena conformita\' ai requisiti ISO 9001:2015.',
          context_summary: 'Audit 2024-03',
        },
      ],
    });

    const req = {
      body: { message: 'Scrivi le conclusioni' },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();
    await aiChat(req, res);

    expect(chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('PREFERENZE APPRESE'),
        }),
      ]),
      expect.any(Object)
    );
    const systemContent = chat.mock.calls[0][0][0].content;
    expect(systemContent).toContain('Corretto in:');
  });

  it('skips feedback enrichment gracefully when query fails', async () => {
    const { query: dbQuery } = require('../config/database');
    dbQuery.mockRejectedValueOnce(new Error('ai_feedback table missing'));

    const req = {
      body: { message: 'Domanda senza feedback' },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();
    await aiChat(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ reply: 'Risposta di test' })
    );
  });

  it('does not inject preferences block when no rephrased feedback exists', async () => {
    const { query: dbQuery } = require('../config/database');
    dbQuery.mockResolvedValueOnce({ recordset: [] });

    const req = {
      body: { message: 'Domanda' },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();
    await aiChat(req, res);

    const systemContent = chat.mock.calls[0][0][0].content;
    expect(systemContent).not.toContain('PREFERENZE APPRESE');
  });

});

describe('aiChat.controller — getAmbitoFacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when company scope is denied', async () => {
    resolveAiCompanyScope.mockResolvedValue({
      companyId: null,
      denied: { status: 403, body: { error: 'Forbidden', code: 'FORBIDDEN' } },
    });
    const req = {
      query: { companyId: '99' },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();
    await getAmbitoFacts(req, res);
    expect(res.statusCode).toBe(403);
    expect(loadAmbitoFacts).not.toHaveBeenCalled();
  });

  it('returns snapshot when scope is allowed', async () => {
    resolveAiCompanyScope.mockResolvedValue({ companyId: 11, denied: null });
    loadAmbitoFacts.mockResolvedValue({
      ready: true,
      companyId: 11,
      companyName: 'Mason',
      counts: { ncOpen: 1, qualsExpiring30: 0, docsExpiring30: 2 },
    });
    const req = {
      query: { companyId: '11' },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();
    await getAmbitoFacts(req, res);
    expect(loadAmbitoFacts).toHaveBeenCalledWith(req.user, 11);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ ready: true, companyId: 11 }),
    });
  });
});

describe('aiChat.controller — SB-3 fatti Ambito nel prompt', () => {
  const { query } = require('../config/database');

  beforeEach(() => {
    jest.clearAllMocks();
    resolveAiCompanyScope.mockResolvedValue({ companyId: null, denied: null });
    getActiveProvider.mockReturnValue('gemini');
    searchKnowledge.mockResolvedValue([]);
    chat.mockResolvedValue({
      content: 'Risposta',
      model: 'gemini-pro',
      tokens: { input: 1, output: 2 },
      cost: 0,
    });
    loadStandardProfile.mockResolvedValue(null);
    resolveStandardCodesForFilter.mockReturnValue([]);
    buildStandardContextBlock.mockReturnValue('');
    resolveClauseText.mockResolvedValue({
      hit: null,
      textAvailable: true,
      absentMessage: null,
      code: null,
    });
    query.mockResolvedValue({ recordset: [] });
  });

  it('con companyId inietta i fatti SQL nel system prompt (Mason non Camellini)', async () => {
    resolveAiCompanyScope.mockResolvedValue({ companyId: 11, denied: null });
    query.mockResolvedValueOnce({
      recordset: [{ name: 'Mason', vat_number: null, sector: null, address: null }],
    });
    loadAmbitoFacts.mockResolvedValue({
      ready: true,
      companyId: 11,
      companyName: 'Mason',
      counts: { ncOpen: 5, qualsExpiring30: 2, docsExpiring30: 1 },
    });

    const req = {
      body: { message: 'Quante NC aperte?', companyId: 11 },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();
    await aiChat(req, res);

    expect(loadAmbitoFacts).toHaveBeenCalledWith(req.user, 11);
    const systemContent = chat.mock.calls[0][0][0].content;
    expect(systemContent).toContain('FATTI AMBITO');
    expect(systemContent).toContain('company_id=11');
    expect(systemContent).toContain('NC aperte: 5');
    expect(systemContent).toContain('Mason');
    expect(systemContent).not.toContain('Camellini');
    expect(systemContent).not.toContain('company_id=22');
  });

  it('senza companyId non chiama loadAmbitoFacts e non inietta il blocco', async () => {
    resolveAiCompanyScope.mockResolvedValue({ companyId: null, denied: null });
    const req = {
      body: { message: 'Ciao' },
      user: { organization_id: 99, auditor_org_id: 10, user_id: 5 },
    };
    const res = createRes();
    await aiChat(req, res);

    expect(loadAmbitoFacts).not.toHaveBeenCalled();
    const systemContent = chat.mock.calls[0][0][0].content;
    expect(systemContent).not.toContain('FATTI AMBITO');
  });
});
