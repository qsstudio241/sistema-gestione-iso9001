import {
  TECHNICAL_REVIEW_COMPLETION_KEY,
  TECHNICAL_REVIEW_ITEMS,
} from "../data/technicalReviewItems";

export function parseTechnicalReviewChecklist(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return { ...raw };
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? { ...parsed } : {};
  } catch {
    return {};
  }
}

export function isTechnicalReviewComplete(checklist) {
  return TECHNICAL_REVIEW_ITEMS.every((item) => checklist?.[item.key]?.checked);
}

export function getTechnicalReviewCompletion(checklist) {
  const stamp = checklist?.[TECHNICAL_REVIEW_COMPLETION_KEY];
  if (!stamp || !stamp.at) return null;
  return stamp;
}

export function formatTechnicalReviewCompletion(stamp) {
  if (!stamp?.at) return "";
  const d = new Date(stamp.at);
  const dateLabel = Number.isNaN(d.getTime())
    ? String(stamp.at)
    : d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  const who = stamp.by_name || "utente";
  return `Completata il ${dateLabel} da ${who}`;
}

/**
 * Primo completamento: scrive data/utente.
 * Se incompleta: toglie il timbro.
 * Se già completa con timbro: lo conserva.
 */
export function applyTechnicalReviewCompletionStamp(checklist, user, now = new Date()) {
  const next = { ...(checklist || {}) };
  const prev = next[TECHNICAL_REVIEW_COMPLETION_KEY];
  delete next[TECHNICAL_REVIEW_COMPLETION_KEY];
  if (!isTechnicalReviewComplete(next)) {
    return next;
  }
  if (prev?.at && prev?.by_user_id) {
    return { ...next, [TECHNICAL_REVIEW_COMPLETION_KEY]: prev };
  }
  return {
    ...next,
    [TECHNICAL_REVIEW_COMPLETION_KEY]: {
      at: now.toISOString(),
      by_user_id: user?.user_id ?? user?.id ?? null,
      by_name: user?.full_name || user?.email || "Utente",
    },
  };
}
