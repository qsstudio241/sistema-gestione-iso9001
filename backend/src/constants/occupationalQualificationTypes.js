/**
 * Tipi qualifica salute mansione (saldatori / ispettori VT / NDT — ISO 3834 + ISO 9712).
 * Fascicolo documentale in qualifications, non in anagrafica.
 *
 * Acuità + Ishihara = UN solo certificato oculistico (pratica reale / ISO 9712).
 * I due tipi storici restano alias per filtri e record legacy.
 */

const VISION_FITNESS_TYPE = 'Certificato idoneit\u00e0 visiva (acuit\u00e0 + Ishihara)';

/** Tipi legacy (pre-unificazione 03/08/2026) — ancora riconosciuti in lettura/filtro. */
const LEGACY_VISION_FITNESS_TYPES = [
  'Certificato acuit\u00e0 visiva',
  'Certificato visione cromatica (Ishihara)',
];

const OCCUPATIONAL_QUALIFICATION_TYPES = [
  VISION_FITNESS_TYPE,
  'Idoneit\u00e0 medica alla mansione',
  'Sorveglianza sanitaria periodica',
];

/** Tutti i tipi che appartengono alla tab Salute mansione (canonici + alias). */
const OCCUPATIONAL_TYPE_SET = new Set([
  ...OCCUPATIONAL_QUALIFICATION_TYPES,
  ...LEGACY_VISION_FITNESS_TYPES,
]);

const VISION_FITNESS_TYPE_SET = new Set([
  VISION_FITNESS_TYPE,
  ...LEGACY_VISION_FITNESS_TYPES,
]);

function isOccupationalQualificationType(type) {
  if (!type) return false;
  return OCCUPATIONAL_TYPE_SET.has(String(type).trim());
}

function isVisionFitnessType(type) {
  if (!type) return false;
  return VISION_FITNESS_TYPE_SET.has(String(type).trim());
}

function occupationalQualificationSqlInList() {
  return [...OCCUPATIONAL_TYPE_SET].map((t) => `N'${t.replace(/'/g, "''")}'`).join(', ');
}

function visionFitnessSqlInList() {
  return [...VISION_FITNESS_TYPE_SET].map((t) => `N'${t.replace(/'/g, "''")}'`).join(', ');
}

module.exports = {
  VISION_FITNESS_TYPE,
  LEGACY_VISION_FITNESS_TYPES,
  OCCUPATIONAL_QUALIFICATION_TYPES,
  OCCUPATIONAL_TYPE_SET,
  VISION_FITNESS_TYPE_SET,
  isOccupationalQualificationType,
  isVisionFitnessType,
  occupationalQualificationSqlInList,
  visionFitnessSqlInList,
};
