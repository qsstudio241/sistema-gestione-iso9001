/**
 * @jest-environment node
 */

/* eslint-env jest */

const { mapMessagesToGemini } = require('./adapters/geminiAdapter');
const openaiAdapter = require('./adapters/openaiAdapter');
const aiProviderAdapter = require('./aiProviderAdapter');

const ENV_KEYS = [
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_DEPLOYMENT',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_IMPORT_MODEL',
  'AI_REQUEST_TIMEOUT_MS',
];

function clearAiEnv() {
  for (const k of ENV_KEYS) {
    delete process.env[k];
  }
}

describe('getActiveProvider cascade', () => {
  beforeEach(() => {
    clearAiEnv();
    jest.restoreAllMocks();
  });

  test('prefers Gemini when GEMINI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'sk-openai';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://x.openai.azure.com';
    process.env.AZURE_OPENAI_API_KEY = 'azure-key';
    process.env.GEMINI_API_KEY = 'g-key';
    expect(aiProviderAdapter.getActiveProvider()).toBe('gemini');
  });

  test('uses Azure when Gemini absent and Azure vars present', () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://x.openai.azure.com/';
    process.env.AZURE_OPENAI_API_KEY = 'azure-key';
    process.env.OPENAI_API_KEY = 'sk-openai';
    expect(aiProviderAdapter.getActiveProvider()).toBe('azure_openai');
  });

  test('falls back to OpenAI when only OPENAI_API_KEY', () => {
    process.env.OPENAI_API_KEY = 'sk-openai';
    expect(aiProviderAdapter.getActiveProvider()).toBe('openai');
  });

  test('returns null when nothing configured', () => {
    expect(aiProviderAdapter.getActiveProvider()).toBeNull();
  });

  test('Azure requires both endpoint and api key', () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://x.openai.azure.com';
    delete process.env.AZURE_OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk';
    expect(aiProviderAdapter.getActiveProvider()).toBe('openai');
  });
});

describe('mapMessagesToGemini', () => {
  test('maps system to systemInstruction and user/assistant to user/model', () => {
    const { systemInstruction, contents } = mapMessagesToGemini([
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
      { role: 'user', content: 'Bye' },
    ]);
    expect(systemInstruction).toEqual({
      parts: [{ text: 'Be brief.' }],
    });
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'Hello' }] },
      { role: 'model', parts: [{ text: 'Hi' }] },
      { role: 'user', parts: [{ text: 'Bye' }] },
    ]);
  });

  test('merges consecutive same-role messages', () => {
    const { contents } = mapMessagesToGemini([
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
    ]);
    expect(contents).toEqual([{ role: 'user', parts: [{ text: 'a\n\nb' }] }]);
  });
});

describe('openaiAdapter', () => {
  beforeEach(() => {
    clearAiEnv();
    jest.restoreAllMocks();
    process.env.OPENAI_API_KEY = 'sk-test';
  });

  test('sends response_format json_object when responseFormat is json', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{}' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2 },
        model: 'gpt-4o-mini',
      }),
    });

    await openaiAdapter.chat(
      [{ role: 'user', content: 'x' }],
      { responseFormat: 'json', timeout: 5000 }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });
});

