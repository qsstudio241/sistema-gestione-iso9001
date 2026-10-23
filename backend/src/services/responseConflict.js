/**
 * Conflitto per singola domanda (ADR-008: ultima modifica, niente rifiuto dell'evento).
 * La proiezione sulla riga corrente non sovrascrive una versione già sul server
 * se l'orario della modifica in arrivo è precedente e il testo è diverso.
 * Stesso contenuto = ritento, non è un conflitto.
 */

function normStatus(value) {
    if (value == null || value === '' || value === 'NOT_ANSWERED') return null;
    return String(value);
}

function normNotes(value) {
    if (value == null) return '';
    return String(value);
}

function toMs(value) {
    if (value == null || value === '') return null;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
}

function decideResponseProjection({
    incomingClientTs,
    incomingStatus,
    incomingNotes,
    incomingDeviceId = null,
    existing = null,
} = {}) {
    if (!existing) {
        return { apply: true, conflict: null };
    }

    const same = normStatus(incomingStatus) === normStatus(existing.conformity_status)
        && normNotes(incomingNotes) === normNotes(existing.notes);
    if (same) {
        return { apply: true, conflict: null, idempotent: true };
    }

    const incomingMs = toMs(incomingClientTs);
    const serverMs = toMs(existing.updated_at);
    if (incomingMs == null || serverMs == null || incomingMs >= serverMs) {
        return { apply: true, conflict: null };
    }

    return {
        apply: false,
        conflict: {
            question_id: existing.question_id ?? null,
            reason: 'server_newer',
            server: {
                conformity_status: existing.conformity_status ?? null,
                notes: existing.notes ?? null,
                updated_at: existing.updated_at,
                device_id: existing.device_id ?? null,
            },
            client: {
                conformity_status: normStatus(incomingStatus),
                notes: normNotes(incomingNotes),
                client_ts: incomingClientTs,
                device_id: incomingDeviceId ?? null,
            },
        },
    };
}

module.exports = { decideResponseProjection };
