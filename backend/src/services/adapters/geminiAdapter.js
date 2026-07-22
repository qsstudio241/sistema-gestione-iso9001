/**
 * Gemini generateContent adapter (native fetch).
 */

const keyPool = require('./geminiKeyPool');

function createNormalizedError(code, message, status) {
  const err = new Error(message);
  err.code = code;
  if (status !== undefined) err.status = status;
  return err;
}

/**
 * Convert OpenAI-style messages to Gemini contents + optional systemInstruction.
 */
function mapMessagesToGemini(messages) {
  const systemTexts = [];
  const contents = [];

  for (const m of messages || []) {
    const text =
      typeof m.content === 'string'
        ? m.content
        : m.content != null
          ? JSON.stringify(m.content)
          : '';

    if (m.role === 'system') {
      systemTexts.push(text);
      continue;
    }

    const gemRole = m.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];

    if (last && last.role === gemRole) {
      last.parts[0].text += (last.parts[0].text ? '\n\n' : '') + text;
    } else {
      contents.push({ role: gemRole, parts: [{ text }] });
    }
  }

  const systemInstruction =
    systemTexts.length > 0
      ? { parts: [{ text: systemTexts.join('\n\n') }] }
      : undefined;

  return { systemInstruction, contents };
}

// Codici HTTP transienti da provider Gemini per cui ha senso ritentare:
// - 429: rate limit (quota per-minute o per-day)
// - 500: errore interno transitorio Gemini
// - 502/504: gateway/timeout sulla rete Google
// - 503: "model overloaded" (capacità insufficiente lato Google)
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

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
    // ignora header malformati
  }
  return null;
}

function computeBackoffMs(attempt) {
  // Backoff esponenziale con jitter: 800ms, 1600ms, 3200ms +/- 250ms
  const base = 800 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 500) - 250;
  return Math.max(200, Math.min(5000, base + jitter));
}

// Timeout difensivo (ms) per ogni chiamata di rete di embedding: evita che un
// provider lento o a rate-limit lasci l'indicizzazione AI appesa all'infinito.
function embedTimeoutMs() {
  const raw = process.env.GEMINI_EMBED_TIMEOUT_MS;
  const n = raw != null ? parseInt(String(raw), 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 30000;
}

/**
 * Singolo tentativo di chiamata Gemini. Restituisce il risultato normalizzato
 * oppure lancia un errore con `err.status` valorizzato per gli HTTP non-OK,
 * così il chiamante può decidere se ritentare.
 */
async function chatOnce(model, apiKey, body, timeout) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw createNormalizedError(
        'AI_REQUEST_FAILED',
        'Gemini request aborted or timed out'
      );
    }
    throw createNormalizedError(
      'AI_REQUEST_FAILED',
      e && e.message ? e.message : 'Gemini network request failed'
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
      'Gemini response body is not valid JSON',
      response.status
    );
  }

  if (!response.ok) {
    const msg =
      (data && data.error && data.error.message) ||
      `Gemini HTTP ${response.status}`;
    const err = createNormalizedError(
      'AI_UPSTREAM_ERROR',
      msg,
      response.status
    );
    err.retryAfterMs = getRetryAfterMs(response);
    throw err;
  }

  const candidate = data.candidates && data.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;
  let content = '';
  if (parts && parts.length) {
    content = parts
      .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
      .join('');
  }

  if (!content || !String(content).trim()) {
    throw createNormalizedError(
      'AI_EMPTY_RESPONSE',
      'Gemini returned empty content'
    );
  }

  const usage = data.usageMetadata || {};
  const input = Number(usage.promptTokenCount) || 0;
  const output = Number(usage.candidatesTokenCount) || 0;

  return {
    content,
    model,
    tokens: { input, output },
    cost: 0,
  };
}

/**
 * @param {Array<{role:string, content:string}>} messages
 * @param {object} [options]
 * @param {number} [options.temperature]
 * @param {'json'|'text'} [options.responseFormat]
 * @param {number} [options.maxTokens]
 * @param {number} [options.timeout]
 */
