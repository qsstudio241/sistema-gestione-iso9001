/**
 * Regole workflow NC ISO 10.2 - gate verifica efficacia e scadenze azioni
 */

const NC_VALID_NEXT = {
  open:        ['in_progress'],
  in_progress: ['resolved'],
  resolved:    ['verified'],
  verified:    [],
  closed:      [],
};

/** Transizioni workflow principali (sez. 2 drawer), esclusa chiusura formale */
export function getNcWorkflowTransitionButtons(nc) {
  return [...(NC_VALID_NEXT[nc?.status] || [])];
}

/** Pulsante Chiudi NC (sez. 7) - solo dopo approvazione RQ */
export function getNcClosureButton(nc) {
  if (nc?.status === 'verified' && nc?.approved_at) {
    return 'closed';
  }
  return null;
}

export function needsVerificationNotesForStatus(status) {
  return status === 'verified' || status === 'closed';
}

/**
 * @param {{ role?: string }} user
 * @returns {boolean}
 */
export function canApproveNcClosure(user) {
  const role = user?.role;
  return role === 'admin' || role === 'superadmin';
}

/** RQ/admin possono riaprire una NC chiusa (ISO: nuova evidenza, correzione errore). */
export function canReopenNc(user) {
  return canApproveNcClosure(user);
}

/** Target stato dopo riapertura (workflow riparte da lavorazione). */
export const NC_REOPEN_TARGET_STATUS = 'in_progress';

/**
 * @param {object} nc
 * @param {{ role?: string }} user
 * @returns {string|null} Stato destinazione se il pulsante Riapri va mostrato
 */
export function getNcReopenButton(nc, user) {
  if (nc?.status === 'closed' && canReopenNc(user)) {
    return NC_REOPEN_TARGET_STATUS;
  }
  return null;
}

/**
 * @param {object} nc
 * @param {string} newStatus
 * @returns {{ ok: boolean, message?: string }}
 */
export function canTransitionNcStatus(nc, newStatus) {
  if (newStatus === 'closed') {
    if (!nc?.approved_at) {
      return {
        ok: false,
        message:
          'La chiusura richiede l\'approvazione del Responsabile Qualit\u00E0. Usare \u00ABApprova chiusura\u00BB prima di chiudere.',
      };
    }
  }
  if (newStatus === 'resolved') {
    if ((nc?.correction_completed_count || 0) === 0) {
      return {
        ok: false,
        message:
          'Registrare almeno una Correzione (azione immediata) completata prima di segnare la NC come Risolta (ISO 10.2.1 a).',
      };
    }
  }
  if (!needsVerificationNotesForStatus(newStatus)) {
    return { ok: true };
  }
  const notes = (nc?.verification_notes || '').trim();
  if (!notes) {
    return {
      ok: false,
      message:
        'Compilare le note verifica nel pannello dettaglio e salvarle prima di passare a Verificata o Chiusa.',
    };
  }
  return { ok: true };
}

/**
 * @param {string} verificationNote
 * @returns {boolean}
 */
export function canVerifyAction(verificationNote) {
  return (verificationNote || '').trim().length > 0;
}

/** Stati azione per cui la scadenza non conta pi\u00F9 */
const ACTION_TERMINAL_STATUSES = new Set(['completed', 'verified']);

/**
 * @param {string|Date|null|undefined} dueDate
 * @returns {Date|null} Solo componente data locale (mezzanotte)
 */
export function parseDueDateLocal(dueDate) {
  if (!dueDate) return null;
  const s = String(dueDate);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(dueDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfTodayLocal() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/**
 * Scadenza superata (solo data, esclusi stati terminali azione).
 * @param {{ due_date?: string, status?: string }} item
 */
export function isItemOverdue(item) {
  if (!item?.due_date) return false;
  if (item.status && ACTION_TERMINAL_STATUSES.has(item.status)) return false;
  const due = parseDueDateLocal(item.due_date);
  if (!due) return false;
  return due < startOfTodayLocal();
}

/**
 * Scade entro N giorni incluso oggi, non ancora scaduta.
 * @param {{ due_date?: string, status?: string }} item
 * @param {number} [withinDays=7]
 */
export function isItemDueSoon(item, withinDays = 7) {
  if (!item?.due_date) return false;
  if (item.status && ACTION_TERMINAL_STATUSES.has(item.status)) return false;
  const due = parseDueDateLocal(item.due_date);
  if (!due) return false;
  const today = startOfTodayLocal();
  if (due < today) return false;
  const limit = new Date(today);
  limit.setDate(limit.getDate() + withinDays);
  return due <= limit;
}

/** @returns {'overdue'|'due_soon'|null} */
export function getActionDueStatus(action, withinDays = 7) {
  if (isItemOverdue(action)) return 'overdue';
  if (isItemDueSoon(action, withinDays)) return 'due_soon';
  return null;
}

/**
 * Filtra azioni per scadenza (solo UI, dati gi\u00E0 caricati per NC).
 * @param {'all'|'overdue'|'due_soon'} mode
 */
export function filterActionsByDue(actions, mode, withinDays = 7) {
  if (!mode || mode === 'all') return actions;
  if (mode === 'overdue') {
    return actions.filter(a => isItemOverdue(a));
  }
  if (mode === 'due_soon') {
    return actions.filter(a => isItemDueSoon(a, withinDays));
  }
  return actions;
}
