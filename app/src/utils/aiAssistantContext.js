/**
 * Helper contesto assistente AI - inferenza norma/azienda/clausola da audit e filtro RBAC utente.
 */
import { getStandardByCode, STANDARDS_LIST, CODE_TO_KEY } from "../data/standardsRegistry";

const CHECKLIST_FOCUS_KEY = "sgq_ai_checklist_focus";

/**
 * @param {number[]|undefined|null} allowedStandardIds - da user.allowed_standard_ids
 * @returns {object[]} entry registry visibili all'utente
 */
export function filterStandardsForUser(allowedStandardIds) {
  if (allowedStandardIds == null) return STANDARDS_LIST;
  if (!Array.isArray(allowedStandardIds) || allowedStandardIds.length === 0) return [];
  return STANDARDS_LIST.filter((entry) => allowedStandardIds.includes(entry.standardId));
}

/**
 * Prima norma selezionata nell'audit corrente (auto-contesto).
 * @param {string[]|undefined} selectedStandards
 * @returns {{ standardId: number, key: string, label: string }|null}
 */
export function resolveAutoStandardFromAudit(selectedStandards) {
  if (!Array.isArray(selectedStandards) || selectedStandards.length === 0) return null;
  const entry = getStandardByCode(selectedStandards[0]);
  if (!entry) return null;
  return {
    standardId: entry.standardId,
    key: entry.key,
    label: entry.shortLabel,
  };
}

/**
 * Azienda dall'audit corrente (auto-contesto).
 * @param {object|null|undefined} currentAudit
 * @param {object[]} companies
 * @returns {{ companyId: number|null, companyName: string|null }}
 */
export function resolveAutoCompanyFromAudit(currentAudit, companies = []) {
  const companyId =
    currentAudit?.metadata?.companyId || currentAudit?.company_id || null;
  if (!companyId) {
    return { companyId: null, companyName: null };
  }
  const found = companies.find(
    (c) => c.id === companyId || c.company_id === companyId
  );
  const companyName =
    found?.name || currentAudit?.metadata?.clientName || null;
  return { companyId, companyName };
}

/**
 * Salva la domanda checklist attiva (sessionStorage, per audit corrente).
 * @param {string|null|undefined} auditUuid
 * @param {{ standardKey?: string, clauseRef?: string, questionId?: string, questionText?: string }|null} focus
 */
export function saveChecklistFocus(auditUuid, focus) {
  if (!auditUuid || typeof sessionStorage === "undefined") return;
  try {
    if (!focus || !focus.clauseRef) {
      sessionStorage.removeItem(`${CHECKLIST_FOCUS_KEY}:${auditUuid}`);
      return;
    }
    sessionStorage.setItem(
      `${CHECKLIST_FOCUS_KEY}:${auditUuid}`,
      JSON.stringify({
        standardKey: focus.standardKey || null,
        clauseRef: focus.clauseRef,
        questionId: focus.questionId || null,
        questionText: focus.questionText || null,
        updatedAt: Date.now(),
      })
    );
  } catch {
    /* sessionStorage non disponibile */
  }
}

/**
 * @param {string|null|undefined} auditUuid
 * @returns {object|null}
 */
export function loadChecklistFocus(auditUuid) {
  if (!auditUuid || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${CHECKLIST_FOCUS_KEY}:${auditUuid}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Focus checklist: sessionStorage se presente, altrimenti prima domanda con rilievo.
 * @param {object|null|undefined} currentAudit
 * @returns {{ standardKey: string, clauseRef: string, questionId: string, questionText: string|null }|null}
 */
export function resolveActiveChecklistFocus(currentAudit) {
  const auditUuid = currentAudit?.metadata?.id || currentAudit?.id;
  const stored = loadChecklistFocus(auditUuid);
  if (stored?.clauseRef) {
    return {
      standardKey: stored.standardKey || null,
      clauseRef: stored.clauseRef,
      questionId: stored.questionId || null,
      questionText: stored.questionText || null,
    };
  }

  const checklist = currentAudit?.checklist;
  if (!checklist || typeof checklist !== "object") return null;

  const priority = ["NON_COMPLIANT", "OBSERVATION", "IMPROVEMENT", "NOT_VERIFIED", "COMPLIANT"];
  let best = null;
  let bestRank = priority.length;

  for (const [stdCode, clauseMap] of Object.entries(checklist)) {
    if (!clauseMap || typeof clauseMap !== "object") continue;
    const standardKey = CODE_TO_KEY[stdCode] || stdCode;
    for (const [clauseId, clause] of Object.entries(clauseMap)) {
      if (!clause || typeof clause !== "object") continue;
      const questions = Array.isArray(clause.questions) ? clause.questions : null;
      if (!questions) continue;
      const clauseRef = clause.clauseRef || clauseId;
      for (const q of questions) {
        if (!q || !q.status || q.status === "NOT_ANSWERED") continue;
        const rank = priority.indexOf(q.status);
        if (rank === -1) continue;
        if (rank < bestRank) {
          bestRank = rank;
          best = {
            standardKey,
            clauseRef,
            questionId: q.id != null ? String(q.id) : null,
            questionText: q.text || q.title || q.questionText || null,
          };
        }
      }
    }
  }
  return best;
}

/**
 * Etichetta separatore chat quando cambia audit/contesto.
 */
export function buildAuditContextSeparatorLabel({
  companyName,
  standardLabel,
  focus,
  auditLabel,
}) {
  const parts = [];
  if (auditLabel) parts.push(`Audit: ${auditLabel}`);
  if (companyName) parts.push(`Azienda: ${companyName}`);
  if (standardLabel) parts.push(`Norma: ${standardLabel}`);
  if (focus?.clauseRef) {
    const q = focus.questionId ? ` dom.${focus.questionId}` : "";
    parts.push(`Clausola: \u00A7${focus.clauseRef}${q}`);
  }
  return parts.length > 0 ? parts.join(" \u2014 ") : "Contesto audit aggiornato";
}

/**
 * Payload opzionale per POST /ai/chat.
 */
export function buildAiChatContextPayload(currentAudit, companies = []) {
  const { companyId, companyName } = resolveAutoCompanyFromAudit(
    currentAudit,
    companies
  );
  const autoStandard = resolveAutoStandardFromAudit(
    currentAudit?.metadata?.selectedStandards
  );
  const focus = resolveActiveChecklistFocus(currentAudit);
  const auditUuid = currentAudit?.metadata?.id || currentAudit?.id || null;

  return {
    companyId,
    companyName,
    standardId: autoStandard?.standardId ?? null,
    standardLabel: autoStandard?.label ?? null,
    auditId: auditUuid,
    auditNumber:
      currentAudit?.metadata?.auditNumber ||
      currentAudit?.metadata?.generalData?.auditNumber ||
      null,
    clauseRef: focus?.clauseRef || null,
    questionId: focus?.questionId || null,
    questionText: focus?.questionText || null,
    standardKey: focus?.standardKey || autoStandard?.key || null,
  };
}
