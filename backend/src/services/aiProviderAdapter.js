/**
 * Multi-provider AI facade: Gemini, Azure OpenAI, OpenAI.
 */

const geminiAdapter = require('./adapters/geminiAdapter');
const azureOpenaiAdapter = require('./adapters/azureOpenaiAdapter');
const openaiAdapter = require('./adapters/openaiAdapter');

function getActiveProvider() {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (
    process.env.AZURE_OPENAI_ENDPOINT &&
    process.env.AZURE_OPENAI_API_KEY
  ) {
    return 'azure_openai';
  }
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

function defaultTimeoutMs() {
  const raw = process.env.AI_REQUEST_TIMEOUT_MS;
  const n = raw != null ? parseInt(String(raw), 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 90000;
}

/**
 * @param {Array<{role:string, content:string}>} messages
 * @param {object} [options]
 * @param {number} [options.temperature]
 * @param {'json'|'text'} [options.responseFormat]
 * @param {number} [options.maxTokens]
 * @param {number} [options.timeout]
 */
async function chat(messages, options = {}) {
  const provider = getActiveProvider();
  if (!provider) {
    const err = new Error(
      'No AI provider configured (set GEMINI_API_KEY, or Azure OpenAI env vars, or OPENAI_API_KEY)'
    );
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  const merged = {
    ...options,
    timeout:
      typeof options.timeout === 'number' && options.timeout > 0
        ? options.timeout
        : defaultTimeoutMs(),
  };

  switch (provider) {
    case 'gemini':
      return geminiAdapter.chat(messages, merged);
    case 'azure_openai':
      return azureOpenaiAdapter.chat(messages, merged);
    case 'openai':
      return openaiAdapter.chat(messages, merged);
    default:
      {
        const err = new Error('Unknown AI provider');
        err.code = 'AI_NOT_CONFIGURED';
        throw err;
      }
  }
}

/**
 * Streaming placeholder: invokes non-streaming chat and optionally delivers full text once.
 *
 * @param {Array<{role:string, content:string}>} messages
 * @param {(chunk: string) => void} [onChunk]
 */
async function chatStream(messages, onChunk) {
  const result = await chat(messages, {});
  if (typeof onChunk === 'function') {
    onChunk(result.content);
  }
  return result;
}

/**
 * Embed texts via active provider (currently Gemini only).
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function embed(texts) {
  const provider = getActiveProvider();
  if (!provider) {
    const err = new Error('No AI provider configured for embeddings');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  if (provider !== 'gemini') {
    const err = new Error(`Embedding not supported for provider: ${provider}`);
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  return geminiAdapter.embed(texts);
}

module.exports = {
  chat,
  chatStream,
  embed,
  getActiveProvider,
};
