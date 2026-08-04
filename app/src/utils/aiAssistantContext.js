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

// ── Contesto modulo qualifiche (sessionStorage) ───────────────────────────────

const QUAL_CONTEXT_KEY = "sgq:ai_qual_context";

/**
 * Salva il contesto attivo della pagina Qualifiche prima di navigare all'AI.
 * @param {{ qualType: string, qualTypeLabel: string, companyName: string|null, companyId: string|number|null }} ctx
 */
export function saveQualContext(ctx) {
  try {
    if (!ctx) { sessionStorage.removeItem(QUAL_CONTEXT_KEY); return; }
    sessionStorage.setItem(QUAL_CONTEXT_KEY, JSON.stringify({
      qualType:      ctx.qualType || null,
      qualTypeLabel: ctx.qualTypeLabel || null,
      companyName:   ctx.companyName || null,
      companyId:     ctx.companyId != null ? String(ctx.companyId) : null,
      savedAt:       Date.now(),
    }));
  } catch { /* sessionStorage non disponibile */ }
}

/**
 * Legge il contesto qualifiche. Scade dopo 10 minuti.
 * @returns {{ qualType, qualTypeLabel, companyName, companyId }|null}
 */
export function loadQualContext() {
  try {
    const raw = sessionStorage.getItem(QUAL_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed.savedAt || 0) > 10 * 60 * 1000) {
      sessionStorage.removeItem(QUAL_CONTEXT_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

// ── Intent generazione WPS (chip AskAi → form precompilato) ───────────────────

const WPS_GENERATE_INTENT_KEY = "sgq:wps_generate_intent";

/** Caso demo Mason (FW S355 10 mm + S235 5 mm). */
export const MASON_WPS_GENERATE_DEFAULTS = {
  joint_type: "FW",
  parent_material_a: "S355",
  parent_material_b: "S235",
  thickness_a_mm: "10",
  thickness_b_mm: "5",
  welding_process: "",
};

/**
 * Salva intent per aprire «Genera WPS» precompilato (consumato da WeldingProceduresPage).
 * @param {Partial<typeof MASON_WPS_GENERATE_DEFAULTS>} [params]
 */
export function saveWpsGenerateIntent(params = {}) {
  try {
    sessionStorage.setItem(WPS_GENERATE_INTENT_KEY, JSON.stringify({
      ...MASON_WPS_GENERATE_DEFAULTS,
      ...params,
      savedAt: Date.now(),
    }));
  } catch { /* sessionStorage non disponibile */ }
}

/**
 * Legge e rimuove l'intent generazione WPS. Scade dopo 10 minuti.
 * @returns {object|null}
 */
export function consumeWpsGenerateIntent() {
  try {
    const raw = sessionStorage.getItem(WPS_GENERATE_INTENT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(WPS_GENERATE_INTENT_KEY);
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed.savedAt || 0) > 10 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

/** Testo chip AskAi per caso Mason (P1-C). */
export const WPS_GENERATE_MASON_CHIP =
  "Genera una WPS FW per S355 10 mm + S235 5 mm usando le WPQR disponibili";

/**
 * Rileva richieste di copertura/generazione WPS da WPQR (P4 — orchestrazione FE).
 * @param {string} text
 * @returns {boolean}
 */
export function isWpsCoverageRequest(text) {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return false;
  if (/genera\s+(una\s+)?wps/.test(t)) return true;
  if (/wps/.test(t) && /(wpqr|estension|copertur)/.test(t)) return true;
  if (/copertura/.test(t) && /(wpqr|giunto|saldat)/.test(t)) return true;
  return false;
}

/**
 * Estrae parametri giunto da testo libero (euristica leggera — il check resta sul backend).
 * @param {string} text
 * @returns {Partial<typeof MASON_WPS_GENERATE_DEFAULTS>}
 */
export function extractWpsRequestFromText(text) {
  const t = String(text || "");
  const out = {};
  const jt = t.match(/\b(FW|BW)\b/i);
  if (jt) out.joint_type = jt[1].toUpperCase();

  const process = t.match(/\b(?:processo\s*)?(111|131|135|136|138|141)\b/);
  if (process) out.welding_process = process[1];

  // Spessori: "10 mm + 5 mm", "10 mm + S235 5 mm", "10mm e 5mm"
  const thickPair = t.match(
    /(\d+(?:[.,]\d+)?)\s*mm\b[\s\S]{0,40}?(\d+(?:[.,]\d+)?)\s*mm\b/i
  );
  if (thickPair) {
    out.thickness_a_mm = String(thickPair[1]).replace(",", ".");
    out.thickness_b_mm = String(thickPair[2]).replace(",", ".");
  } else {
    const thicks = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*mm\b/gi)].map((m) =>
      String(m[1]).replace(",", ".")
    );
    if (thicks[0]) out.thickness_a_mm = thicks[0];
    if (thicks[1]) out.thickness_b_mm = thicks[1];
  }

  // Materiali: gradi comuni (S355, S235) o gruppi 1.2 / 8.1
  const grades = [...t.matchAll(/\b(S\d{3}[A-Z0-9]*|P\d{3}[A-Z0-9]*|1\.\d{1,2}|8\.\d)\b/gi)]
    .map((m) => m[1]);
  if (grades[0] && !out.parent_material_a) out.parent_material_a = grades[0];
  if (grades[1] && !out.parent_material_b) out.parent_material_b = grades[1];

  // "per S355 ... + S235"
  const matPair = t.match(/(?:per|di)\s+(S\d{3}\w*)\s+[^\n]{0,40}?\+\s*(S\d{3}\w*)/i);
  if (matPair) {
    out.parent_material_a = matPair[1].toUpperCase();
    out.parent_material_b = matPair[2].toUpperCase();
  }

  return out;
}

/**
 * Unisce bozza request WPS (stringhe per form/API).
 * @param {object} base
 * @param {object} patch
 */
export function mergeWpsRequest(base = {}, patch = {}) {
  const next = { ...base };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v == null || v === "") continue;
    next[k] = String(v).trim();
  }
  return next;
}

/**
 * Applica la risposta utente alle domande need_input ancora aperte.
 * @param {object} request
 * @param {string} userText
 * @param {Array<{ field: string, question: string }>} questions
 * @returns {object} request aggiornato
 */
export function applyWpsAnswersToRequest(request = {}, userText = "", questions = []) {
  const extracted = extractWpsRequestFromText(userText);
  let next = mergeWpsRequest(request, extracted);
  const t = String(userText || "");

  // Risposte etichettate: "materiale A: S355"
  const labeled = [
    [/materiale\s*a\s*[:=]\s*([^\n,;]+)/i, "parent_material_a"],
    [/materiale\s*b\s*[:=]\s*([^\n,;]+)/i, "parent_material_b"],
    [/giunto\s*[:=]\s*(FW|BW)/i, "joint_type"],
    [/spessore\s*a\s*[:=]\s*(\d+(?:[.,]\d+)?)/i, "thickness_a_mm"],
    [/spessore\s*b\s*[:=]\s*(\d+(?:[.,]\d+)?)/i, "thickness_b_mm"],
    [/processo\s*[:=]\s*(\d{3})/i, "welding_process"],
  ];
  for (const [re, field] of labeled) {
    const m = t.match(re);
    if (m) next = mergeWpsRequest(next, { [field]: m[1].replace(",", ".") });
  }

  // Se resta un solo campo materiale mancante e c'è un solo token plausibile
  const missing = (questions || []).map((q) => q.field);
  if (missing.includes("parent_material_a") && !next.parent_material_a && extracted.parent_material_a) {
    next.parent_material_a = extracted.parent_material_a;
  }
  if (missing.includes("parent_material_b") && !next.parent_material_b && extracted.parent_material_b) {
    next.parent_material_b = extracted.parent_material_b;
  }

  return next;
}

/**
 * Messaggio assistant per need_input.
 * @param {Array<{ field: string, question: string }>} questions
 */
export function formatWpsNeedInputMessage(questions = []) {
  const lines = (questions || []).map((q, i) => `${i + 1}. ${q.question}`);
  return [
    "Per verificare la copertura sulle WPQR mi servono ancora questi dati (non li invento):",
    "",
    ...lines,
    "",
    "Rispondi pure in linguaggio naturale (es. «materiali S355 e S235» oppure «gruppo 1.2 e 1.1»).",
  ].join("\n");
}

/**
 * Messaggio assistant per esito generateWPS.
 * @param {object} result
 */
export function formatWpsGenerateResultMessage(result = {}) {
  const status = result.status;
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const extensions = Array.isArray(result.extensions_needed) ? result.extensions_needed : [];
  const wpqr = result.wpqr_used;
  const draft = result.wps_draft;

  if (status === "ok" || status === "partial") {
    const head = status === "ok"
      ? "Copertura OK: almeno una WPQR copre il giunto richiesto."
      : "Copertura parziale: c'\u00e8 una WPQR candidata, ma verifica i warning.";
    const lines = [
      head,
      wpqr ? `WPQR usata: ${wpqr.wpqr_code || wpqr.id}` : null,
      draft?.welding_process ? `Processo bozza: ${draft.welding_process}` : null,
      draft?.joint_type ? `Giunto: ${draft.joint_type}` : null,
      "",
      "Puoi aprire «Genera WPS» nel modulo Saldatura per rivedere e salvare la bozza.",
    ].filter((x) => x != null);
    if (warnings.length) {
      lines.push("", "Avvisi:", ...warnings.map((w) => `\u2022 ${w}`));
    }
    return lines.join("\n");
  }

  if (status === "not_possible") {
    const lines = [
      "Non risulta realizzabile con le WPQR disponibili nell'ambito.",
      "",
      "Estensioni / motivi:",
      ...(extensions.length ? extensions.map((e) => `\u2022 ${e}`) : ["\u2022 Nessun dettaglio"]),
    ];
    if (warnings.length) {
      lines.push("", "Avvisi:", ...warnings.map((w) => `\u2022 ${w}`));
    }
    return lines.join("\n");
  }

  return "Esito copertura WPS non interpretabile. Riprova o usa il form Genera WPS.";
}

/**
 * Payload numerico per POST /welding/wps/generate.
 * @param {object} request
 * @param {number|null} companyId
 */
export function toGenerateWpsApiPayload(request = {}, companyId = null) {
  const payload = {
    joint_type: request.joint_type || "",
    parent_material_a: request.parent_material_a || "",
    parent_material_b: request.parent_material_b || "",
    thickness_a_mm: request.thickness_a_mm !== "" && request.thickness_a_mm != null
      ? Number(request.thickness_a_mm)
      : null,
    thickness_b_mm: request.thickness_b_mm !== "" && request.thickness_b_mm != null
      ? Number(request.thickness_b_mm)
      : null,
  };
  if (request.welding_process) payload.welding_process = request.welding_process;
  if (companyId != null && companyId !== "") payload.company_id = Number(companyId);
  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────

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
