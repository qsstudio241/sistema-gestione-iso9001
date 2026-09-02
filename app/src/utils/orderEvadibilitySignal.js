/**
 * ING-3 — segnale evadibilità ordine da docs organizzati.
 * Riusa gate catalogo (ING-2), snapshot report capacità (VC-1) e checklist §8.2.
 * Non inventa norme; non è un agente (non ING-5).
 */

import { getCatalogAnalyzeGate } from './caseDocCatalog';

/** @typedef {'evadibile'|'gap'|'need_input'} EvadibilityStatus */

const STATUS_RANK = Object.freeze({
  need_input: 0,
  gap: 1,
  evadibile: 2,
});

const CAPABILITY_TO_EVADIBILITY = Object.freeze({
  ok: 'evadibile',
  gap: 'gap',
  need_input: 'need_input',
});

const LABELS = Object.freeze({
  evadibile: 'Ordine evadibile (segnale sintetico)',
  gap: 'Gap rispetto a capacità / checklist',
  need_input: 'Servono dati o documenti',
});

/**
 * @param {unknown} raw
 * @param {unknown} [fallbackAt]
 * @returns {object|null}
 */
export function parseCapabilityGapReport(raw, fallbackAt = null) {
  if (raw == null || raw === '') return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.generated_at && fallbackAt) {
      parsed.generated_at = new Date(fallbackAt).toISOString();
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Sintesi checklist: unanswered / no / partial.
 * @param {object[]} checklist
 */
function summarizeChecklist(checklist) {
  const list = Array.isArray(checklist) ? checklist : [];
  let unanswered = 0;
  let noCount = 0;
  let partialCount = 0;
  let answered = 0;

  for (const item of list) {
    if (!item) continue;
    const ans = item.answer == null || item.answer === '' || item.answer === 'not_evaluated'
      ? null
      : String(item.answer).trim().toLowerCase();
    if (!ans) {
      unanswered += 1;
      continue;
    }
    answered += 1;
    if (ans === 'no') noCount += 1;
    else if (ans === 'partial') partialCount += 1;
  }

  /** @type {EvadibilityStatus|null} */
  let status = null;
  if (list.length === 0) {
    status = null;
  } else if (noCount > 0 || partialCount > 0) {
    status = 'gap';
  } else if (unanswered > 0 && answered === 0) {
    // Checklist generata ma mai compilata → non blocca da sola (soft)
    status = null;
  } else if (unanswered > 0) {
    status = 'need_input';
  } else {
    status = 'evadibile';
  }

  return {
    total: list.length,
    unanswered,
    noCount,
    partialCount,
    answered,
    status,
  };
}

/**
 * Peggiora lo stato (need_input > gap > evadibile).
 * @param {EvadibilityStatus|null} a
 * @param {EvadibilityStatus|null} b
 * @returns {EvadibilityStatus|null}
 */
function worseStatus(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  return STATUS_RANK[a] <= STATUS_RANK[b] ? a : b;
}

/**
 * Deriva il segnale prodotto «ordine evadibile / gap / need_input».
 *
 * @param {object} input
 * @param {object[]} [input.attachments]
 * @param {object|null} [input.gapReport] — snapshot VC-1 (già parsato)
 * @param {object[]} [input.checklist]
 * @returns {{
 *   status: EvadibilityStatus,
 *   label: string,
 *   reasons: string[],
 *   sources: {
 *     catalog: ReturnType<typeof getCatalogAnalyzeGate>,
 *     capabilityStatus: 'ok'|'gap'|'need_input'|null,
 *     checklist: ReturnType<typeof summarizeChecklist>,
 *   },
 * }}
 */
export function deriveOrderEvadibilitySignal({
  attachments = [],
  gapReport = null,
  checklist = [],
} = {}) {
  const reasons = [];
  const catalog = getCatalogAnalyzeGate(attachments);
  const checklistSummary = summarizeChecklist(checklist);

  /** @type {EvadibilityStatus|null} */
  let status = null;

  // 1) Catalogo — senza allegati analizzabili non si valuta evadibilità
  if ((Array.isArray(attachments) ? attachments : []).length === 0) {
    status = 'need_input';
    reasons.push('Nessun allegato sul caso — carica e cataloga i documenti cliente');
  } else if (!catalog.canAnalyze) {
    status = 'need_input';
    reasons.push(
      catalog.blockedReason
        || 'Cataloga almeno un allegato analizzabile (Disegno / Capitolato PDF / Ordine PDF)',
    );
  } else {
    status = 'evadibile';
    if (catalog.softWarnUncataloged) {
      reasons.push(
        `${catalog.uncatalogedCount} allegat${catalog.uncatalogedCount === 1 ? 'o' : 'i'} ancora da catalogare`,
      );
    }
  }

  // 2) Report capacità VC-1
  const rawCap = gapReport?.summary?.status;
  const capabilityStatus =
    rawCap === 'ok' || rawCap === 'gap' || rawCap === 'need_input' ? rawCap : null;

  if (status !== 'need_input' || catalog.canAnalyze) {
    if (!gapReport || !capabilityStatus) {
      status = worseStatus(status, 'need_input');
      reasons.push('Report capacità non ancora generato — genera lo snapshot studio');
    } else {
      const mapped = CAPABILITY_TO_EVADIBILITY[capabilityStatus];
      status = worseStatus(status, mapped);
      if (capabilityStatus === 'ok') {
        reasons.push('Report capacità: OK');
      } else if (capabilityStatus === 'gap') {
        const n = gapReport?.summary?.gaps_count;
        reasons.push(
          typeof n === 'number'
            ? `Report capacità: ${n} gap segnalat${n === 1 ? 'o' : 'i'}`
            : 'Report capacità: gap rispetto alla capacità',
        );
      } else {
        reasons.push('Report capacità: dati incompleti (need_input)');
      }
    }
  }

  // 3) Checklist — solo se esiste; non inventa voci
  if (checklistSummary.total > 0 && checklistSummary.status) {
    status = worseStatus(status, checklistSummary.status);
    if (checklistSummary.noCount > 0) {
      reasons.push(
        `Checklist: ${checklistSummary.noCount} voce/i con risposta No`,
      );
    }
    if (checklistSummary.partialCount > 0) {
      reasons.push(
        `Checklist: ${checklistSummary.partialCount} voce/i Parziale`,
      );
    }
    if (checklistSummary.status === 'need_input' && checklistSummary.unanswered > 0) {
      reasons.push(
        `Checklist: ${checklistSummary.unanswered} voce/i ancora senza risposta`,
      );
    }
  }

  if (status == null) status = 'need_input';

  // Dedup reasons preserving order
  const seen = new Set();
  const uniqueReasons = [];
  for (const r of reasons) {
    if (!r || seen.has(r)) continue;
    seen.add(r);
    uniqueReasons.push(r);
  }

  return {
    status,
    label: LABELS[status] || LABELS.need_input,
    reasons: uniqueReasons,
    sources: {
      catalog,
      capabilityStatus,
      checklist: checklistSummary,
    },
  };
}

export function evadibilityStatusClass(status) {
  if (status === 'evadibile') return 'cr-studio-status-ok';
  if (status === 'gap') return 'cr-studio-status-gap';
  if (status === 'need_input') return 'cr-studio-status-need';
  return 'cr-studio-status-empty';
}

export const EVADIBILITY_LABELS = LABELS;
