'use strict';

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/i;
const PLACEHOLDER_DOMAIN = 'import.placeholder.local';

/**
 * Estrae la prima email valida dal testo libero (es. "Mario Rossi <m@x.it>").
 * @returns {string|null}
 */
function extractEmailFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const match = raw.match(EMAIL_RE);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Nome visualizzato: rimuove email e parentesi, normalizza spazi.
 * @returns {string}
 */
function extractNameFromText(text) {
  let name = String(text || '').trim();
  if (!name) return '';
  name = name.replace(EMAIL_RE, ' ').replace(/[<>()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return name;
}

/**
 * Email obbligatoria in DB: se non deducibile usa placeholder basato sul nome.
 * @returns {string}
 */
function resolveContactEmail(text) {
  const extracted = extractEmailFromText(text);
  if (extracted) return extracted;
  const name = extractNameFromText(text);
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'referente';
  return `${slug}@${PLACEHOLDER_DOMAIN}`;
}

function normalizeNameKey(name) {
  return String(name || '').trim().toLowerCase();
}

module.exports = {
  EMAIL_RE,
  PLACEHOLDER_DOMAIN,
  extractEmailFromText,
  extractNameFromText,
  resolveContactEmail,
  normalizeNameKey,
};
