/**
 * Logica pura numerazione Mason (PREFISSO-YYMMDD-NN) — senza dipendenze DB (testabile in CI).
 */

const DEFAULT_PREFIX = 'MSN';

/**
 * Data calendario a Europe/Rome come parti YYYY, MM, DD
 * @returns {{ year: string, month: string, day: string, sqlDate: string, yymmdd: string }}
 */
function getRomeCalendarParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !d) {
    const iso = now.toISOString().slice(0, 10);
    const [yy, mm, dd] = iso.split('-');
    return {
      year: yy,
      month: mm,
      day: dd,
      sqlDate: `${yy}-${mm}-${dd}`,
      yymmdd: `${yy.slice(-2)}${mm}${dd}`,
    };
  }
  return {
    year: y,
    month: m,
    day: d,
    sqlDate: `${y}-${m}-${d}`,
    yymmdd: `${y.slice(-2)}${m}${d}`,
  };
}

/**
 * @param {string|null|undefined} raw
 * @returns {string}
 */
function sanitizePrefix(raw) {
  if (raw == null || String(raw).trim() === '') return DEFAULT_PREFIX;
  const u = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!u) return DEFAULT_PREFIX;
  return u.length > 16 ? u.slice(0, 16) : u;
}

/**
 * @param {string} prefix
 * @param {number} seq
 * @param {{ yymmdd: string }} rome
 */
function formatAuditNumber(prefix, seq, rome) {
  const p = sanitizePrefix(prefix);
  const n = Math.max(1, Math.min(99, Math.floor(seq)));
  return `${p}-${rome.yymmdd}-${String(n).padStart(2, '0')}`;
}

/** Regex formato Mason (allineata al task) */
const MASON_AUDIT_NUMBER_RE = /^[A-Z0-9]+-\d{6}-\d{2}$/;

module.exports = {
  DEFAULT_PREFIX,
  getRomeCalendarParts,
  sanitizePrefix,
  formatAuditNumber,
  MASON_AUDIT_NUMBER_RE,
};
