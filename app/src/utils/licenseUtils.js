/**
 * licenseUtils.js — helper licenze moduli condiviso tra componenti.
 *
 * Regola: licensed_modules null/vuoto = tutti i moduli attivi (retrocompatibilità).
 * La stessa logica era definita localmente in AppLayout.jsx — estratta qui
 * per essere importabile da qualunque componente senza dipendere dal layout.
 */

/**
 * Bridge P0 gap ISO 3834 (§8.2 personale NDT + §14 ispezioni/prove): chi ha
 * la licenza 'saldatura' accede anche a 'cnd' — le prove non distruttive sono
 * un requisito INTEGRALE del sistema qualità saldatura, non un modulo
 * opzionale separato. 'cnd' resta comunque vendibile come licenza autonoma
 * standalone. Questa mappa NON altera `user.licensed_modules` (i moduli
 * effettivamente acquistati) — agisce solo sull'insieme derivato di accesso
 * usato dalle route guard e dal menu. Speculare a backend
 * `moduleLicense.service.js` → MODULE_ACCESS_IMPLICATIONS.
 */
const MODULE_ACCESS_IMPLICATIONS = {
  saldatura: ["cnd"],
};

/**
 * @param {object|null} user - utente da useAuth()
 * @param {string}      key  - chiave modulo (es. 'ai_chat', 'nc', 'documents')
 * @returns {boolean}
 */
export function hasLicensedModule(user, key) {
  const m = user?.licensed_modules;
  if (!m || !Array.isArray(m) || m.length === 0) return true;
  if (m.includes(key)) return true;
  return Object.entries(MODULE_ACCESS_IMPLICATIONS).some(
    ([sourceKey, impliedKeys]) => impliedKeys.includes(key) && m.includes(sourceKey)
  );
}

/**
 * Tab/API profilo conformità (ADR-018): stesso seam SAL_LEGAL_CONFORMITY
 * (oggi `ai_norms`). Admin/superadmin sempre ON, come il backend.
 */
export function hasCompanyProfileCapability(user) {
  const role = String(user?.role || "").trim().toLowerCase();
  if (role === "admin" || role === "superadmin") return true;
  return hasLicensedModule(user, "ai_norms");
}

/**
 * Capability MATERIAL_COMPLIANCE (MC-4/MC-5): AND saldatura + ai_import.
 * Admin/superadmin sempre ON, come il backend.
 */
export function hasMaterialComplianceCapability(user) {
  const role = String(user?.role || "").trim().toLowerCase();
  if (role === "admin" || role === "superadmin") return true;
  return hasLicensedModule(user, "saldatura") && hasLicensedModule(user, "ai_import");
}
