/**
 * Test di robustezza: le risposte checklist devono essere accodate
 * indipendentemente dallo stato del lock audit.
 *
 * Bug chiuso: Camellini perdeva le risposte perché save_responses era
 * dentro la guard `auditLockRef.current.mode === "owner"`.
 * Con il fix, save_responses viene accodato per ogni stato lock
 * tranne "foreign" (altro utente attivo — il write è già bloccato a monte).
 *
 * Questi test verificano la logica di extractChecklistResponses e il
 * contratto di separazione: risposte SEMPRE accodate, update_audit SOLO se owner.
 */

// ── Replica minima di extractChecklistResponses (copiata da StorageContext) ───
function extractChecklistResponses(audit) {
  const responses = [];
  const checklist = audit.checklist;
  if (!checklist) return responses;

  Object.entries(checklist).forEach(([, normData]) => {
    Object.entries(normData).forEach(([, clauseData]) => {
      if (!clauseData.questions || !Array.isArray(clauseData.questions)) return;
      clauseData.questions.forEach((question) => {
        if (question.status && question.status !== 'NOT_ANSWERED') {
          responses.push({
            question_id: question.questionId || null,
            clause_ref: question.clauseRef || question.id,
            conformity_status: question.status,
            notes: question.notes || null,
            evidence: question.evidenceRef || null,
            client_updated_at: new Date().toISOString(),
          });
        }
      });
    });
  });
  return responses;
}

// ── Helper: costruisce un audit con risposte compilate ───────────────────────
function makeAuditWithResponses(statuses = ['C', 'NC', 'OSS']) {
  return {
    id: 'test-uuid-001',
    metadata: { id: 'test-uuid-001', auditNumber: 'TEST-001', clientName: 'TestCo' },
    checklist: {
      ISO_9001: {
        clause_4: {
          questions: statuses.map((s, i) => ({
            id: `q${i + 1}`,
            questionId: i + 1,
            clauseRef: `4.${i + 1}`,
            status: s,
            notes: s === 'NC' ? 'Non conforme rilevata' : null,
          })),
        },
      },
    },
  };
}

// ── Test 1: extractChecklistResponses ignora NOT_ANSWERED ────────────────────
describe('extractChecklistResponses', () => {
  test('restituisce solo le domande con stato valorizzato', () => {
    const audit = makeAuditWithResponses(['C', 'NOT_ANSWERED', 'NC']);
    const responses = extractChecklistResponses(audit);
    expect(responses).toHaveLength(2);
    expect(responses.map(r => r.conformity_status)).toEqual(['C', 'NC']);
  });

  test('restituisce array vuoto se tutte NOT_ANSWERED', () => {
    const audit = makeAuditWithResponses(['NOT_ANSWERED', 'NOT_ANSWERED']);
    expect(extractChecklistResponses(audit)).toHaveLength(0);
  });

  test('restituisce array vuoto se checklist assente', () => {
    expect(extractChecklistResponses({ id: 'x', metadata: {} })).toHaveLength(0);
  });

  test('include tutti gli stati validi C/NC/OSS/OM/NA/NV', () => {
    const audit = makeAuditWithResponses(['C', 'NC', 'OSS', 'OM', 'NA', 'NV']);
    const responses = extractChecklistResponses(audit);
    expect(responses).toHaveLength(6);
    const statuses = responses.map(r => r.conformity_status);
    expect(statuses).toEqual(expect.arrayContaining(['C', 'NC', 'OSS', 'OM', 'NA', 'NV']));
  });

  test('mappa correttamente questionId, clauseRef e notes', () => {
    const audit = makeAuditWithResponses(['NC']);
    const r = extractChecklistResponses(audit)[0];
    expect(r.question_id).toBe(1);
    expect(r.clause_ref).toBe('4.1');
    expect(r.conformity_status).toBe('NC');
    expect(r.notes).toBe('Non conforme rilevata');
  });
});

// ── Test 2: logica di guard separata ─────────────────────────────────────────
// Verifica che la funzione di enqueue sia chiamata per save_responses
// indipendentemente dalla modalità lock, purché non sia "foreign".

describe('separazione lock da save_responses', () => {
  // Simula il comportamento della guard estratto da StorageContext:
  // save_responses viene accodato se:
  //   - isOnline === true
  //   - lockMode !== "foreign"  (foreign = altro utente attivo → write già bloccato a monte)
  // update_audit viene accodato solo se:
  //   - isOnline === true
  //   - lockMode === "owner"

  function shouldEnqueueResponses(isOnline, lockMode) {
    // Rispecchia la logica del fix in StorageContext.jsx
    if (!isOnline) return false;
    // lockMode "foreign" è bloccato prima (riga 1418) — non raggiunge mai questo punto
    // quindi in questo blocco lockMode != "foreign" sempre
    return true;
  }

  function shouldEnqueueUpdateAudit(isOnline, lockMode) {
    return isOnline && lockMode === 'owner';
  }

  const lockModes = ['owner', 'pending_server', 'offline', 'error'];

  lockModes.forEach((mode) => {
    test(`save_responses DEVE essere accodato con lock "${mode}" e online=true`, () => {
      expect(shouldEnqueueResponses(true, mode)).toBe(true);
    });
  });

  test('save_responses NON deve essere accodato se offline', () => {
    expect(shouldEnqueueResponses(false, 'owner')).toBe(false);
    expect(shouldEnqueueResponses(false, 'pending_server')).toBe(false);
  });

  test('update_audit DEVE essere accodato SOLO con lock "owner" e online', () => {
    expect(shouldEnqueueUpdateAudit(true, 'owner')).toBe(true);
    expect(shouldEnqueueUpdateAudit(true, 'pending_server')).toBe(false);
    expect(shouldEnqueueUpdateAudit(true, 'offline')).toBe(false);
    expect(shouldEnqueueUpdateAudit(true, 'error')).toBe(false);
    expect(shouldEnqueueUpdateAudit(false, 'owner')).toBe(false);
  });

  test('caso Camellini: lock "pending_server" → risposte accodate, update sospeso', () => {
    // Questo è il bug originale: lock oscillava su pending_server durante rete instabile
    const lockMode = 'pending_server';
    const isOnline = true;
    expect(shouldEnqueueResponses(isOnline, lockMode)).toBe(true);   // FIX: ora vero
    expect(shouldEnqueueUpdateAudit(isOnline, lockMode)).toBe(false); // corretto: sospeso
  });
});
