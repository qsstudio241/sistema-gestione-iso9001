/**
 * Checklist da considerare per chiusura e completamento:
 * solo le norme ancora selezionate in 1.1 Standard Applicabili.
 *
 * Se l'utente attiva una seconda checklist (es. RDP_MSN / Audit di Sistema
 * Saldatura) e poi la spegne senza aver risposto, il template resta in IndexedDB
 * (initializeChecklist non lo rimuoveva). Il pannello chiusura contava anche
 * quelle domande vuote → es. 22/58 = 38% e "Vai al primo campo" puntava a una
 * domanda nascosta (questionId null), quindi scrollava su un campo già compilato.
 */

import {
  CODE_TO_KEY,
  STANDARD_TO_SUBSID,
  getSelectedStandardEntries,
} from "../data/standardsRegistry";

function isAnsweredStatus(status) {
  return Boolean(status && status !== "NOT_ANSWERED");
}

export function isNormUnanswered(normData) {
  if (!normData || typeof normData !== "object") return true;
  return !Object.values(normData).some((clause) =>
    clause?.questions?.some((q) => isAnsweredStatus(q.status)),
  );
}

/**
 * Sottoinsieme di `checklist` limitato alle key canoniche selezionate.
 * Se i dati sono salvati con un alias (es. ISO_3834 invece di ISO_3834_2)
 * li espone sotto la key canonica.
 */
export function pickChecklistForSelectedStandards(checklist, selectedStandards) {
  const entries = getSelectedStandardEntries(selectedStandards);
  if (!checklist || typeof checklist !== "object" || entries.length === 0) {
    return {};
  }
  const out = {};
  for (const entry of entries) {
    if (checklist[entry.key]) {
      out[entry.key] = checklist[entry.key];
      continue;
    }
    const alias = (entry.codes || []).find(
      (code) => code !== entry.key && checklist[code],
    );
    if (alias) out[entry.key] = checklist[alias];
  }
  return out;
}

export function countChecklistQuestions(checklist) {
  let total = 0;
  let answered = 0;
  if (!checklist || typeof checklist !== "object") {
    return { total, answered };
  }
  Object.values(checklist).forEach((norm) => {
    if (!norm || typeof norm !== "object") return;
    Object.values(norm).forEach((clause) => {
      (clause?.questions || []).forEach((q) => {
        total++;
        if (isAnsweredStatus(q.status)) answered++;
      });
    });
  });
  return { total, answered };
}

export function calcChecklistCompletion(checklist) {
  const { total, answered } = countChecklistQuestions(checklist);
  return total === 0 ? 0 : Math.round((answered / total) * 100);
}

export function calcNormCompletion(normData) {
  if (!normData || typeof normData !== "object") return 0;
  let total = 0;
  let answered = 0;
  Object.values(normData).forEach((clause) => {
    (clause?.questions || []).forEach((q) => {
      total++;
      if (isAnsweredStatus(q.status)) answered++;
    });
  });
  return total === 0 ? 0 : Math.round((answered / total) * 100);
}

/** Prima domanda non risposta: { subsId, fieldId } per la navigazione guidata. */
export function getFirstUnansweredTarget(checklist) {
  for (const [normKey, normData] of Object.entries(checklist || {})) {
    if (!normData || typeof normData !== "object") continue;
    for (const clause of Object.values(normData)) {
      for (const q of clause?.questions || []) {
        if (!isAnsweredStatus(q.status)) {
          const subsId = STANDARD_TO_SUBSID[normKey] ?? null;
          const fieldId = q.questionId ? `question-${q.questionId}` : null;
          return { subsId, fieldId };
        }
      }
    }
  }
  return { subsId: null, fieldId: null };
}

/**
 * Rimuove dal blob locale le norme non più selezionate e mai compilate.
 * Non tocca norme deselezionate che hanno almeno una risposta (dati utente).
 * No-op se non c'è nessuna norma selezionata (evita wipe in race di load).
 *
 * @returns {object|null} nuova checklist se qualcosa è stato rimosso, altrimenti null
 */
export function pruneUnansweredDeselectedChecklist(checklist, selectedStandards) {
  const entries = getSelectedStandardEntries(selectedStandards);
  if (entries.length === 0 || !checklist || typeof checklist !== "object") {
    return null;
  }
  const selectedKeys = new Set(entries.map((e) => e.key));
  let changed = false;
  const next = { ...checklist };
  for (const key of Object.keys(next)) {
    const canonical = CODE_TO_KEY[key] || key;
    if (selectedKeys.has(canonical)) continue;
    if (isNormUnanswered(next[key])) {
      delete next[key];
      changed = true;
    }
  }
  return changed ? next : null;
}

/** Applica prune e riallinea metrics.completionPercentage al blob rimasto. */
export function applyPrunedChecklist(audit, pruned) {
  if (!pruned || !audit) return audit;
  const { total, answered } = countChecklistQuestions(pruned);
  return {
    ...audit,
    checklist: pruned,
    metrics: {
      ...audit.metrics,
      totalQuestions: total,
      answeredQuestions: answered,
      completionPercentage:
        total === 0 ? 0 : Math.round((answered / total) * 100),
    },
  };
}