describe('aiProviderAdapter.chat error handling', () => {
  beforeEach(() => {
    clearAiEnv();
    jest.restoreAllMocks();
  });

  test('throws AI_NOT_CONFIGURED when no keys present', async () => {
    await expect(
      aiProviderAdapter.chat([{ role: 'user', content: 'hi' }])
    ).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
  });

  test('OpenAI path: HTTP error maps to AI_UPSTREAM_ERROR', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'upstream' } }),
    });

    await expect(
      aiProviderAdapter.chat([{ role: 'user', content: 'x' }], {
        timeout: 5000,
      })
    ).rejects.toMatchObject({
      code: 'AI_UPSTREAM_ERROR',
      status: 503,
    });
  });

  test('OpenAI path: timeout maps to AI_REQUEST_FAILED', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    jest.spyOn(global, 'fetch').mockImplementation((_url, init) => {
      return new Promise((resolve, reject) => {
        const onAbort = () => {
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        };
        if (init && init.signal && init.signal.aborted) {
          onAbort();
          return;
        }
        if (init && init.signal) {
          init.signal.addEventListener('abort', onAbort);
        }
        setTimeout(() => {
          if (init && init.signal) {
            init.signal.removeEventListener('abort', onAbort);
          }
          resolve({
            ok: true,
            json: async () => ({
              choices: [{ message: { content: 'late' } }],
              usage: {},
            }),
          });
        }, 200);
      });
    });

    await expect(
      aiProviderAdapter.chat([{ role: 'user', content: 'x' }], {
        timeout: 20,
      })
    ).rejects.toMatchObject({ code: 'AI_REQUEST_FAILED' });
  }, 10000);

  test('Gemini path: builds payload with systemInstruction and json mime', async () => {
    process.env.GEMINI_API_KEY = 'gk';
    process.env.GEMINI_MODEL = 'gemini-test';

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: { parts: [{ text: '{"a":1}' }], role: 'model' },
          },
        ],
        usageMetadata: {
          promptTokenCount: 3,
          candidatesTokenCount: 4,
        },
      }),
    });

    const res = await aiProviderAdapter.chat(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'go' },
      ],
      { responseFormat: 'json', timeout: 5000 }
    );

    expect(res.content).toBe('{"a":1}');
    expect(res.tokens).toEqual({ input: 3, output: 4 });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain('models/gemini-test:generateContent');
    expect(url).toContain('key=gk');
    const body = JSON.parse(init.body);
    expect(body.systemInstruction).toEqual({
      parts: [{ text: 'sys' }],
    });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  test('Azure path: uses api-key header and returns normalized shape', async () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://my.resource.azure.com';
    process.env.AZURE_OPENAI_API_KEY = 'ak';
    process.env.AZURE_OPENAI_DEPLOYMENT = 'deploy-1';

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'ok-azure' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
        model: 'deploy-1',
      }),
    });

    const res = await aiProviderAdapter.chat(
      [{ role: 'user', content: 'h' }],
      { timeout: 5000 }
    );
    expect(res).toMatchObject({
      content: 'ok-azure',
      tokens: { input: 10, output: 20 },
      cost: 0,
    });

    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(
      'https://my.resource.azure.com/openai/deployments/deploy-1/chat/completions?api-version=2024-08-01-preview'
    );
    const hdrs = init.headers;
    const apiKeyHeader =
      hdrs && typeof hdrs.get === 'function'
        ? hdrs.get('api-key')
        : hdrs['api-key'];
    expect(apiKeyHeader).toBe('ak');
  });

  test('empty assistant content yields AI_EMPTY_RESPONSE', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '   ' } }],
        usage: {},
      }),
    });

    await expect(
      aiProviderAdapter.chat([{ role: 'user', content: 'x' }], {
        timeout: 5000,
      })
    ).rejects.toMatchObject({ code: 'AI_EMPTY_RESPONSE' });
  });

  test('chatStream delegates to chat and invokes onChunk', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'full' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        model: 'gpt-4o-mini',
      }),
    });

    const chunks = [];
    const out = await aiProviderAdapter.chatStream(
      [{ role: 'user', content: 'x' }],
      (c) => chunks.push(c)
    );
    expect(out.content).toBe('full');
    expect(chunks).toEqual(['full']);
  });

  test('default timeout uses AI_REQUEST_TIMEOUT_MS', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.AI_REQUEST_TIMEOUT_MS = '77777';

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
        usage: {},
        model: 'gpt-4o-mini',
      }),
    });

    await aiProviderAdapter.chat([{ role: 'user', content: 'x' }]);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.signal).toBeDefined();
  });
});
