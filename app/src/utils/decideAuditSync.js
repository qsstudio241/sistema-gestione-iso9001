/**
 * Decide cosa parte in rete per un audit.
 * Funzione pura: stessi ingressi, stessa decisione. Nessun flag in memoria.
 *
 * La scheda (conclusioni, date, note) e lo stato «in corso» non viaggiano insieme.
 * Le domande viaggiano a differenze, dalla loro coda.
 * Sul server la stessa regola del secondo dispositivo è in
 * backend/src/services/responseConflict.js (decideResponseProjection).
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

function payloadMatchesSaveError(payload, err) {
  if (!payload || !err) return false;
  if (payload.questionId != null && err.question_id != null
      && String(payload.questionId) === String(err.question_id)) return true;
  if (payload.clauseRef && err.clause_ref
      && String(payload.clauseRef).trim() === String(err.clause_ref).trim()) return true;
  return false;
}

function errorsFromSaveResult(result, extra) {
  const errors = [];
  if (Array.isArray(extra)) errors.push(...extra);
  const rows = Array.isArray(result?.results) ? result.results : (result ? [result] : []);
  for (const row of rows) {
    if (Array.isArray(row?.errors)) errors.push(...row.errors);
    if (Array.isArray(row?.results?.errors)) errors.push(...row.results.errors);
  }
  if (Array.isArray(result?.errors)) errors.push(...result.errors);
  return errors;
}

function blank(event, status) {
  return {
    event,
    status: status || 'draft',
    nextStatus: status || 'draft',
    sendQuestions: false,
    sendStatusOnly: false,
    sendScheda: false,
    bypassLock: false,
    keepPending: true,
    confirmed: [],
    dropKeys: [],
    keepKeys: [],
    rewriteRow: false,
    bumpClock: false,
    showConflict: false,
    conflict: null,
  };
}

/** Prima risposta dell'utente: la bozza diventa «in corso». Le successive no. */
export function eventForAnswer(status) {
  return status === 'draft' || status == null || status === ''
    ? 'first_answer'
    : 'next_answer';
}

export function decideAuditSync(input = {}) {
  const event = input.event;
  const status = input.status || 'draft';
  const base = blank(event, status);

  if (event === 'open_empty') {
    return {
      ...base,
      nextStatus: (!status || status === 'draft') ? 'draft' : status,
      bypassLock: true,
      keepPending: false,
    };
  }

  if (event === 'first_answer') {
    const promote = status === 'draft' || !status;
    return {
      ...base,
      nextStatus: promote ? 'in_progress' : status,
      sendQuestions: true,
      sendStatusOnly: promote,
      sendScheda: false,
    };
  }

  if (event === 'next_answer') {
    return {
      ...base,
      nextStatus: status,
      sendQuestions: true,
      sendStatusOnly: false,
      sendScheda: false,
    };
  }

  if (event === 'refresh_draft') {
    return {
      ...base,
      nextStatus: status,
      bypassLock: true,
      sendQuestions: false,
      sendScheda: false,
      sendStatusOnly: false,
      keepPending: true,
    };
  }

  if (event === 'offline') {
    const online = input.online === true;
    return {
      ...base,
      sendQuestions: online,
      sendScheda: false,
      sendStatusOnly: false,
      keepPending: true,
      questionKeys: Array.isArray(input.pendingKeys) ? input.pendingKeys : [],
    };
  }

  if (event === 'partial_200') {
    const payloads = Array.isArray(input.payloads) ? input.payloads : [];
    const errors = errorsFromSaveResult(input.result, input.errors);
    const confirmed = errors.length === 0
      ? payloads
      : payloads.filter((payload) => !errors.some((err) => payloadMatchesSaveError(payload, err)));
    const rejected = payloads.filter((payload) => !confirmed.includes(payload));
    const keyOf = (payload) => {
      if (payload?.questionId != null && payload.questionId !== '') return String(payload.questionId);
      if (payload?.clauseRef) return String(payload.clauseRef).trim();
      return payload?.questionKey ? String(payload.questionKey) : '';
    };
    return {
      ...base,
      confirmed,
      dropKeys: confirmed.map(keyOf).filter(Boolean),
      keepKeys: rejected.map(keyOf).filter(Boolean),
    };
  }

  if (event === 'other_device') {
    const incoming = input.incoming || {};
    const existing = input.existing || null;
    if (!existing) {
      return { ...base, rewriteRow: true, bumpClock: true };
    }
    const same = normStatus(incoming.status) === normStatus(existing.conformity_status)
      && normNotes(incoming.notes) === normNotes(existing.notes);
    if (same) {
      return { ...base, rewriteRow: false, bumpClock: false, showConflict: false };
    }
    const incomingMs = toMs(incoming.clientTs);
    const serverMs = toMs(existing.updated_at);
    if (incomingMs == null || serverMs == null || incomingMs >= serverMs) {
      return { ...base, rewriteRow: true, bumpClock: true, showConflict: false };
    }
    return {
      ...base,
      rewriteRow: false,
      bumpClock: false,
      showConflict: true,
      conflict: {
        question_id: existing.question_id ?? null,
        reason: 'server_newer',
        server: {
          conformity_status: existing.conformity_status ?? null,
          notes: existing.notes ?? null,
          updated_at: existing.updated_at,
        },
        client: {
          conformity_status: normStatus(incoming.status),
          notes: normNotes(incoming.notes),
          client_ts: incoming.clientTs ?? null,
        },
      },
    };
  }

  if (event === 'scheda') {
    return {
      ...base,
      nextStatus: status,
      sendScheda: true,
      sendQuestions: false,
      sendStatusOnly: false,
    };
  }

  return base;
}
