/**
 * welderQualificationExpiryWarnings.js
 *
 * Regole condivise per interpretare il campo `semaforo` delle qualifiche
 * saldatore (ISO 9606) calcolato lato backend (qualifications.controller.js:
 * DAYS_WARNING=60, DAYS_URGENT=30). Il frontend NON ricalcola le date di
 * scadenza: legge solo `semaforo` per restare coerente su tutte le pagine
 * (QualificationsPage, WeldingDashboardPage, ProjectsPage, ...).
 *
 * Nota: non confondere con `app/src/data/weldingQualificationRules9606.js`
 * (regole di calcolo range qualificato spessore/diametro Tabelle 7/8) — file
 * distinto per scopo distinto, nome volutamente diverso per evitare ambiguita'.
 */

import { formatDate } from "./dateHelpers";

/** Soglia (giorni) usata come limite "urgente" — coerente con il backend. */
export const WELDER_EXPIRY_URGENT_DAYS = 30;

export function isExpiredSemaforo(semaforo) {
  return semaforo === "rosso";
}

export function isExpiringSemaforo(semaforo) {
  return semaforo === "giallo" || semaforo === "arancione";
}

export function isExpiredOrExpiringSemaforo(semaforo) {
  return isExpiredSemaforo(semaforo) || isExpiringSemaforo(semaforo);
}

/**
 * Costruisce un messaggio di warning leggibile per una qualifica saldatore,
 * o null se la qualifica e' valida. Riusabile ovunque si assegni un saldatore
 * a una WPS/commessa (es. ProjectsPage, WeldingProceduresPage).
 *
 * @param {{semaforo?: string, expiry_date?: string, person_name?: string}} qualification
 * @returns {{level: "danger"|"warning", text: string}|null}
 */
export function getWelderQualificationWarning(qualification) {
  if (!qualification) return null;
  const { semaforo, expiry_date, person_name } = qualification;
  const who = person_name ? `di ${person_name}` : "del saldatore selezionato";

  if (isExpiredSemaforo(semaforo)) {
    return {
      level: "danger",
      text: `Qualifica ${who} scaduta${expiry_date ? ` il ${formatDate(expiry_date)}` : ""}.`,
    };
  }
  if (isExpiringSemaforo(semaforo)) {
    return {
      level: "warning",
      text: `Qualifica ${who} in scadenza${expiry_date ? ` il ${formatDate(expiry_date)}` : ""} (entro ${WELDER_EXPIRY_URGENT_DAYS} giorni).`,
    };
  }
  return null;
}
