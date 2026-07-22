/**
 * licenseUtils.js — helper licenze moduli condiviso tra componenti.
 *
 * Regola: licensed_modules null/vuoto = tutti i moduli attivi (retrocompatibilità).
 * La stessa logica era definita localmente in AppLayout.jsx — estratta qui
 * per essere importabile da qualunque componente senza dipendere dal layout.
 */

/**
 * @param {object|null} user - utente da useAuth()
 * @param {string}      key  - chiave modulo (es. 'ai_chat', 'nc', 'documents')
 * @returns {boolean}
 */
export function hasLicensedModule(user, key) {
  const m = user?.licensed_modules;
  if (!m || !Array.isArray(m) || m.length === 0) return true;
  return m.includes(key);
}
