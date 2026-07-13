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

/**
 * Quota/token esauriti (switch chiave) vs rate limit transitorio (retry stessa chiave).
 * @param {Error & { status?: number }} err
 */
function isQuotaExhaustedError(err) {
  if (!err) return false;
  if (err.status === 403) return true;
  if (err.status !== 429) return false;

  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('exhausted') ||
    msg.includes('billing') ||
    msg.includes('limit: 0') ||
    msg.includes('resource has been exhausted') ||
    msg.includes('exceeded your current quota')
  );
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
  markKeyExhausted,
  isKeyExhausted,
  resetKeyPoolState,
  getPreferredKeyIndex,
  setPreferredKeyIndex,
  buildKeyTryOrder,
  splitKeyList,
};
