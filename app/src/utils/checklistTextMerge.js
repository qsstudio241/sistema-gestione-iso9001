/**
 * Merge note/evidenze checklist: server-wins all'apertura, ma il testo
 * digitato in corso (locale più ricco o campo in draft) non viene mai sovrascritto.
 */

import { hasAnyDraftForAudit, isDraft } from './draftFieldRegistry';

export function shouldKeepLocalText(localText, serverText, { forceLocal = false } = {}) {
  if (forceLocal) return true;
  const local = localText == null ? '' : String(localText);
  const server = serverText == null ? '' : String(serverText);
  if (local === server) return false;
  if (!local.trim() && server.trim()) return false;
  if (local.trim() && !server.trim()) return true;
  if (local.length > server.length) return true;
  if (server.length > local.length) return false;
  return local !== server;
}

export function pickMergedNotes(localNotes, serverNotes, options = {}) {
  return shouldKeepLocalText(localNotes, serverNotes, options) ? (localNotes ?? '') : (serverNotes ?? '');
}

/**
 * Applica risposte server sulla checklist mantenendo note locali se necessario.
 * @param {object} checklist - checklist audit (mutata in copia)
 * @param {Record<number, {status, notes}>} responseMap - da getAuditResponses
 * @param {string|null} auditUuid - per draft guard
 */
export function applyServerResponsesPreservingLocalNotes(checklist, responseMap, auditUuid = null, options = {}) {
  if (!checklist || !responseMap) return 0;
  const pendingIds = options?.pendingQuestionIds instanceof Set ? options.pendingQuestionIds : null;
  let applied = 0;

  Object.values(checklist).forEach((normData) => {
    if (!normData || typeof normData !== 'object') return;
    Object.values(normData).forEach((clauseData) => {
      if (!clauseData?.questions) return;
      clauseData.questions = clauseData.questions.map((q) => {
        const clauseKey = q.clauseRef ? `clause:${q.clauseRef}` : null;
        if (pendingIds?.has(String(q.questionId)) || (clauseKey && pendingIds?.has(clauseKey))) return q;
        if (!q.questionId || !responseMap[q.questionId]) return q;
        applied++;
        const serverData = responseMap[q.questionId];
        const fieldId = `q:${q.questionId}`;
        const notes = pickMergedNotes(q.notes, serverData.notes, {
          forceLocal: auditUuid ? isDraft(auditUuid, fieldId) : false,
        });
        return {
          ...q,
          status: serverData.status,
          notes,
          serverUpdatedAt: serverData.updated_at || q.serverUpdatedAt || null,
        };
      });
    });
  });

  return applied;
}

export function checklistQuestionBindSignature(checklist) {
  let total = 0;
  let withId = 0;
  if (!checklist) return '0:0';
  Object.values(checklist).forEach((normData) => {
    if (!normData || typeof normData !== 'object') return;
    Object.values(normData).forEach((clauseData) => {
      clauseData?.questions?.forEach((q) => {
        total += 1;
        if (q?.questionId != null && q.questionId !== '') withId += 1;
      });
    });
  });
  return `${total}:${withId}`;
}

export function countPendingMatches(checklist, pendingQuestions) {
  if (!checklist || !Array.isArray(pendingQuestions) || pendingQuestions.length === 0) return 0;
  const byId = new Map();
  const byClause = new Map();
  pendingQuestions.forEach((item) => {
    if (item?.questionId != null && item.questionId !== '') byId.set(String(item.questionId), item);
    if (item?.clauseRef) byClause.set(String(item.clauseRef), item);
  });
  let matches = 0;
  Object.values(checklist).forEach((normData) => {
    if (!normData || typeof normData !== 'object') return;
    Object.values(normData).forEach((clauseData) => {
      clauseData?.questions?.forEach((q) => {
        const pending = (q.questionId != null && byId.get(String(q.questionId)))
          || (q.clauseRef && byClause.get(String(q.clauseRef)));
        if (pending) matches += 1;
      });
    });
  });
  return matches;
}

export function applyPendingAnswersToChecklist(checklist, pendingQuestions) {
  if (!checklist || !Array.isArray(pendingQuestions) || pendingQuestions.length === 0) return checklist;
  const byId = new Map();
  const byClause = new Map();
  pendingQuestions.forEach((item) => {
    if (item?.questionId != null && item.questionId !== '') byId.set(String(item.questionId), item);
    if (item?.clauseRef) byClause.set(String(item.clauseRef), item);
  });
  Object.values(checklist).forEach((normData) => {
    if (!normData || typeof normData !== 'object') return;
    Object.values(normData).forEach((clauseData) => {
      if (!clauseData?.questions) return;
      clauseData.questions = clauseData.questions.map((q) => {
        const pending = (q.questionId != null && byId.get(String(q.questionId)))
          || (q.clauseRef && byClause.get(String(q.clauseRef)));
        if (!pending) return q;
        const status = pending.status || 'NOT_ANSWERED';
        return {
          ...q,
          status,
          notes: pending.notes ?? q.notes ?? '',
        };
      });
    });
  });
  return checklist;
}

export function applyServerWinnersToChecklist(checklist, conflicts) {
  if (!checklist || !Array.isArray(conflicts) || conflicts.length === 0) return checklist;
  const byId = new Map(conflicts.map((item) => [String(item.question_id), item]));
  Object.values(checklist).forEach((normData) => {
    if (!normData || typeof normData !== 'object') return;
    Object.values(normData).forEach((clauseData) => {
      if (!clauseData?.questions) return;
      clauseData.questions = clauseData.questions.map((q) => {
        const winner = byId.get(String(q.questionId));
        if (!winner?.server) return q;
        const status = winner.server.conformity_status || 'NOT_ANSWERED';
        return {
          ...q,
          status,
          notes: winner.server.notes ?? '',
          serverUpdatedAt: winner.server.updated_at || q.serverUpdatedAt || null,
        };
      });
    });
  });
  return checklist;
}