function resolveMaxAttempts() {
  // Numero di tentativi configurabile: default 3 (1 chiamata + 2 retry) per
  // assorbire i tipici "model overloaded" intermittenti di Gemini senza
  // mostrare errori all'utente. Cap totale di attesa ~5s prima di rinunciare.
  const rawMaxAttempts = parseInt(
    String(process.env.GEMINI_MAX_ATTEMPTS || ''),
    10
  );
  return Number.isFinite(rawMaxAttempts) && rawMaxAttempts >= 1 && rawMaxAttempts <= 5
    ? rawMaxAttempts
    : 3;
}

/**
 * Esegue una chiamata generateContent con retry/backoff su status transienti.
 * Centralizza la logica di rete così chat() e generateVision() condividono
 * la stessa integrazione (stessa chiave env, stesso retry, stesso parsing).
 *
 * @param {object} body  - corpo già pronto per la API generateContent
 * @param {object} [options]
 * @param {number} [options.timeout]
 */
async function generateContent(body, options = {}) {
  const apiKeys = keyPool.getGeminiApiKeys();
  if (apiKeys.length === 0) {
    throw createNormalizedError(
      'AI_NOT_CONFIGURED',
      'GEMINI_API_KEY (o GEMINI_API_KEYS) non configurata'
    );
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const timeout =
    typeof options.timeout === 'number' && options.timeout > 0
      ? options.timeout
      : 90000;
  const maxAttempts = resolveMaxAttempts();
  const keyOrder = keyPool.buildKeyTryOrder(apiKeys.length);

  if (keyOrder.length === 0) {
    throw createNormalizedError(
      'AI_QUOTA_EXHAUSTED',
      'Tutte le chiavi Gemini configurate risultano esaurite (quota). Aggiungere GEMINI_API_KEYS o riavviare il backend dopo reset quota.'
    );
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
          err && err.code === 'AI_UPSTREAM_ERROR' && RETRYABLE_STATUSES.has(err.status);
        if (isLast || !isRetryable) {
          break;
        }
        const waitMs =
          err.retryAfterMs != null ? err.retryAfterMs : computeBackoffMs(attempt);
        await sleep(waitMs);
      }
    }
  }

  if (keyPool.buildKeyTryOrder(apiKeys.length).length === 0) {
    throw createNormalizedError(
      'AI_QUOTA_EXHAUSTED',
      'Tutte le chiavi Gemini configurate risultano esaurite (quota). Aggiungere GEMINI_API_KEYS, configurare ANTHROPIC_API_KEY, o riavviare il backend dopo reset quota.'
    );
  }

  throw (
    lastErr ||
    createNormalizedError(
      'AI_UPSTREAM_ERROR',
      'Nessuna chiave Gemini disponibile per completare la richiesta'
    )
  );
}

function buildGenerationConfig(options = {}) {
  return {
    ...(typeof options.temperature === 'number'
      ? { temperature: options.temperature }
      : {}),
    ...(typeof options.maxTokens === 'number'
      ? { maxOutputTokens: options.maxTokens }
      : {}),
    ...(options.responseFormat === 'json'
      ? { responseMimeType: 'application/json' }
      : {}),
  };
}

async function chat(messages, options = {}) {
  const { systemInstruction, contents } = mapMessagesToGemini(messages);

  const body = {
    contents,
    ...(systemInstruction ? { systemInstruction } : {}),
    generationConfig: buildGenerationConfig(options),
  };

  return generateContent(body, options);
}

/**
 * Chiamata multimodale (vision): invia uno o più file (immagine/PDF) come
 * inlineData insieme a un prompt testuale. Riusa generateContent (retry,
 * chiave env, parsing) per non duplicare l'integrazione Gemini.
 *
 * @param {object} params
 * @param {string} [params.systemText]  - istruzione di sistema
 * @param {string} params.userText      - prompt utente
 * @param {Array<{mimeType:string, data:string}>} params.files - file base64
 * @param {object} [options]            - temperature/maxTokens/responseFormat/timeout
 */
async function generateVision({ systemText, userText, files } = {}, options = {}) {
  const parts = [];
  if (userText) parts.push({ text: String(userText) });
  for (const f of files || []) {
    if (f && f.data && f.mimeType) {
      parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
    }
  }
  if (parts.length === 0) {
    throw createNormalizedError('AI_REQUEST_FAILED', 'generateVision: nessun contenuto da inviare');
  }

  const body = {
    contents: [{ role: 'user', parts }],
    ...(systemText ? { systemInstruction: { parts: [{ text: String(systemText) }] } } : {}),
    generationConfig: buildGenerationConfig(options),
  };

  return generateContent(body, options);
}

