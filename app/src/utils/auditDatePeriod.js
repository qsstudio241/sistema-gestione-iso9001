/**
 * Periodo date audit (inizio/fine) — formato display e validazione UI.
 * La durata in giorni non è persistita; solo audit_date + audit_date_end.
 */

export function toDateOnly(value) {
    if (value == null || value === '') return '';
    const s = String(value).trim();
    if (!s) return '';
    return s.includes('T') ? s.slice(0, 10) : s;
}

export function isMultiDayAudit(start, end) {
    const s = toDateOnly(start);
    const e = toDateOnly(end);
    return !!(s && e && e !== s);
}

export function formatDateIt(dateStr) {
    if (!dateStr) return '';
    try {
        const parts = toDateOnly(dateStr).split('-');
        if (parts.length === 3) {
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                });
            }
        }
        const d = new Date(dateStr);
        return isNaN(d.getTime())
            ? String(dateStr)
            : d.toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
              });
    } catch {
        return String(dateStr);
    }
}

/** Periodo italiano: singola data o "gg/mm/aaaa – gg/mm/aaaa" */
export function formatAuditPeriodIt(start, end) {
    const s = toDateOnly(start);
    if (!s) return '';
    if (!isMultiDayAudit(s, end)) return formatDateIt(s);
    return `${formatDateIt(s)} \u2013 ${formatDateIt(end)}`;
}

/** Etichetta breve per selettore audit */
export function formatAuditPeriodLabel(start, end) {
    return formatAuditPeriodIt(start, end);
}

/** Giorni inclusivi solo per UI (non persistiti) */
export function displayAuditDayCount(start, end) {
    const s = toDateOnly(start);
    const e = toDateOnly(end) || s;
    if (!s) return null;
    const d0 = new Date(`${s}T12:00:00`);
    const d1 = new Date(`${e}T12:00:00`);
    if (isNaN(d0.getTime()) || isNaN(d1.getTime())) return null;
    const diff = Math.round((d1 - d0) / (24 * 60 * 60 * 1000)) + 1;
    return diff > 1 ? diff : null;
}

export function normalizeAuditDateEndForStorage(start, end) {
    const s = toDateOnly(start);
    const e = toDateOnly(end);
    if (!s || !e || e === s) return null;
    return e;
}

/**
 * @returns {{ valid: boolean, message?: string, warnings?: string[] }}
 */
export function validateAuditDateRangeClient(start, end, { checkFuture = true } = {}) {
    const warnings = [];
    const s = toDateOnly(start);
    if (!s) {
        return { valid: false, message: 'Inserire la data di inizio audit' };
    }
    const e = toDateOnly(end);
    if (e && e < s) {
        return { valid: false, message: 'La data fine non può essere precedente alla data inizio' };
    }
    if (checkFuture) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startD = new Date(`${s}T12:00:00`);
        if (startD > today) {
            warnings.push('La data di inizio è nel futuro');
        }
        if (e) {
            const endD = new Date(`${e}T12:00:00`);
            if (endD > today) {
                warnings.push('La data di fine è nel futuro');
            }
        }
    }
    return { valid: true, warnings };
}
