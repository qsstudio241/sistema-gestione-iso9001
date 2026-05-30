/**
 * Helper contesto assistente AI — inferenza norma da audit e filtro RBAC utente.
 */
import { getStandardByCode, STANDARDS_LIST } from "../data/standardsRegistry";

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
