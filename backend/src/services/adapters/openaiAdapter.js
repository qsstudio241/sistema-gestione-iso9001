/**
 * OpenAI chat completions adapter.
 */

function createNormalizedError(code, message, status) {
  const err = new Error(message);
  err.code = code;
  if (status !== undefined) err.status = status;
  return err;
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw createNormalizedError(
      'AI_NOT_CONFIGURED',
      'OPENAI_API_KEY is not set'
    );
  }

  const model =
    process.env.OPENAI_MODEL ||
    process.env.OPENAI_IMPORT_MODEL ||
    'gpt-4o-mini';

  const timeout =
    typeof options.timeout === 'number' && options.timeout > 0
      ? options.timeout
      : 90000;

  const payload = {
    model,
    messages,
    ...(typeof options.temperature === 'number'
      ? { temperature: options.temperature }
      : {}),
    ...(typeof options.maxTokens === 'number'
      ? { max_tokens: options.maxTokens }
      : {}),
    ...(options.responseFormat === 'json'
      ? { response_format: { type: 'json_object' } }
      : {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw createNormalizedError(
        'AI_REQUEST_FAILED',
        'OpenAI request aborted or timed out'
      );
    }
    throw createNormalizedError(
      'AI_REQUEST_FAILED',
      e && e.message ? e.message : 'OpenAI network request failed'
    );
  } finally {
    clearTimeout(timer);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw createNormalizedError(
      'AI_UPSTREAM_ERROR',
      'OpenAI response body is not valid JSON',
      response.status
    );
  }

  if (!response.ok) {
    const msg =
      (data && data.error && data.error.message) ||
      `OpenAI HTTP ${response.status}`;
    throw createNormalizedError('AI_UPSTREAM_ERROR', msg, response.status);
  }

  const choice = data.choices && data.choices[0];
  const msg = choice && choice.message;
  const content =
    msg && typeof msg.content === 'string' ? msg.content : '';

  if (!content || !String(content).trim()) {
    throw createNormalizedError(
      'AI_EMPTY_RESPONSE',
      'OpenAI returned empty content'
    );
  }

  const usage = data.usage || {};
  const input = Number(usage.prompt_tokens) || 0;
  const output = Number(usage.completion_tokens) || 0;

  return {
    content,
    model: typeof data.model === 'string' ? data.model : model,
    tokens: { input, output },
    cost: 0,
  };
}

module.exports = { chat };
