/**
 * Gemini generateContent adapter (native fetch).
 */

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

/**
 * @param {Array<{role:string, content:string}>} messages
 * @param {object} [options]
 * @param {number} [options.temperature]
 * @param {'json'|'text'} [options.responseFormat]
 * @param {number} [options.maxTokens]
 * @param {number} [options.timeout]
 */
async function chat(messages, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createNormalizedError(
      'AI_NOT_CONFIGURED',
      'GEMINI_API_KEY is not set'
    );
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const timeout =
    typeof options.timeout === 'number' && options.timeout > 0
      ? options.timeout
      : 90000;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const { systemInstruction, contents } = mapMessagesToGemini(messages);

  const body = {
    contents,
    ...(systemInstruction ? { systemInstruction } : {}),
    generationConfig: {
      ...(typeof options.temperature === 'number'
        ? { temperature: options.temperature }
        : {}),
      ...(typeof options.maxTokens === 'number'
        ? { maxOutputTokens: options.maxTokens }
        : {}),
      ...(options.responseFormat === 'json'
        ? { responseMimeType: 'application/json' }
        : {}),
    },
  };

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
      (data && (data.error && data.error.message)) ||
      `Gemini HTTP ${response.status}`;
    throw createNormalizedError('AI_UPSTREAM_ERROR', msg, response.status);
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
 * Batch embed texts using text-embedding-004.
 * @param {string[]} texts - Max 100 per call (API limit)
 * @returns {Promise<number[][]>} Array of 768-dim float vectors
 */
async function embed(texts) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createNormalizedError('AI_NOT_CONFIGURED', 'GEMINI_API_KEY is not set');
  }
  if (!texts || texts.length === 0) return [];

  const BATCH_LIMIT = 100;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const batch = texts.slice(i, i + BATCH_LIMIT);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${encodeURIComponent(apiKey)}`;
    const body = {
      requests: batch.map(t => ({
        model: 'models/text-embedding-004',
        content: { parts: [{ text: t }] },
      })),
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw createNormalizedError(
        'AI_REQUEST_FAILED',
        `Gemini embedding network error: ${e.message || 'unknown'}`
      );
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw createNormalizedError('AI_UPSTREAM_ERROR', 'Gemini embedding response is not valid JSON', response.status);
    }

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        i -= BATCH_LIMIT; // retry this batch
        continue;
      }
      const msg = (data && data.error && data.error.message) || `Gemini embedding HTTP ${response.status}`;
      throw createNormalizedError('AI_UPSTREAM_ERROR', msg, response.status);
    }

    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw createNormalizedError('AI_UPSTREAM_ERROR', 'Gemini embedding response missing embeddings array');
    }

    for (const emb of data.embeddings) {
      allEmbeddings.push(emb.values);
    }
  }

  return allEmbeddings;
}

module.exports = { chat, embed, mapMessagesToGemini };
