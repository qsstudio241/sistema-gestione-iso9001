/**
 * Regole workflow NC ISO 10.2 — semplificato: Aperta | Chiusa
 *
 * Percorso A (azione correttiva non necessaria): correzione + verifica attuazione trattamento
 * Percorso B (azione correttiva necessaria): + cause + azioni + verifica efficacia
 * Chiudi solo se responsabile verifica selezionato (verification_contact_id) — nessun automatismo.
 */

/** Stati legacy ancora presenti a DB; in UI si mostrano come Aperta */
export const NC_LEGACY_OPEN_STATUSES = ['open', 'in_progress', 'resolved', 'verified'];

export function isNcClosedStatus(status) {
  return status === 'closed';
}

/** Etichetta UI: solo Aperta / Chiusa */
export function getNcDisplayStatus(status) {
  return isNcClosedStatus(status) ? 'closed' : 'open';
}

export function isNcOpenLike(status) {
  return !isNcClosedStatus(status);
}

/**
 * Percorso operativo dalla valutazione ISO 10.2.1 b)
 * @returns {'simple'|'full'|'unset'}
 */
export function getNcWorkflowProfile(nc) {
  const v = String(nc?.corrective_action_needed || '').trim().toLowerCase();
  if (v === 'no') return 'simple';
  if (v === 'yes') return 'full';
  return 'unset';
}

/** Admin/RQ possono riaprire una NC chiusa */
export function canReopenNc(user) {
  const role = user?.role;
  return role === 'admin' || role === 'superadmin';
}

/** @deprecated Preferire canReopenNc — approvazione RQ rimossa dal flusso */
export function canApproveNcClosure(user) {
  return canReopenNc(user);
}

/** Target stato dopo riapertura */
export const NC_REOPEN_TARGET_STATUS = 'open';

/**
 * @param {object} nc
 * @param {{ role?: string }} user
 * @returns {string|null}
 */
export function getNcReopenButton(nc, user) {
  if (nc?.status === 'closed' && canReopenNc(user)) {
    return NC_REOPEN_TARGET_STATUS;
  }
  return null;
}

/**
 * @deprecated Transizioni intermedie rimosse — usare canCloseNc / getNcClosureButton
 */
export function getNcWorkflowTransitionButtons() {
  return [];
}

function hasText(val) {
  return (val || '').toString().trim().length > 0;
}

function correctionDone(nc) {
  return Number(nc?.correction_completed_count || 0) > 0;
}

function correctiveActionsDone(nc) {
  return Number(nc?.corrective_completed_count || 0) > 0;
}

/** Responsabile verifica selezionato dal menu (nessun autocompletamento) */
export function hasVerificationResponsibleSelected(nc) {
  const id = nc?.verification_contact_id;
  return id != null && id !== '' && Number(id) > 0;
}

/**
 * Gate chiusura NC (UI + allineato al backend).
 * @param {object} nc
 * @returns {{ ok: boolean, message?: string, profile?: string }}
 */
export function canCloseNc(nc) {
  if (!nc || isNcClosedStatus(nc.status)) {
    return { ok: false, message: 'La NC è già chiusa.' };
  }

  const profile = getNcWorkflowProfile(nc);
  if (profile === 'unset') {
    return {
      ok: false,
      message:
        'Indicare se è necessaria un\'azione correttiva (Sì/No), salvare, poi completare i campi richiesti.',
      profile,
    };
  }

  if (!correctionDone(nc)) {
    return {
      ok: false,
      message:
        'Registrare e completare almeno una Correzione (trattamento immediato) prima di chiudere (ISO 10.2.1 a).',
      profile,
    };
  }

  if (!hasVerificationResponsibleSelected(nc)) {
    return {
      ok: false,
      message:
        'Selezionare il Responsabile verifica dal menu a tendina e salvare prima di chiudere.',
      profile,
    };
  }

  if (!hasText(nc?.verification_notes)) {
    return {
      ok: false,
      message: 'Compilare le note di verifica attuazione del trattamento e salvare prima di chiudere.',
      profile,
    };
  }

  if (profile === 'simple') {
    if (!hasText(nc?.corrective_action_evaluation_notes)) {
      return {
        ok: false,
        message:
          'Motivare perché l\'azione correttiva non è necessaria e salvare prima di chiudere.',
        profile,
      };
    }
    return { ok: true, profile };
  }

  // Percorso completo (azione correttiva necessaria)
  if (!hasText(nc?.root_cause)) {
    return {
      ok: false,
      message: 'Compilare l\'analisi causa radice e salvare prima di chiudere.',
      profile,
    };
  }
  if (!correctiveActionsDone(nc)) {
    return {
      ok: false,
      message:
        'Completare almeno un\'azione correttiva prima di chiudere (ISO 10.2.1 c).',
      profile,
    };
  }
  if (!hasText(nc?.effectiveness_verification_notes)) {
    return {
      ok: false,
      message:
        'Compilare le note di verifica efficacia dell\'azione correttiva e salvare prima di chiudere (ISO 10.2.1 e).',
      profile,
    };
  }
  return { ok: true, profile };
}

/** Pulsante Chiudi — solo se i gate sono soddisfatti */
export function getNcClosureButton(nc) {
  return canCloseNc(nc).ok ? 'closed' : null;
}

/**
 * @param {object} nc
 * @param {string} newStatus
 * @returns {{ ok: boolean, message?: string }}
 */
export function canTransitionNcStatus(nc, newStatus) {
  if (newStatus === 'closed') {
    return canCloseNc(nc);
  }
  if (newStatus === 'open') {
    // Riapertura (admin) o normalizzazione legacy → Aperta
    return { ok: true };
  }
  // Transizioni intermedie non più usate nel flusso UI
  if (['resolved', 'verified', 'in_progress'].includes(newStatus)) {
    return {
      ok: false,
      message: 'Flusso semplificato: usare solo Aperta e Chiusa.',
    };
  }
  return { ok: true };
}

/** @deprecated Gate note ora in canCloseNc */
export function needsVerificationNotesForStatus(status) {
  return status === 'closed' || status === 'verified';
}

/**
 * @param {string} verificationNote
 * @returns {boolean}
 */
export function canVerifyAction(verificationNote) {
  return (verificationNote || '').trim().length > 0;
}

/** Stati azione per cui la scadenza non conta più */
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
 * Filtra azioni per scadenza (solo UI, dati già caricati per NC).
 * @param {'all'|'overdue'|'due_soon'} mode
 */
export function filterActionsByDue(actions, mode, withinDays = 7) {
  if (!mode || mode === 'all') return actions;
  if (mode === 'overdue') {
    return actions.filter((a) => isItemOverdue(a));
  }
  if (mode === 'due_soon') {
    return actions.filter((a) => isItemDueSoon(a, withinDays));
  }
  return actions;
}
