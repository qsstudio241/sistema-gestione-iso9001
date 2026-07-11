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

  test('isQuotaExhaustedError distingue quota da rate limit generico', () => {
    expect(
      keyPool.isQuotaExhaustedError(
        Object.assign(new Error('You exceeded your current quota'), { status: 429 })
      )
    ).toBe(true);
    expect(
      keyPool.isQuotaExhaustedError(
        Object.assign(new Error('Resource has been exhausted'), { status: 429 })
      )
    ).toBe(true);
    expect(
      keyPool.isQuotaExhaustedError(
        Object.assign(new Error('Permission denied'), { status: 403 })
      )
    ).toBe(true);
    expect(
      keyPool.isQuotaExhaustedError(
        Object.assign(new Error('Too many requests'), { status: 429 })
      )
    ).toBe(false);
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
