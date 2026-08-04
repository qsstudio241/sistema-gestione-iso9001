/**
 * Tipi qualifica salute mansione (saldatori / ispettori VT / NDT).
 * Specchio di backend/src/constants/occupationalQualificationTypes.js
 */

export const VISION_FITNESS_TYPE = "Certificato idoneit\u00e0 visiva (acuit\u00e0 + Ishihara)";

/** Tipi legacy — riconosciuti in lettura; non mostrati nel form "Nuova qualifica". */
export const LEGACY_VISION_FITNESS_TYPES = [
  "Certificato acuit\u00e0 visiva",
  "Certificato visione cromatica (Ishihara)",
];

export const OCCUPATIONAL_QUALIFICATION_TYPES = [
  VISION_FITNESS_TYPE,
  "Idoneit\u00e0 medica alla mansione",
  "Sorveglianza sanitaria periodica",
];

const OCCUPATIONAL_SET = new Set([
  ...OCCUPATIONAL_QUALIFICATION_TYPES,
  ...LEGACY_VISION_FITNESS_TYPES,
]);

const VISION_SET = new Set([VISION_FITNESS_TYPE, ...LEGACY_VISION_FITNESS_TYPES]);

export function isOccupationalQualificationType(type) {
  if (!type) return false;
  return OCCUPATIONAL_SET.has(String(type).trim());
}

export function isVisionFitnessType(type) {
  if (!type) return false;
  return VISION_SET.has(String(type).trim());
}
