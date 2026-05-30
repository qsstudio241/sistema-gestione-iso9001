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
    getActiveProvider.mockReturnValue('gemini');
    searchKnowledge.mockResolvedValue([{ id: 1, entity_type: 'audit_conclusion', chunk_text: 'test', score: 0.9 }]);
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
});
