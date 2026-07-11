/**
 * Anthropic Claude Messages API adapter.
 */

const keyPool = require('./anthropicKeyPool');

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 529]);

function createNormalizedError(code, message, status) {
  const err = new Error(message);
  err.code = code;
  if (status !== undefined) err.status = status;
  return err;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryAfterMs(response) {
  try {
    const header =
      response &&
      response.headers &&
      typeof response.headers.get === 'function'
        ? response.headers.get('retry-after')
        : null;
    if (!header) return null;
    const seconds = parseFloat(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(Math.round(seconds * 1000), 10000);
    }
  } catch {
    // ignora
  }
  return null;
}

function computeBackoffMs(attempt) {
  const base = 800 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 500) - 250;
  return Math.max(200, Math.min(5000, base + jitter));
}

function resolveMaxAttempts() {
  const raw = parseInt(String(process.env.ANTHROPIC_MAX_ATTEMPTS || ''), 10);
  return Number.isFinite(raw) && raw >= 1 && raw <= 5 ? raw : 3;
}

function mapMessagesToAnthropic(messages, options = {}) {
  const systemParts = [];
  const anthropicMessages = [];

  for (const m of messages || []) {
    const text =
      typeof m.content === 'string'
        ? m.content
        : m.content != null
          ? JSON.stringify(m.content)
          : '';

    if (m.role === 'system') {
      systemParts.push(text);
      continue;
    }

    if (m.role !== 'user' && m.role !== 'assistant') continue;

    const last = anthropicMessages[anthropicMessages.length - 1];
    if (last && last.role === m.role) {
      last.content += (last.content ? '\n\n' : '') + text;
    } else {
      anthropicMessages.push({ role: m.role, content: text });
    }
  }

  if (options.responseFormat === 'json') {
    systemParts.push(
      'Rispondi esclusivamente con JSON valido, senza markdown né testo fuori dal JSON.'
    );
  }

  if (anthropicMessages.length === 0) {
    anthropicMessages.push({ role: 'user', content: ' ' });
  }

  if (anthropicMessages[0].role !== 'user') {
    anthropicMessages.unshift({ role: 'user', content: '(continua)' });
  }

  return {
    system: systemParts.length ? systemParts.join('\n\n') : undefined,
    messages: anthropicMessages,
  };
}

async function chatOnce(model, apiKey, body, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': process.env.ANTHROPIC_API_VERSION || '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw createNormalizedError(
        'AI_REQUEST_FAILED',
        'Anthropic request aborted or timed out'
      );
    }
    throw createNormalizedError(
      'AI_REQUEST_FAILED',
      e && e.message ? e.message : 'Anthropic network request failed'
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
      'Anthropic response body is not valid JSON',
      response.status
    );
  }

  if (!response.ok) {
    const msg =
      (data && data.error && data.error.message) ||
      `Anthropic HTTP ${response.status}`;
    const err = createNormalizedError('AI_UPSTREAM_ERROR', msg, response.status);
    err.retryAfterMs = getRetryAfterMs(response);
    throw err;
  }

  const blocks = data.content || [];
  const content = blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');

  if (!content || !String(content).trim()) {
    throw createNormalizedError(
      'AI_EMPTY_RESPONSE',
      'Anthropic returned empty content'
    );
  }

  const usage = data.usage || {};
  return {
    content,
    model: typeof data.model === 'string' ? data.model : model,
    tokens: {
      input: Number(usage.input_tokens) || 0,
      output: Number(usage.output_tokens) || 0,
    },
    cost: 0,
    provider: 'anthropic',
  };
}

/**
 * @param {Array<{role:string, content:string}>} messages
 * @param {object} [options]
 */
async function chat(messages, options = {}) {
  const apiKeys = keyPool.getAnthropicApiKeys();
  if (apiKeys.length === 0) {
    throw createNormalizedError(
      'AI_NOT_CONFIGURED',
      'ANTHROPIC_API_KEY (o ANTHROPIC_API_KEYS) non configurata'
    );
  }

  const model =
    process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
  const timeout =
    typeof options.timeout === 'number' && options.timeout > 0
      ? options.timeout
      : 90000;
  const maxAttempts = resolveMaxAttempts();
  const { system, messages: anthropicMessages } = mapMessagesToAnthropic(
    messages,
    options
  );

  const body = {
    model,
    max_tokens:
      typeof options.maxTokens === 'number' && options.maxTokens > 0
        ? options.maxTokens
        : 4096,
    messages: anthropicMessages,
    ...(system ? { system } : {}),
    ...(typeof options.temperature === 'number'
      ? { temperature: options.temperature }
      : {}),
  };

  const keyOrder = keyPool.buildKeyTryOrder(apiKeys.length);
  if (keyOrder.length === 0) {
    const err = createNormalizedError(
      'AI_QUOTA_EXHAUSTED',
      'Tutte le chiavi Anthropic configurate risultano esaurite (quota/crediti).'
    );
    throw err;
  }

  let lastErr;
  for (const keyIndex of keyOrder) {
    const apiKey = apiKeys[keyIndex];

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const result = await chatOnce(model, apiKey, body, timeout);
        keyPool.setPreferredKeyIndex(keyIndex);
        return result;
      } catch (err) {
        lastErr = err;

        if (keyPool.isQuotaExhaustedError(err)) {
          keyPool.markKeyExhausted(keyIndex);
          break;
        }

        const isLast = attempt === maxAttempts - 1;
        const isRetryable =
          err &&
          err.code === 'AI_UPSTREAM_ERROR' &&
          RETRYABLE_STATUSES.has(err.status);
        if (isLast || !isRetryable) break;

        const waitMs =
          err.retryAfterMs != null ? err.retryAfterMs : computeBackoffMs(attempt);
        await sleep(waitMs);
      }
    }
  }

  throw (
    lastErr ||
    createNormalizedError(
      'AI_QUOTA_EXHAUSTED',
      'Nessuna chiave Anthropic disponibile per completare la richiesta'
    )
  );
}

module.exports = { chat, mapMessagesToAnthropic };
