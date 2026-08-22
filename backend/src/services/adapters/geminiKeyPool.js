/**
 * Pool di chiavi Gemini con failover quando una chiave esaurisce la quota.
 *
 * Env supportate (retrocompatibile):
 * - GEMINI_API_KEY          — chiave primaria (come oggi)
 * - GEMINI_API_KEYS         — chiavi aggiuntive, separate da virgola, punto e virgola, pipe o newline
 */

/** @type {Set<number>} indici chiavi segnate esaurite in questo processo Node */
const exhaustedKeyIndices = new Set();

/** @type {number|null} indice preferito dopo l'ultima chiamata riuscita */
let preferredKeyIndex = 0;

function splitKeyList(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/[,;\n|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Elenco chiavi Gemini attive (deduplicate, ordine preservato).
 * @returns {string[]}
 */
function getGeminiApiKeys() {
  const keys = [];
  const seen = new Set();

  for (const key of [
    process.env.GEMINI_API_KEY,
    ...splitKeyList(process.env.GEMINI_API_KEYS),
  ]) {
    const normalized = key && String(key).trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    keys.push(normalized);
  }

  return keys;
}

function hasGeminiApiKeys() {
  return getGeminiApiKeys().length > 0;
}

function maskApiKey(key) {
  if (!key || key.length < 8) return '***';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function errorMessageLower(err) {
  return String((err && err.message) || '').toLowerCase();
}

/**
 * Picco al minuto / rate-limit: ritentare la stessa chiave, non spegnere il pool.
 * I 429 Gemini TPM usano spesso il testo stock «exceeded your current quota»
 * + «billing details» anche quando il metrico è PerMinute.
 */
function isTransientRateLimitMessage(msg) {
  if (!msg) return false;
  return (
    /per[\s_-]?minute/.test(msg) ||
    msg.includes('tokensperminute') ||
    msg.includes('inputtokensperminute') ||
    msg.includes('tokens per minute') ||
    /\btpm\b/.test(msg) ||
    /rate[\s_-]?limit/.test(msg) ||
    msg.includes('too many requests') ||
    msg.includes('resource has been exhausted') ||
    msg.includes('resource exhausted') ||
    msg.includes('try again later') ||
    msg.includes('please retry') ||
    msg.includes('please try again')
  );
}

/** Quota giornaliera o billing davvero morto — non un picco TPM. */
function isDailyQuotaOrDeadBillingMessage(msg) {
  if (!msg) return false;
  if (isTransientRateLimitMessage(msg)) return false;
  return (
    /per[\s_-]?day/.test(msg) ||
    msg.includes('requestsperday') ||
    msg.includes('generatecontentrequestsperday') ||
    msg.includes('daily quota') ||
    msg.includes('daily limit') ||
    msg.includes('quota for the day') ||
    msg.includes('billing account') ||
    msg.includes('billing disabled') ||
    msg.includes('limit: 0')
  );
}

/**
 * Quota/token esauriti (switch chiave) vs rate limit transitorio (retry stessa chiave).
 * Default 429 = transitorio. Esausta solo 403 o messaggio chiaro PerDay/billing morto.
 * @param {Error & { status?: number }} err
 */
function isQuotaExhaustedError(err) {
  if (!err) return false;
  if (err.status === 403) return true;
  if (err.status !== 429) return false;
  return isDailyQuotaOrDeadBillingMessage(errorMessageLower(err));
}

function isTransientRateLimitError(err) {
  if (!err || err.status !== 429) return false;
  return !isQuotaExhaustedError(err);
}

function resolveEnvInt(name, fallback, min, max) {
  const n = parseInt(String(process.env[name] == null ? '' : process.env[name]), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function defaultPauseMs(prodDefault) {
  return process.env.NODE_ENV === 'test' ? 0 : prodDefault;
}

/** Chunk per chiamata embed (default conservativo vs TPM 1M/min). */
function getGeminiEmbedBatch() {
  return resolveEnvInt('GEMINI_EMBED_BATCH', 5, 1, 20);
}

function getGeminiEmbedPauseMs() {
  return resolveEnvInt('GEMINI_EMBED_PAUSE_MS', defaultPauseMs(2500), 0, 60000);
}

function getIngestFolderPauseMs() {
  return resolveEnvInt('INGEST_FOLDER_PAUSE_MS', defaultPauseMs(2000), 0, 60000);
}

/** Attesa su 429 TPM: Retry-After se c'è, altrimenti 20s / 35s / 45s (cap 60s). */
function getTpmRetryWaitMs(err, attempt) {
  if (err && err.retryAfterMs != null && Number.isFinite(err.retryAfterMs)) {
    return Math.min(Math.max(0, Math.round(err.retryAfterMs)), 60000);
  }
  const base = resolveEnvInt('GEMINI_TPM_RETRY_MS', 20000, 0, 60000);
  const stepped = [base, Math.min(base + 15000, 45000), Math.min(base + 25000, 60000)];
  const idx = Math.max(0, Math.min(attempt, stepped.length - 1));
  return stepped[idx];
}

function pause(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function markKeyExhausted(keyIndex) {
  exhaustedKeyIndices.add(keyIndex);
}

function isKeyExhausted(keyIndex) {
  return exhaustedKeyIndices.has(keyIndex);
}

function resetKeyPoolState() {
  exhaustedKeyIndices.clear();
  preferredKeyIndex = 0;
}

function getPreferredKeyIndex(keyCount) {
  if (keyCount <= 0) return 0;
  if (preferredKeyIndex >= 0 && preferredKeyIndex < keyCount) {
    return preferredKeyIndex;
  }
  return 0;
}

function setPreferredKeyIndex(keyIndex) {
  preferredKeyIndex = keyIndex;
}

/**
 * Ordine di prova: chiave preferita (ultima OK), poi le altre non esaurite.
 * @param {number} keyCount
 * @returns {number[]}
 */
function buildKeyTryOrder(keyCount) {
  if (keyCount <= 0) return [];

  const start = getPreferredKeyIndex(keyCount);
  const order = [];

  for (let offset = 0; offset < keyCount; offset += 1) {
    const idx = (start + offset) % keyCount;
    if (!isKeyExhausted(idx)) order.push(idx);
  }

  return order;
}

module.exports = {
  getGeminiApiKeys,
  hasGeminiApiKeys,
  maskApiKey,
  isQuotaExhaustedError,
  isTransientRateLimitError,
  markKeyExhausted,
  isKeyExhausted,
  resetKeyPoolState,
  getPreferredKeyIndex,
  setPreferredKeyIndex,
  buildKeyTryOrder,
  splitKeyList,
  getGeminiEmbedBatch,
  getGeminiEmbedPauseMs,
  getIngestFolderPauseMs,
  getTpmRetryWaitMs,
  pause,
};
