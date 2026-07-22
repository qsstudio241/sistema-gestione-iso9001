/**
 * Persistenza sessionStorage messaggi Assistente AI (per org/utente).
 * Solo testi UI e metadati citazioni — mai token o password.
 */

export const AI_CHAT_MAX_MESSAGES = 50;
export const AI_CHAT_STORAGE_PREFIX = 'sgq:ai-assistant-messages';

/**
 * @param {number|string|null|undefined} organizationId
 * @param {number|string|null|undefined} userId
 * @returns {string}
 */
export function buildChatStorageKey(organizationId, userId) {
  const org = organizationId != null ? String(organizationId) : 'unknown';
  const user = userId != null ? String(userId) : 'anon';
  return `${AI_CHAT_STORAGE_PREFIX}:${org}:${user}`;
}

/**
 * @param {Array<{ role: string, time?: Date|string, [key: string]: unknown }>} messages
 * @returns {object[]}
 */
export function serializeChatMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && m.role !== 'loading')
    .slice(-AI_CHAT_MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      text: m.text,
      time: m.time instanceof Date ? m.time.toISOString() : m.time,
      citations: m.citations,
      sourcesCount: m.sourcesCount,
      contextUsed: m.contextUsed,
    }));
}

/**
 * @param {unknown} parsed
 * @returns {Array<{ role: string, text?: string, time: Date, citations?: unknown[], sourcesCount?: number, contextUsed?: number }>}
 */
export function deserializeChatMessages(parsed) {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((m) => m && typeof m.role === 'string')
    .slice(-AI_CHAT_MAX_MESSAGES)
    .map((m) => ({
      ...m,
      time: m.time ? new Date(m.time) : new Date(),
    }));
}

/**
 * @param {string} key
 * @returns {ReturnType<typeof deserializeChatMessages>}
 */
export function loadChatMessages(key) {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    return deserializeChatMessages(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * @param {string} key
 * @param {Array} messages
 * @returns {boolean}
 */
export function saveChatMessages(key, messages) {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    sessionStorage.setItem(key, JSON.stringify(serializeChatMessages(messages)));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} key
 */
export function clearChatMessages(key) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* quota / privacy mode */
  }
}