/**
 * Batch embed texts using Gemini embedding model.
 * @param {string[]} texts - Max 100 per call (API limit)
 * @returns {Promise<number[][]>} Array of float vectors (3072-dim for gemini-embedding-001)
 */
async function embedBatchOnce(apiKey, embedModel, batch, timeoutMs) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(embedModel)}:batchEmbedContents?key=${encodeURIComponent(apiKey)}`;
  const body = {
    requests: batch.map((t) => ({
      model: `models/${embedModel}`,
      content: { parts: [{ text: t }] },
    })),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw createNormalizedError(
        'AI_REQUEST_FAILED',
        `Gemini embedding timed out after ${timeoutMs}ms`
      );
    }
    throw createNormalizedError(
      'AI_REQUEST_FAILED',
      `Gemini embedding network error: ${e.message || 'unknown'}`
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
      'Gemini embedding response is not valid JSON',
      response.status
    );
  }

  if (!response.ok) {
    const msg =
      (data && data.error && data.error.message) ||
      `Gemini embedding HTTP ${response.status}`;
    const err = createNormalizedError('AI_UPSTREAM_ERROR', msg, response.status);
    err.retryAfterMs = getRetryAfterMs(response);
    throw err;
  }

  if (!data.embeddings || !Array.isArray(data.embeddings)) {
    throw createNormalizedError(
      'AI_UPSTREAM_ERROR',
      'Gemini embedding response missing embeddings array'
    );
  }

  return data.embeddings.map((emb) => emb.values);
}

async function embed(texts) {
  const apiKeys = keyPool.getGeminiApiKeys();
  if (apiKeys.length === 0) {
    throw createNormalizedError(
      'AI_NOT_CONFIGURED',
      'GEMINI_API_KEY (o GEMINI_API_KEYS) non configurata'
    );
  }
  if (!texts || texts.length === 0) return [];

  const embedModel = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';
  const BATCH_LIMIT = 100;
  const timeoutMs = embedTimeoutMs();
  const MAX_RATE_LIMIT_RETRIES = 2;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const batch = texts.slice(i, i + BATCH_LIMIT);
    const keyOrder = keyPool.buildKeyTryOrder(apiKeys.length);
    if (keyOrder.length === 0) {
      throw createNormalizedError(
        'AI_UPSTREAM_ERROR',
        'Tutte le chiavi Gemini configurate risultano esaurite (quota embedding).'
      );
    }

    let batchDone = false;
    let lastErr;

    for (const keyIndex of keyOrder) {
      const apiKey = apiKeys[keyIndex];
      let rateLimitRetries = 0;

      while (rateLimitRetries <= MAX_RATE_LIMIT_RETRIES) {
        try {
          const vectors = await embedBatchOnce(apiKey, embedModel, batch, timeoutMs);
          allEmbeddings.push(...vectors);
          keyPool.setPreferredKeyIndex(keyIndex);
          batchDone = true;
          break;
        } catch (err) {
          lastErr = err;

          if (keyPool.isQuotaExhaustedError(err)) {
            keyPool.markKeyExhausted(keyIndex);
            break;
          }

          const isRateLimit =
            err &&
            err.code === 'AI_UPSTREAM_ERROR' &&
            err.status === 429 &&
            !keyPool.isQuotaExhaustedError(err);

          if (isRateLimit && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
            rateLimitRetries += 1;
            const waitMs =
              err.retryAfterMs != null ? err.retryAfterMs : 5000;
            await sleep(Math.min(waitMs, 30000));
            continue;
          }

          break;
        }
      }

      if (batchDone) break;
    }

    if (!batchDone) {
      throw (
        lastErr ||
        createNormalizedError(
          'AI_UPSTREAM_ERROR',
          'Nessuna chiave Gemini disponibile per completare l\u2019embedding'
        )
      );
    }
  }

  return allEmbeddings;
}

module.exports = {
  chat,
  embed,
  generateVision,
  generateContent,
  mapMessagesToGemini,
  // Esportati per i test (retry/backoff logic)
  _internals: { computeBackoffMs, getRetryAfterMs, RETRYABLE_STATUSES, keyPool },
};