function countChecklistProgress(checklist) {
  if (!checklist) return { answered: 0, withNotes: 0 };
  let answered = 0;
  let withNotes = 0;
  Object.values(checklist).forEach((normData) => {
    if (!normData || typeof normData !== 'object') return;
    Object.values(normData).forEach((clauseData) => {
      clauseData?.questions?.forEach((q) => {
        if (q.status && q.status !== 'NOT_ANSWERED') answered++;
        if (q.notes && String(q.notes).trim()) withNotes++;
      });
    });
  });
  return { answered, withNotes };
}

/**
 * Unisce checklist server (es. legacy audit_extra_data) con locale in memoria:
 * per ogni domanda con questionId, preserva note/status locali se più ricchi o in draft.
 */
export function mergeChecklistStructuresLocalRichWins(localChecklist, serverChecklist, auditUuid = null) {
  if (!localChecklist) return serverChecklist;
  if (!serverChecklist) return localChecklist;

  const merged = JSON.parse(JSON.stringify(serverChecklist));

  Object.entries(localChecklist).forEach(([normKey, localNorm]) => {
    if (!localNorm || typeof localNorm !== 'object') return;
    if (!merged[normKey]) merged[normKey] = {};

    Object.entries(localNorm).forEach(([clauseKey, localClause]) => {
      if (!localClause?.questions) return;
      const serverClause = merged[normKey][clauseKey];
      if (!serverClause?.questions) {
        merged[normKey][clauseKey] = JSON.parse(JSON.stringify(localClause));
        return;
      }

      const serverByQid = new Map(
        serverClause.questions.filter((q) => q.questionId).map((q) => [q.questionId, q]),
      );

      merged[normKey][clauseKey] = {
        ...serverClause,
        questions: serverClause.questions.map((sq) => {
          const lq = localClause.questions.find(
            (q) => q.questionId && q.questionId === sq.questionId,
          );
          if (!lq) return sq;
          const fieldId = `q:${sq.questionId}`;
          const keepLocal = isDraft(auditUuid, fieldId) ||
            shouldKeepLocalText(lq.notes, sq.notes) ||
            (lq.status && lq.status !== 'NOT_ANSWERED' && (!sq.status || sq.status === 'NOT_ANSWERED'));

          if (!keepLocal) return sq;
          return {
            ...sq,
            status: lq.status ?? sq.status,
            notes: pickMergedNotes(lq.notes, sq.notes, { forceLocal: isDraft(auditUuid, fieldId) }),
          };
        }),
      };

      // Domande presenti solo in locale (es. init template)
      localClause.questions.forEach((lq) => {
        if (!lq.questionId || serverByQid.has(lq.questionId)) return;
        merged[normKey][clauseKey].questions.push({ ...lq });
      });
    });
  });

  return merged;
}

/** True se il locale ha più progresso compilazione del server (reconcile). */
export function localChecklistIsRicher(localChecklist, serverChecklist) {
  const local = countChecklistProgress(localChecklist);
  const server = countChecklistProgress(serverChecklist);
  if (local.answered > server.answered) return true;
  if (local.withNotes > server.withNotes) return true;
  return false;
}

/**
 * Checklist reconcile: server-wins salvo norme vuote, draft attivo o locale più ricco.
 */
export function resolveMergedChecklistForReconcile(localChecklist, serverChecklist, auditUuid = null) {
  const serverChecklistEntries = Object.entries(serverChecklist || {});
  const localChecklistKeys = Object.keys(localChecklist || {});
  const serverHasOnlyEmptyNorms = serverChecklistEntries.length > 0 &&
    serverChecklistEntries.every(([, normData]) =>
      !normData || typeof normData !== 'object' || Object.keys(normData).length === 0,
    );

  if (localChecklistKeys.length > 0 &&
      (serverChecklistEntries.length === 0 || serverHasOnlyEmptyNorms)) {
    return localChecklist;
  }

  if (localChecklist && serverChecklist &&
      (hasAnyDraftForAudit(auditUuid) || localChecklistIsRicher(localChecklist, serverChecklist))) {
    return mergeChecklistStructuresLocalRichWins(localChecklist, serverChecklist, auditUuid);
  }

  return serverChecklist;
}

/** Merge evidenze custom (primo blocco testo) preservando draft e testo locale più ricco. */
export function mergeCustomEvidenceResponses(localResponses, serverResponses, auditUuid = null) {
  const merged = { ...(localResponses || {}) };
  Object.entries(serverResponses || {}).forEach(([itemId, serverBlocks]) => {
    const localBlocks = localResponses?.[itemId];
    const localText = localBlocks?.[0]?.text ?? '';
    const serverText = serverBlocks?.[0]?.text ?? '';
    const fieldId = `custom:${itemId}`;
    const keepLocal = isDraft(auditUuid, fieldId) ||
      shouldKeepLocalText(localText, serverText);
    if ((serverBlocks || []).length > 0 && !keepLocal) {
      merged[itemId] = serverBlocks;
    } else if (keepLocal && (localBlocks || []).length > 0) {
      merged[itemId] = localBlocks;
    } else if ((serverBlocks || []).length > 0) {
      merged[itemId] = serverBlocks;
    }
  });
  return merged;
}
