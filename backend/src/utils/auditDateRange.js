/**
 * Validazione e normalizzazione date audit (inizio/fine).
 * audit_date_end NULL o uguale a audit_date = audit mono-giorno.
 */

function toDateOnly(value) {
    if (value == null || value === '') return null;
    const s = String(value).trim();
    if (!s) return null;
    const d = s.includes('T') ? s.slice(0, 10) : s;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    return d;
}

/**
 * @param {string|null|undefined} auditDate - data inizio
 * @param {string|null|undefined} auditDateEnd - data fine opzionale
 * @returns {{ valid: boolean, error?: string, audit_date?: string, audit_date_end?: string|null }}
 */
function validateAuditDateRange(auditDate, auditDateEnd) {
    const start = toDateOnly(auditDate);
    if (!start) {
        return { valid: false, error: 'Data audit (inizio) non valida' };
    }
    const endRaw = toDateOnly(auditDateEnd);
    if (!endRaw || endRaw === start) {
        return { valid: true, audit_date: start, audit_date_end: null };
    }
    if (endRaw < start) {
        return { valid: false, error: 'La data fine deve essere successiva o uguale alla data inizio' };
    }
    return { valid: true, audit_date: start, audit_date_end: endRaw };
}

module.exports = {
    toDateOnly,
    validateAuditDateRange,
};
