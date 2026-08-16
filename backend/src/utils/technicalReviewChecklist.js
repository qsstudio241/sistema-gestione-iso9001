/**
 * Timbro data/utente sul JSON technical_review_checklist (ISO-2).
 * Stesse 17 chiavi del frontend. Nessuna colonna nuova.
 */

const COMPLETION_KEY = '_completion';

const TECHNICAL_REVIEW_KEYS = [
  'materiale_base',
  'requisiti_qualita',
  'posizione_accessibilita',
  'specifica_procedure',
  'criterio_qualificazione_procedure',
  'qualificazione_personale',
  'identificazione_rintracciabilita',
  'controllo_qualita',
  'ispezioni_prove',
  'subfornitura',
  'trattamenti_termici',
  'altri_requisiti',
  'metodi_particolari',
  'dimensioni_giunti',
  'luogo_esecuzione',
  'condizioni_ambientali',
  'gestione_nc',
];

function parseTechnicalReviewChecklist(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { ...parsed } : {};
  } catch {
    return {};
  }
}

function isTechnicalReviewComplete(checklist) {
  return TECHNICAL_REVIEW_KEYS.every((key) => checklist?.[key]?.checked);
}

function applyTechnicalReviewCompletionStamp(checklist, user, now = new Date()) {
  const next = { ...(checklist || {}) };
  const prev = next[COMPLETION_KEY];
  delete next[COMPLETION_KEY];
  if (!isTechnicalReviewComplete(next)) {
    return next;
  }
  if (prev?.at && prev?.by_user_id) {
    return { ...next, [COMPLETION_KEY]: prev };
  }
  return {
    ...next,
    [COMPLETION_KEY]: {
      at: now.toISOString(),
      by_user_id: user?.user_id ?? user?.id ?? null,
      by_name: user?.full_name || user?.email || 'Utente',
    },
  };
}

function stampTechnicalReviewChecklistJson(raw, user) {
  if (raw == null || raw === '') return null;
  const parsed = parseTechnicalReviewChecklist(raw);
  const stamped = applyTechnicalReviewCompletionStamp(parsed, user);
  return JSON.stringify(stamped);
}

module.exports = {
  COMPLETION_KEY,
  TECHNICAL_REVIEW_KEYS,
  parseTechnicalReviewChecklist,
  isTechnicalReviewComplete,
  applyTechnicalReviewCompletionStamp,
  stampTechnicalReviewChecklistJson,
};
