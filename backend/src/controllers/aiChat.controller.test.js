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
}));

const { chat, getActiveProvider } = require('../services/aiProviderAdapter');
const { searchKnowledge } = require('../services/knowledgeIndexer.service');
const {
  loadStandardProfile,
  resolveStandardCodesForFilter,
  buildStandardContextBlock,
} = require('../services/aiStandardContext.service');
const { resolveAiCompanyScope } = require('../services/aiCompanyScope.service');
const { aiChat } = require('./aiChat.controller');

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

});
