/**
 * Fase 1: suggest_questions non manda anagrafica/allegati al modello.
 * Chiama handleQuestionAssistant senza passare dalle routes (stesso pattern del test privacy).
 */
jest.mock('../config/database', () => ({ query: jest.fn().mockResolvedValue({ recordset: [] }) }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/aiProviderAdapter', () => ({
  chat: jest.fn().mockResolvedValue({
    content: 'Chiedi chi decide le risorse e dove è scritto.',
    model: 'test',
    tokens: { input: 1, output: 1 },
    cost: 0,
  }),
}));
jest.mock('./aiChat.controller', () => ({
  checkNormSourceAvailability: jest.fn().mockResolvedValue({ has_chunks: false }),
}));
jest.mock('../services/normChunker.service', () => ({ searchSimilar: jest.fn().mockResolvedValue([]) }));
jest.mock('../services/documentTextExtractor.service', () => ({ extractDocumentText: jest.fn() }));
jest.mock('../services/moduleLicense.service', () => ({ hasLicensedModule: jest.fn().mockReturnValue(true) }));

const { chat } = require('../services/aiProviderAdapter');
const { hasLicensedModule } = require('../services/moduleLicense.service');
const { handleQuestionAssistant, unwrapChatContent } = require('./questionAssistant.controller');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('POST question-assistant suggest_questions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invia al modello solo norma/clausola/testo/esito/note', async () => {
    const res = mockRes();
    await handleQuestionAssistant(
      {
        user: { id: 1, organization_id: 1001 },
        body: {
          mode: 'suggest_questions',
          question: {
            text: 'Le risorse sono determinate?',
            clauseRef: '7.1.2',
            currentStatus: 'C',
            notes: 'Piano 2026 presente',
            standardCode: 'ISO_9001_2015',
            standardLabel: '9001',
            vat_number: 'IT12345678901',
            companyName: 'Cliente Spa',
          },
          attachments: [{ name: 'visura-cliente.pdf', type: 'application/pdf' }],
          auditContext: {
            companyId: 42,
            vat_number: 'IT00011122233',
            companyName: 'Cliente Spa',
            address: 'Via Lunga 9',
          },
        },
      },
      res
    );

    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.answer).toContain('risorse');
    expect(body.data.mode).toBe('suggest_questions');

    const sent = JSON.stringify(chat.mock.calls[0][0]);
    expect(sent).toContain('7.1.2');
    expect(sent).toContain('Le risorse sono determinate?');
    expect(sent).toContain('Piano 2026 presente');
    expect(sent).not.toContain('IT12345678901');
    expect(sent).not.toContain('IT00011122233');
    expect(sent).not.toContain('Cliente Spa');
    expect(sent).not.toContain('Via Lunga');
    expect(sent).not.toContain('visura-cliente.pdf');
  });

  it('senza licenza risponde 403 e non chiama il modello', async () => {
    hasLicensedModule.mockReturnValueOnce(false);
    const res = mockRes();
    await handleQuestionAssistant(
      {
        user: { id: 1, organization_id: 1001 },
        body: {
          mode: 'suggest_questions',
          question: { text: 'Domanda', clauseRef: '4.1' },
        },
      },
      res
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(chat).not.toHaveBeenCalled();
  });

  it('unwrapChatContent accetta stringa o oggetto adapter', () => {
    expect(unwrapChatContent('ciao')).toBe('ciao');
    expect(unwrapChatContent({ content: 'ok' })).toBe('ok');
    expect(unwrapChatContent(null)).toBe('');
  });

  it('senza standard (custom / assente) non cerca RAG né inventa ISO_9001 e non allerta admin', async () => {
    const { checkNormSourceAvailability } = require('./aiChat.controller');
    const { searchSimilar } = require('../services/normChunker.service');
    const { query } = require('../config/database');
    const res = mockRes();
    await handleQuestionAssistant(
      {
        user: { id: 1, organization_id: 1001 },
        body: {
          mode: 'suggest_questions',
          question: {
            text: 'Avete il registro presenze?',
            clauseRef: 'A.1',
            standardCode: 'custom',
          },
        },
      },
      res
    );

    expect(res.json).toHaveBeenCalled();
    expect(checkNormSourceAvailability).not.toHaveBeenCalled();
    expect(searchSimilar).not.toHaveBeenCalled();
    const sent = JSON.stringify(chat.mock.calls[0][0]);
    expect(sent).toMatch(/non indicata/i);
    expect(sent).not.toContain('custom');
    expect(sent).not.toContain('ISO_9001_2015');

    const sqlBlob = query.mock.calls
      .map((c) => `${c[0]} ${JSON.stringify(c[1] || {})}`)
      .join('\n');
    expect(sqlBlob).not.toMatch(/ai_assistant_notifications/);
    expect(sqlBlob).not.toMatch(/ai_usage_no_source/);
    expect(sqlBlob).not.toMatch(/"stdCode":"custom"/);
  });

  it('senza campo standard procede con conoscenze generali', async () => {
    const { checkNormSourceAvailability } = require('./aiChat.controller');
    const res = mockRes();
    await handleQuestionAssistant(
      {
        user: { id: 1, organization_id: 1001 },
        body: {
          mode: 'suggest_questions',
          question: { text: 'Domanda libera', clauseRef: 'B.2' },
        },
      },
      res
    );
    expect(res.json).toHaveBeenCalled();
    expect(checkNormSourceAvailability).not.toHaveBeenCalled();
    const sent = JSON.stringify(chat.mock.calls[0][0]);
    expect(sent).toMatch(/non indicata/i);
    expect(sent).not.toContain('ISO_9001_2015');
  });
});
