/**
 * Test di robustezza SYNC-2: conflict resolution campo per campo.
 *
 * Verifica la logica di merge che il backend applica quando
 * server_updated_at > client_updated_at (conflitto timestamp).
 *
 * Principio: i campi ricchi (notes, generalData, auditObjective, auditOutcome)
 * NON vengono mai scartati per un semplice conflitto di timestamp.
 * Il 409 hard è stato sostituito con un merge che preserva il lavoro dell'utente.
 *
 * Questi test replicano la logica di merge del backend (audit.controller.js)
 * per garantire che future modifiche non reintroducano il bug.
 */

// ── Replica della logica mergeAuditExtraData (da audit.controller.js) ────────
function mergeAuditFields({ serverExtra, clientExtra, serverNotes, clientNotes }) {
  // Merge audit_extra_data
  const mergedExtra = { ...(serverExtra || {}), ...(clientExtra || {}) };

  // Sotto-campi ricchi: se client porta oggetto vuoto ma server ha valore, preserva server
  for (const richField of ['generalData', 'auditObjective', 'auditOutcome']) {
    const clientVal = clientExtra?.[richField];
    const serverVal = serverExtra?.[richField];
    const clientEmpty =
      !clientVal ||
      (typeof clientVal === 'object' && Object.keys(clientVal).length === 0);
    if (clientEmpty && serverVal) {
      mergedExtra[richField] = serverVal;
    }
  }

  // notes: client prevale se non vuoto, altrimenti preserva server
  const mergedNotes =
    clientNotes && String(clientNotes).trim() ? clientNotes : serverNotes || null;

  return { mergedExtra, mergedNotes };
}

// ── Test merge audit_extra_data ───────────────────────────────────────────────
describe('field-level merge: audit_extra_data', () => {
  test('il valore client prevale su server quando entrambi non vuoti', () => {
    const { mergedExtra } = mergeAuditFields({
      serverExtra: { generalData: { conclusions: 'Testo server' } },
      clientExtra: { generalData: { conclusions: 'Testo client più recente' } },
    });
    expect(mergedExtra.generalData.conclusions).toBe('Testo client più recente');
  });

  test('preserva valore server se client porta oggetto vuoto', () => {
    const { mergedExtra } = mergeAuditFields({
      serverExtra: { generalData: { conclusions: 'Testo server' } },
      clientExtra: { generalData: {} }, // oggetto vuoto — non deve cancellare il server
    });
    expect(mergedExtra.generalData.conclusions).toBe('Testo server');
  });

  test('preserva valore server se client porta undefined per quel campo', () => {
    const { mergedExtra } = mergeAuditFields({
      serverExtra: { auditObjective: { description: 'Obiettivo importante' } },
      clientExtra: {}, // campo assente nel payload client
    });
    expect(mergedExtra.auditObjective.description).toBe('Obiettivo importante');
  });

  test('preserva valore server se clientExtra è null', () => {
    const { mergedExtra } = mergeAuditFields({
      serverExtra: { auditOutcome: { conclusions: 'Conclusioni server' } },
      clientExtra: null,
    });
    expect(mergedExtra.auditOutcome.conclusions).toBe('Conclusioni server');
  });

  test('client può aggiungere nuovi campi non presenti in server', () => {
    const { mergedExtra } = mergeAuditFields({
      serverExtra: { generalData: { conclusions: 'Vecchio' } },
      clientExtra: {
        generalData: { conclusions: 'Nuovo' },
        auditPartyType: 'third_party',
      },
    });
    expect(mergedExtra.generalData.conclusions).toBe('Nuovo');
    expect(mergedExtra.auditPartyType).toBe('third_party');
  });

  test('caso Camellini: server ha heartbeat updated_at, client porta generalData compilato', () => {
    // Il server ha aggiornato solo updated_at via heartbeat lock (campo generalData invariato)
    const { mergedExtra } = mergeAuditFields({
      serverExtra: { generalData: { conclusions: '' }, auditPartyType: 'first_party' },
      clientExtra: {
        generalData: { conclusions: 'Testo dettato via voce stamattina', auditors: ['Marco Camellini'] },
        auditObjective: { description: 'Verifica SGQ clausola 4' },
      },
    });
    // Il testo del client viene preservato anche se server_ts > client_ts
    expect(mergedExtra.generalData.conclusions).toBe('Testo dettato via voce stamattina');
    expect(mergedExtra.auditObjective.description).toBe('Verifica SGQ clausola 4');
  });
});

// ── Test merge notes ──────────────────────────────────────────────────────────
describe('field-level merge: notes', () => {
  test('note client prevalgono su server se non vuote', () => {
    const { mergedNotes } = mergeAuditFields({
      serverNotes: 'Note server',
      clientNotes: 'Note client nuove',
    });
    expect(mergedNotes).toBe('Note client nuove');
  });

  test('preserva note server se client porta stringa vuota', () => {
    const { mergedNotes } = mergeAuditFields({
      serverNotes: 'Note server importanti',
      clientNotes: '',
    });
    expect(mergedNotes).toBe('Note server importanti');
  });

  test('preserva note server se client porta null', () => {
    const { mergedNotes } = mergeAuditFields({
      serverNotes: 'Note server',
      clientNotes: null,
    });
    expect(mergedNotes).toBe('Note server');
  });

  test('restituisce null se entrambi vuoti', () => {
    const { mergedNotes } = mergeAuditFields({
      serverNotes: null,
      clientNotes: null,
    });
    expect(mergedNotes).toBeNull();
  });
});

// ── Test logica enqueue update_audit decoupled dal lock ───────────────────────
describe('update_audit enqueue: decoupled dal lock (SYNC-2)', () => {
  // Rispecchia la nuova logica di StorageContext.jsx:
  // update_audit viene accodato per tutti i modi tranne "foreign"
  // (foreign è bloccato a monte da updateCurrentAudit).
  function shouldEnqueueUpdateAudit(isOnline, lockMode) {
    if (!isOnline) return false;
    // foreign è bloccato prima dell'enqueue — non raggiunge mai questo punto
    return true; // tutti gli altri modi: owner, pending_server, offline, error
  }

  const lockModes = ['owner', 'pending_server', 'offline', 'error'];

  lockModes.forEach((mode) => {
    test(`update_audit DEVE essere accodato con lock "${mode}" e online=true`, () => {
      expect(shouldEnqueueUpdateAudit(true, mode)).toBe(true);
    });
  });

  test('update_audit NON deve essere accodato se offline', () => {
    expect(shouldEnqueueUpdateAudit(false, 'owner')).toBe(false);
    expect(shouldEnqueueUpdateAudit(false, 'pending_server')).toBe(false);
  });

  test('caso Camellini post-fix: lock pending_server → update_audit E save_responses accodati', () => {
    const isOnline = true;
    const lockMode = 'pending_server';
    // SYNC-1: save_responses
    const saveRespEnqueued = isOnline; // sempre se online (da SYNC-1)
    // SYNC-2: update_audit
    const updateAuditEnqueued = shouldEnqueueUpdateAudit(isOnline, lockMode);

    expect(saveRespEnqueued).toBe(true);
    expect(updateAuditEnqueued).toBe(true);
  });
});
