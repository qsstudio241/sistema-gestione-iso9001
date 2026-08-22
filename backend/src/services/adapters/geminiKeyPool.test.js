/**
 * @jest-environment node
 */

/* eslint-env jest */

const keyPool = require('./geminiKeyPool');

const ENV_KEYS = ['GEMINI_API_KEY', 'GEMINI_API_KEYS'];

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
  keyPool.resetKeyPoolState();
}

describe('geminiKeyPool', () => {
  beforeEach(() => {
    clearEnv();
  });

  test('getGeminiApiKeys: GEMINI_API_KEY singola', () => {
    process.env.GEMINI_API_KEY = 'key-a';
    expect(keyPool.getGeminiApiKeys()).toEqual(['key-a']);
    expect(keyPool.hasGeminiApiKeys()).toBe(true);
  });

  test('getGeminiApiKeys: primaria + GEMINI_API_KEYS deduplicate', () => {
    process.env.GEMINI_API_KEY = 'key-a';
    process.env.GEMINI_API_KEYS = 'key-b, key-a ; key-c';
    expect(keyPool.getGeminiApiKeys()).toEqual(['key-a', 'key-b', 'key-c']);
  });

  test('isQuotaExhaustedError: 429 TPM/rate non marca la chiave, 403 e PerDay sì', () => {
    const asErr = (status, message) =>
      Object.assign(new Error(message), { status });

    expect(
      keyPool.isQuotaExhaustedError(
        asErr(
          429,
          'You exceeded your current quota, please check your plan and billing details. Quota metric GenerateContentInputTokensPerMinute.'
        )
      )
    ).toBe(false);
    expect(
      keyPool.isQuotaExhaustedError(asErr(429, 'Resource has been exhausted. Please try again later.'))
    ).toBe(false);
    expect(keyPool.isQuotaExhaustedError(asErr(429, 'rate limit exceeded'))).toBe(false);
    expect(keyPool.isQuotaExhaustedError(asErr(429, 'Too many requests'))).toBe(false);
    expect(
      keyPool.isQuotaExhaustedError(
        asErr(429, 'You exceeded your current quota, please check your plan and billing details.')
      )
    ).toBe(false);

    expect(keyPool.isQuotaExhaustedError(asErr(403, 'Permission denied'))).toBe(true);
    expect(
      keyPool.isQuotaExhaustedError(
        asErr(429, 'GenerateRequestsPerDayPerProjectPerModel quota exceeded')
      )
    ).toBe(true);
    expect(keyPool.isQuotaExhaustedError(asErr(429, 'daily quota exceeded'))).toBe(true);
    expect(keyPool.isQuotaExhaustedError(asErr(429, 'billing account disabled'))).toBe(true);

    expect(keyPool.isTransientRateLimitError(asErr(429, 'TokensPerMinute'))).toBe(true);
    expect(keyPool.isTransientRateLimitError(asErr(403, 'Permission denied'))).toBe(false);
  });

  test('429 TPM non chiama markKeyExhausted: la chiave resta nel try-order', () => {
    process.env.GEMINI_API_KEY = 'a';
    const tpm = Object.assign(
      new Error('RESOURCE_EXHAUSTED: TokensPerMinute'),
      { status: 429 }
    );
    expect(keyPool.isQuotaExhaustedError(tpm)).toBe(false);
    expect(keyPool.isKeyExhausted(0)).toBe(false);
    expect(keyPool.buildKeyTryOrder(1)).toEqual([0]);
  });

  test('403 marca la chiave esaurita e la toglie dal try-order', () => {
    process.env.GEMINI_API_KEY = 'a';
    process.env.GEMINI_API_KEYS = 'b';
    keyPool.markKeyExhausted(0);
    expect(keyPool.isKeyExhausted(0)).toBe(true);
    expect(keyPool.buildKeyTryOrder(2)).toEqual([1]);
  });

  test('default batch/pausa conservativi (env override)', () => {
    expect(keyPool.getGeminiEmbedBatch()).toBe(5);
    process.env.GEMINI_EMBED_BATCH = '8';
    expect(keyPool.getGeminiEmbedBatch()).toBe(8);
    process.env.GEMINI_EMBED_BATCH = '99';
    expect(keyPool.getGeminiEmbedBatch()).toBe(20);
    delete process.env.GEMINI_EMBED_BATCH;

    expect(keyPool.getGeminiEmbedPauseMs()).toBe(0);
    expect(keyPool.getIngestFolderPauseMs()).toBe(0);
    process.env.INGEST_FOLDER_PAUSE_MS = '2000';
    expect(keyPool.getIngestFolderPauseMs()).toBe(2000);
    delete process.env.INGEST_FOLDER_PAUSE_MS;

    expect(keyPool.getTpmRetryWaitMs({ retryAfterMs: 0 }, 0)).toBe(0);
    expect(keyPool.getTpmRetryWaitMs({}, 0)).toBe(20000);
  });

  test('buildKeyTryOrder salta chiavi esaurite e preferisce ultima OK', () => {
    process.env.GEMINI_API_KEY = 'a';
    process.env.GEMINI_API_KEYS = 'b,c';
    keyPool.setPreferredKeyIndex(2);
    keyPool.markKeyExhausted(0);

    expect(keyPool.buildKeyTryOrder(3)).toEqual([2, 1]);
  });

  test('maskApiKey non espone la chiave intera', () => {
    expect(keyPool.maskApiKey('AIzaSyABCDEF123456789')).toBe('AIza…6789');
  });
});
