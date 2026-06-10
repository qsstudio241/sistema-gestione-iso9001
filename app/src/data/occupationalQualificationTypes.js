/**
 * Tipi qualifica salute mansione (saldatori / ispettori VT).
 */

export const OCCUPATIONAL_QUALIFICATION_TYPES = [
  "Certificato acuit\u00e0 visiva",
  "Certificato visione cromatica (Ishihara)",
  "Idoneit\u00e0 medica alla mansione",
  "Sorveglianza sanitaria periodica",
];

const OCCUPATIONAL_SET = new Set(OCCUPATIONAL_QUALIFICATION_TYPES);

export function isOccupationalQualificationType(type) {
  if (!type) return false;
  return OCCUPATIONAL_SET.has(String(type).trim());
}
