jest.mock('../services/aiProviderAdapter', () => ({
  chat: jest.fn(),
  getActiveProvider: jest.fn(),
}));

jest.mock('../services/aiContextBuilder.service', () => ({
  buildReviewRequirementsContext: jest.fn(),
  buildAuditConclusionsContext: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const { chat, getActiveProvider } = require('../services/aiProviderAdapter');
const contextBuilder = require('../services/aiContextBuilder.service');
const { suggest } = require('./aiAssist.controller');

function createRes() {
  const res = {
    statusCode: 200,
  };
  res.status = jest.fn(function status(code) {
    this.statusCode = code;
    return this;
  });
  res.json = jest.fn(function json() {
    return this;
  });
  return res;
}

describe('aiAssist.controller — suggest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns parsed suggestion for feature audit_conclusions', async () => {
    getActiveProvider.mockReturnValue('gemini');
    contextBuilder.buildAuditConclusionsContext.mockReturnValue({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      contextSummary: 'Audit conclusions for ISO_9001_2015, NC:1',
    });
    chat.mockResolvedValue({
      content: '{"conclusion_text":"Verbale OK","recommendation":"conforme"}',
      model: 'gemini-pro',
      tokens: { input: 10, output: 20 },
      cost: 0.0001,
    });

    const req = {
      body: {
        feature: 'audit_conclusions',
        context: {
          auditMetrics: { total: 10, nc: 1, oss: 2, om: 0, conformities: 7 },
          standardCode: 'ISO_9001_2015',
          ncList: [{ clauseRef: '8.5.1', description: 'testo NC' }],
        },
      },
      user: { organization_id: 99 },
    };
    const res = createRes();

    await suggest(req, res);

    expect(contextBuilder.buildAuditConclusionsContext).toHaveBeenCalledWith(req.body.context);
    expect(chat).toHaveBeenCalledWith(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'usr' },
      ],
      { temperature: 0.3, responseFormat: 'json' }
    );
    expect(res.json).toHaveBeenCalledWith({
      feature: 'audit_conclusions',
      suggestion: {
        conclusion_text: 'Verbale OK',
        recommendation: 'conforme',
      },
      _aiMeta: {
        provider: 'gemini',
        model: 'gemini-pro',
        tokens: { input: 10, output: 20 },
        cost: 0.0001,
        contextSummary: 'Audit conclusions for ISO_9001_2015, NC:1',
      },
    });
  });

  it('returns 400 when feature is missing', async () => {
    getActiveProvider.mockReturnValue('gemini');
    const req = {
      body: { context: {} },
      user: { organization_id: 1 },
    };
    const res = createRes();

    await suggest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'feature e context sono obbligatori.',
      code: 'MISSING_PARAMS',
    });
    expect(chat).not.toHaveBeenCalled();
  });

  it('returns 503 when no AI provider is configured', async () => {
    getActiveProvider.mockReturnValue(null);
    const req = {
      body: {
        feature: 'audit_conclusions',
        context: {
          auditMetrics: { total: 1, nc: 0, oss: 0, om: 0, conformities: 1 },
          standardCode: 'ISO_9001_2015',
        },
      },
      user: { organization_id: 1 },
    };
    const res = createRes();

    await suggest(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Nessun provider AI configurato.',
      code: 'AI_NOT_CONFIGURED',
    });
    expect(chat).not.toHaveBeenCalled();
  });

  it('wraps non-JSON AI output in suggestion.raw', async () => {
    getActiveProvider.mockReturnValue('gemini');
    contextBuilder.buildAuditConclusionsContext.mockReturnValue({
      systemPrompt: 's',
      userPrompt: 'u',
      contextSummary: 'sum',
    });
    chat.mockResolvedValue({
      content: '```json\nnot valid json!!!\n```',
      model: 'm',
      tokens: {},
      cost: 0,
    });

    const req = {
      body: {
        feature: 'audit_conclusions',
        context: {
          auditMetrics: { total: 1, nc: 0, oss: 0, om: 0, conformities: 1 },
          standardCode: 'X',
        },
      },
      user: { organization_id: 1 },
    };
    const res = createRes();

    await suggest(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestion: { raw: 'not valid json!!!' },
      })
    );
  });
});
