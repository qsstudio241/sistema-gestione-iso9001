/**
 * @jest-environment node
 */

/* eslint-env jest */

const { mapMessagesToGemini, embed: geminiEmbed } = require('./adapters/geminiAdapter');
const keyPool = require('./adapters/geminiKeyPool');
const anthropicKeyPool = require('./adapters/anthropicKeyPool');
const openaiAdapter = require('./adapters/openaiAdapter');
const aiProviderAdapter = require('./aiProviderAdapter');

const ENV_KEYS = [
  'GEMINI_API_KEY',
  'GEMINI_API_KEYS',
  'GEMINI_MODEL',
  'GEMINI_MAX_ATTEMPTS',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_API_KEYS',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_MAX_ATTEMPTS',
  'AI_ANTHROPIC_FALLBACK',
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
  keyPool.resetKeyPoolState();
  anthropicKeyPool.resetKeyPoolState();
}

describe('getActiveProvider cascade', () => {
  beforeEach(() => {
    clearAiEnv();
    jest.restoreAllMocks();
  });

  test('uses Anthropic when Gemini absent and ANTHROPIC_API_KEY set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(aiProviderAdapter.getActiveProvider()).toBe('anthropic');
  });

  test('prefers Gemini when both Gemini and Anthropic keys are set', () => {
    process.env.GEMINI_API_KEY = 'g-key';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(aiProviderAdapter.getActiveProvider()).toBe('gemini');
  });

  test('prefers Gemini when GEMINI_API_KEYS is set without primary key', () => {
    process.env.GEMINI_API_KEYS = 'secondary-key';
    expect(aiProviderAdapter.getActiveProvider()).toBe('gemini');
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

  test('Gemini path: falls back to Anthropic when all Gemini keys are exhausted', async () => {
    process.env.GEMINI_API_KEY = 'key-primary';
    process.env.GEMINI_MAX_ATTEMPTS = '1';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-fallback';
    process.env.ANTHROPIC_MODEL = 'claude-test';

    const quotaError = {
      ok: false,
      status: 429,
      headers: { get: () => null },
      json: async () => ({
        error: { message: 'GenerateRequestsPerDayPerProjectPerModel daily quota exceeded' },
      }),
    };
    const anthropicOk = {
      ok: true,
      status: 200,
      json: async () => ({
        model: 'claude-test',
        content: [{ type: 'text', text: 'risposta-claude' }],
        usage: { input_tokens: 2, output_tokens: 3 },
      }),
    };

    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(quotaError)
      .mockResolvedValueOnce(anthropicOk);

    const res = await aiProviderAdapter.chat(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'ciao' },
      ],
      { timeout: 5000, responseFormat: 'json' }
    );

    expect(res.content).toBe('risposta-claude');
    expect(res.provider).toBe('anthropic');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1][0])).toContain('/v1/messages');
  });

  test('Gemini path: switches API key when primary quota is exhausted', async () => {
    process.env.GEMINI_API_KEY = 'key-primary';
    process.env.GEMINI_API_KEYS = 'key-secondary';
    process.env.GEMINI_MAX_ATTEMPTS = '1';

    const quotaError = {
      ok: false,
      status: 429,
      headers: { get: () => null },
      json: async () => ({
        error: { message: 'GenerateRequestsPerDayPerProjectPerModel daily quota exceeded' },
      }),
    };
    const okResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'ok-secondary' }], role: 'model' } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      }),
    };

    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(quotaError)
      .mockResolvedValueOnce(okResponse);

    const res = await aiProviderAdapter.chat(
      [{ role: 'user', content: 'go' }],
      { timeout: 5000 }
    );

    expect(res.content).toBe('ok-secondary');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('key=key-primary');
    expect(String(fetchSpy.mock.calls[1][0])).toContain('key=key-secondary');
  });

  test('Gemini path: retries on 503 then succeeds (model overloaded)', async () => {
    process.env.GEMINI_API_KEY = 'gk';
    process.env.GEMINI_MAX_ATTEMPTS = '3';

    const okResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'ok' }], role: 'model' } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      }),
    };
    const overloadedResponse = {
      ok: false,
      status: 503,
      headers: { get: () => '0' },
      json: async () => ({ error: { message: 'model overloaded' } }),
    };

    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(overloadedResponse)
      .mockResolvedValueOnce(overloadedResponse)
      .mockResolvedValueOnce(okResponse);

    const res = await aiProviderAdapter.chat(
      [{ role: 'user', content: 'go' }],
      { timeout: 5000 }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(res.content).toBe('ok');
  }, 10000);

  test('Gemini path: gives up after maxAttempts on persistent 503', async () => {
    process.env.GEMINI_API_KEY = 'gk';
    process.env.GEMINI_MAX_ATTEMPTS = '2';

    const overloadedResponse = {
      ok: false,
      status: 503,
      headers: { get: () => '0' },
      json: async () => ({ error: { message: 'model overloaded' } }),
    };

    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(overloadedResponse);

    await expect(
      aiProviderAdapter.chat([{ role: 'user', content: 'go' }], { timeout: 5000 })
    ).rejects.toMatchObject({ code: 'AI_UPSTREAM_ERROR', status: 503 });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  }, 10000);

  test('Gemini path: non-retryable status (400) is not retried', async () => {
    process.env.GEMINI_API_KEY = 'gk';
    process.env.GEMINI_MAX_ATTEMPTS = '3';

    const badRequest = {
      ok: false,
      status: 400,
      headers: { get: () => null },
      json: async () => ({ error: { message: 'bad payload' } }),
    };

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(badRequest);

    await expect(
      aiProviderAdapter.chat([{ role: 'user', content: 'go' }], { timeout: 5000 })
    ).rejects.toMatchObject({ code: 'AI_UPSTREAM_ERROR', status: 400 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
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

describe('geminiAdapter.embed difensivo (timeout + rate-limit)', () => {
  beforeEach(() => {
    clearAiEnv();
    delete process.env.GEMINI_EMBED_TIMEOUT_MS;
    delete process.env.GEMINI_EMBED_MODEL;
    jest.restoreAllMocks();
  });

  test('passa un AbortSignal e aborta in modo pulito se il provider non risponde', async () => {
    process.env.GEMINI_API_KEY = 'gk';
    process.env.GEMINI_EMBED_TIMEOUT_MS = '50';

    // Provider "lento": la fetch si risolve solo quando viene abortita dal timeout.
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const onAbort = () =>
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        if (init && init.signal) {
          if (init.signal.aborted) return onAbort();
          init.signal.addEventListener('abort', onAbort);
        }
        // altrimenti non si risolve mai (simula hang)
      });
    });

    await expect(geminiEmbed(['testo da indicizzare'])).rejects.toMatchObject({
      code: 'AI_REQUEST_FAILED',
    });
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.signal).toBeDefined();
  }, 10000);

  test('skip pulito nel job: chi chiama (try/catch indexer) prosegue dopo il timeout', async () => {
    process.env.GEMINI_API_KEY = 'gk';
    process.env.GEMINI_EMBED_TIMEOUT_MS = '50';

    jest.spyOn(global, 'fetch').mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const onAbort = () =>
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        if (init && init.signal) {
          if (init.signal.aborted) return onAbort();
          init.signal.addEventListener('abort', onAbort);
        }
      });
    });

    // Replica la gestione errori dell'indexer: in caso di errore embed,
    // vettori = null e il job prosegue senza bloccarsi.
    const batch = ['c1', 'c2'];
    let vectors;
    let jobContinued = false;
    try {
      vectors = await geminiEmbed(batch);
    } catch {
      vectors = batch.map(() => null);
    }
    jobContinued = true;

    expect(vectors).toEqual([null, null]);
    expect(jobContinued).toBe(true);
  }, 10000);

  test('429 TPM non marca la chiave: dopo i retry la stessa chiave resta usabile', async () => {
    process.env.GEMINI_API_KEY = 'gk-tpm';
    const keyPool = require('./adapters/geminiKeyPool');
    keyPool.resetKeyPoolState();

    const rateLimited = {
      ok: false,
      status: 429,
      headers: { get: () => '0' },
      json: async () => ({
        error: {
          message:
            'You exceeded your current quota. GenerateContentInputTokensPerMinute. Please try again later.',
        },
      }),
    };
    jest.spyOn(global, 'fetch').mockResolvedValue(rateLimited);

    await expect(geminiEmbed(['x'])).rejects.toMatchObject({
      code: 'AI_UPSTREAM_ERROR',
      status: 429,
    });
    expect(keyPool.isKeyExhausted(0)).toBe(false);
    expect(keyPool.buildKeyTryOrder(1)).toEqual([0]);
  }, 10000);

  test('403 quota/billing marca la chiave esaurita', async () => {
    process.env.GEMINI_API_KEY = 'gk-dead';
    process.env.GEMINI_API_KEYS = 'gk-other';
    const keyPool = require('./adapters/geminiKeyPool');
    keyPool.resetKeyPoolState();

    const forbidden = {
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({ error: { message: 'Permission denied' } }),
    };
    jest.spyOn(global, 'fetch').mockResolvedValue(forbidden);

    await expect(geminiEmbed(['x'])).rejects.toMatchObject({
      code: 'AI_UPSTREAM_ERROR',
      status: 403,
    });
    expect(keyPool.isKeyExhausted(0)).toBe(true);
    expect(keyPool.isKeyExhausted(1)).toBe(true);
  }, 10000);

  test('chat: 429 TPM ritenta la stessa chiave e non spegne Flash', async () => {
    process.env.GEMINI_API_KEY = 'gk-flash';
    keyPool.resetKeyPoolState();
    const limited = {
      ok: false,
      status: 429,
      headers: { get: () => '0' },
      json: async () => ({
        error: { message: 'Resource exhausted. TokensPerMinute. Please try again later.' },
      }),
    };
    const ok = {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'ok-flash' }], role: 'model' } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      }),
    };
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(limited)
      .mockResolvedValueOnce(ok);

    const res = await aiProviderAdapter.chat([{ role: 'user', content: 'x' }], { timeout: 5000 });
    expect(res.content).toBe('ok-flash');
    expect(keyPool.isKeyExhausted(0)).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  }, 10000);

  test('cap ai retry su 429: fallisce pulito invece di ciclare all\u2019infinito', async () => {
    process.env.GEMINI_API_KEY = 'gk';

    const rateLimited = {
      ok: false,
      status: 429,
      headers: { get: () => '0' }, // retry-after 0 => nessuna attesa reale
      json: async () => ({ error: { message: 'rate limit exceeded' } }),
    };
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(rateLimited);

    await expect(geminiEmbed(['x'])).rejects.toMatchObject({
      code: 'AI_UPSTREAM_ERROR',
      status: 429,
    });
    // 1 tentativo iniziale + 2 retry massimi = 3 chiamate, poi stop.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  }, 10000);
});
