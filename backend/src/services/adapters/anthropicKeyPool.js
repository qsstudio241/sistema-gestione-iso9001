/**
 * Pool chiavi Anthropic/Claude (stesso pattern di geminiKeyPool).
 *
 * - ANTHROPIC_API_KEY
 * - ANTHROPIC_API_KEYS (virgola, punto e virgola, pipe o newline)
 */

const { splitKeyList } = require('./geminiKeyPool');

/** @type {Set<number>} */
const exhaustedKeyIndices = new Set();
/** @type {number} */
let preferredKeyIndex = 0;

function getAnthropicApiKeys() {
  const keys = [];
  const seen = new Set();

  for (const key of [
    process.env.ANTHROPIC_API_KEY,
    ...splitKeyList(process.env.ANTHROPIC_API_KEYS),
  ]) {
    const normalized = key && String(key).trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    keys.push(normalized);
  }

  return keys;
}

function hasAnthropicApiKeys() {
  return getAnthropicApiKeys().length > 0;
}

function isQuotaExhaustedError(err) {
  if (!err) return false;
  if (err.status === 402 || err.status === 403) return true;
  if (err.status !== 429) return false;

  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('credit') ||
    msg.includes('quota') ||
    msg.includes('billing') ||
    msg.includes('balance') ||
    msg.includes('exhausted') ||
    msg.includes('insufficient')
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

function setPreferredKeyIndex(keyIndex) {
  preferredKeyIndex = keyIndex;
}

function buildKeyTryOrder(keyCount) {
  if (keyCount <= 0) return [];
  const start =
    preferredKeyIndex >= 0 && preferredKeyIndex < keyCount ? preferredKeyIndex : 0;
  const order = [];
  for (let offset = 0; offset < keyCount; offset += 1) {
    const idx = (start + offset) % keyCount;
    if (!isKeyExhausted(idx)) order.push(idx);
  }
  return order;
}

module.exports = {
  getAnthropicApiKeys,
  hasAnthropicApiKeys,
  isQuotaExhaustedError,
  markKeyExhausted,
  isKeyExhausted,
  resetKeyPoolState,
  setPreferredKeyIndex,
  buildKeyTryOrder,
};
