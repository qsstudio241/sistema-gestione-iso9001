/**
 * Tipi qualifica salute mansione (saldatori / ispettori VT - ISO 3834).
 * Fascicolo documentale in qualifications, non in anagrafica.
 */

const OCCUPATIONAL_QUALIFICATION_TYPES = [
  'Certificato acuit\u00e0 visiva',
  'Certificato visione cromatica (Ishihara)',
  'Idoneit\u00e0 medica alla mansione',
  'Sorveglianza sanitaria periodica',
];

const OCCUPATIONAL_TYPE_SET = new Set(OCCUPATIONAL_QUALIFICATION_TYPES);

function isOccupationalQualificationType(type) {
  if (!type) return false;
  return OCCUPATIONAL_TYPE_SET.has(String(type).trim());
}

function occupationalQualificationSqlInList() {
  return OCCUPATIONAL_QUALIFICATION_TYPES.map((t) => `N'${t.replace(/'/g, "''")}'`).join(', ');
}

module.exports = {
  OCCUPATIONAL_QUALIFICATION_TYPES,
  OCCUPATIONAL_TYPE_SET,
  isOccupationalQualificationType,
  occupationalQualificationSqlInList,
};
