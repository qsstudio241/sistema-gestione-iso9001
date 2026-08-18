/**
 * moduleLicense.service.js — Sprint 8: licenze moduli per organizzazione
 * Colonna organizations.licensed_modules: JSON array di chiavi, NULL = tutti i moduli attivi.
 */

const { query } = require('../config/database');

/** Chiavi usate da frontend + middleware (allineare a LicensedRoute / AppLayout) */
const KNOWN_MODULE_KEYS = [
    'audit',
    'documents',
    'qualifiche',
    'nc',
    'rischi',
    'riesame_direzione',
    'reclami',
    'notifications',
    'sal',
    'saldatura',
    'cnd',
    'strumenti',
    'ai_import',
    'ai_assist',
    'ai_norms',
    'ai_review',
    'ai_chat',
];

const ALL_MODULES_DEFAULT = [...KNOWN_MODULE_KEYS];

// --- Bridge P0 gap ISO 3834 (§8.2 personale NDT + §14 ispezioni/prove) ------
// Chi acquista SOLO la licenza 'saldatura' deve poter accedere anche a 'cnd':
// le ispezioni/prove non distruttive sono un requisito INTEGRALE del sistema
// qualità saldatura 3834, non un modulo opzionale separato. 'cnd' resta
// comunque vendibile come licenza autonoma standalone (aziende che fanno solo
// CND senza saldatura strutturale). Questa mappa NON altera cosa viene salvato
// in organizations.licensed_modules — agisce solo sull'insieme derivato di
// accesso effettivo, calcolato a runtime da userHasAnyLicensedModule().
const MODULE_ACCESS_IMPLICATIONS = {
    saldatura: ['cnd'],
};

/** Espande un elenco di chiavi modulo con quelle implicite (vedi MODULE_ACCESS_IMPLICATIONS). */
function expandWithImpliedModuleKeys(moduleKeys) {
    const set = new Set(moduleKeys || []);
    for (const [sourceKey, impliedKeys] of Object.entries(MODULE_ACCESS_IMPLICATIONS)) {
        if (set.has(sourceKey)) impliedKeys.forEach((k) => set.add(k));
    }
    return [...set];
}

// --- Capability seam: SAL legal conformity (SAL Fase 5-B) -------------------
// The AI legal-conformity axis is CURRENTLY sold inside the 'ai_norms' license
// (layered above module 'sal'), so this capability maps to the exact module key
// that already gates the gap-ai-suggest endpoint. Behaviour is unchanged: the
// capability is ON whenever 'ai_norms' is licensed (or the user is admin).
//
// To spin the legal axis off into its own paid license in 2 MOVES, with NO
// refactor of service/UI logic:
//   1) add the new key (e.g. 'ai_legal') to KNOWN_MODULE_KEYS (and LABELS_IT);
//   2) repoint SAL_LEGAL_CONFORMITY_MODULE_KEY below to that new key.
// The service and the frontend already read the capability only through this
// seam, so nothing else needs to change.
const SAL_LEGAL_CONFORMITY_MODULE_KEY = 'ai_norms';

// --- Capability seam: Material Compliance (MC-4, ADR-020) -------------------
// Oggi ON solo se l'org ha SIA 'saldatura' SIA 'ai_import' (AND, non OR).
// Admin/superadmin bypass come requireLicensedModule.
// Scorporo futuro: aggiungere una chiave in KNOWN_MODULE_KEYS e ripuntare
// MATERIAL_COMPLIANCE_MODULE_KEYS senza riscrivere le route.
const MATERIAL_COMPLIANCE_MODULE_KEYS = ['saldatura', 'ai_import'];

const LABELS_IT = {
    audit: 'Audit',
    documents: 'Registro documenti',
    qualifiche: 'Qualifiche personale',
    nc: 'Non conformità',
    rischi: 'Rischi, opportunità e obiettivi',
    riesame_direzione: 'Riesame di Direzione (§9.3)',
    reclami: 'Reclami e fornitori',
    notifications: 'Notifiche e alert email',
    sal: 'SAL',
    saldatura: 'Modulo saldatura ISO 3834',
    cnd: 'Controlli Non Distruttivi (VT/MT/PT/UT)',
    strumenti: 'Strumenti e attrezzature (anagrafica + tarature)',
    ai_import: 'Import batch documenti (PDF)',
    ai_assist: 'AI Assist — suggerimenti compilazione',
    ai_norms: 'AI Norme — accesso normativo on-demand',
    ai_review: 'AI Riesame — riesame requisiti assistito',
    ai_chat: 'AI Chat — assistente conversazionale',
};

function parseLicensedModulesColumn(raw) {
    if (raw == null || String(raw).trim() === '') return null;
    try {
        const j = JSON.parse(raw);
        if (Array.isArray(j)) {
            const wanted = new Set(j.map((x) => String(x)));
            const filtered = KNOWN_MODULE_KEYS.filter((k) => wanted.has(k));
            return filtered.length ? filtered : null;
        }
    } catch (_) { /* ignore */ }
    return null;
}

/** Unisce elenchi mantenendo l'ordine canonico KNOWN_MODULE_KEYS e garantendo audit. */
function mergeModuleKeys(existingKeys, keysToAdd) {
    const allowed = new Set(KNOWN_MODULE_KEYS);
    const wanted = new Set(
        [...(existingKeys || []), ...(keysToAdd || [])]
            .map((k) => String(k))
            .filter((k) => allowed.has(k))
    );
    if (!wanted.has('audit')) wanted.add('audit');
    return KNOWN_MODULE_KEYS.filter((k) => wanted.has(k));
}

function buildAvailableCatalog() {
    return KNOWN_MODULE_KEYS.map((key) => ({ key, label: LABELS_IT[key] || key }));
}

/**
 * Elenco moduli abilitati per l'organizzazione (sempre array non vuoto).
 * NULL / JSON non valido → tutti i moduli noti (retrocompatibilità).
 */
async function getLicensedModuleKeysForOrg(organizationId) {
    const r = await query(
        `SELECT licensed_modules FROM organizations WHERE organization_id = @organization_id`,
        { organization_id: organizationId }
    );
    if (!r.recordset.length) return [...ALL_MODULES_DEFAULT];
    const parsed = parseLicensedModulesColumn(r.recordset[0].licensed_modules);
    if (!parsed || !parsed.length) return [...ALL_MODULES_DEFAULT];
    return parsed;
}

/**
 * Salva elenco moduli (solo chiavi note). Garantisce sempre "audit" attivo.
 */
async function setLicensedModulesForOrg(organizationId, modules) {
    const allowed = new Set(KNOWN_MODULE_KEYS);
    let arr = [...new Set((modules || []).map((m) => String(m)).filter((m) => allowed.has(m)))];
    if (!arr.includes('audit')) arr = ['audit', ...arr];
    const json = JSON.stringify(arr);
    await query(
        `UPDATE organizations SET licensed_modules = @json WHERE organization_id = @organization_id`,
        { organization_id: organizationId, json }
    );
    return arr;
}

/**
 * Capability seam SAL_LEGAL_CONFORMITY: indica se l'organizzazione puo' usare
 * l'asse "conformita' legislativa" del suggeritore AI del SAL.
 * Oggi mappa su SAL_LEGAL_CONFORMITY_MODULE_KEY ('ai_norms'); admin/superadmin
 * hanno sempre la capability (coerente con requireLicensedModule).
 * @param {number} organizationId
 * @param {string} [role]
 * @returns {Promise<boolean>}
 */
async function hasSalLegalConformityCapability(organizationId, role) {
    const r = role ? String(role).trim().toLowerCase() : '';
    if (r === 'superadmin' || r === 'admin') return true;
    const keys = await getLicensedModuleKeysForOrg(organizationId);
    return keys.includes(SAL_LEGAL_CONFORMITY_MODULE_KEY);
}

/**
 * Capability seam MATERIAL_COMPLIANCE: certificati EN 10204 (MC-4).
 * ON se saldatura AND ai_import (o admin/superadmin).
 * @param {number} organizationId
 * @param {string} [role]
 * @returns {Promise<boolean>}
 */
async function hasMaterialComplianceCapability(organizationId, role) {
    const r = role ? String(role).trim().toLowerCase() : '';
    if (r === 'superadmin' || r === 'admin') return true;
    const keys = await getLicensedModuleKeysForOrg(organizationId);
    return MATERIAL_COMPLIANCE_MODULE_KEYS.every((k) => keys.includes(k));
}

/** Ripristina comportamento default (tutti i moduli) */
async function clearLicensedModulesOverride(organizationId) {
    await query(
        `UPDATE organizations SET licensed_modules = NULL WHERE organization_id = @organization_id`,
        { organization_id: organizationId }
    );
}

/**
 * Payload licenze per API admin (org corrente o tenant specifico).
 */
async function getOrgLicensesPayload(organizationId) {
    const r = await query(
        `SELECT organization_id, organization_name, licensed_modules
         FROM organizations WHERE organization_id = @organization_id`,
        { organization_id: organizationId }
    );
    if (!r.recordset.length) return null;
    const row = r.recordset[0];
    const raw = row.licensed_modules ?? null;
    const modules = await getLicensedModuleKeysForOrg(organizationId);
    return {
        organization_id: row.organization_id,
        organization_name: row.organization_name,
        modules,
        raw_override: raw,
        available: buildAvailableCatalog(),
    };
}

/**
 * Aggiunge moduli a una lista esplicita (idempotente).
 * licensed_modules NULL = tutti i moduli → nessuna modifica.
 */
async function appendLicensedModulesForOrg(organizationId, moduleKeys) {
    const r = await query(
        `SELECT licensed_modules FROM organizations WHERE organization_id = @organization_id`,
        { organization_id: organizationId }
    );
    if (!r.recordset.length) {
        throw new Error(`Organizzazione ${organizationId} non trovata`);
    }
    const raw = r.recordset[0].licensed_modules;
    if (raw == null || String(raw).trim() === '') {
        return getLicensedModuleKeysForOrg(organizationId);
    }
    const current = parseLicensedModulesColumn(raw) || [];
    const merged = mergeModuleKeys(current, moduleKeys);
    const unchanged = merged.length === current.length && merged.every((k, i) => k === current[i]);
    if (unchanged) return merged;
    return setLicensedModulesForOrg(organizationId, merged);
}

module.exports = {
    KNOWN_MODULE_KEYS,
    ALL_MODULES_DEFAULT,
    LABELS_IT,
    MODULE_ACCESS_IMPLICATIONS,
    expandWithImpliedModuleKeys,
    SAL_LEGAL_CONFORMITY_MODULE_KEY,
    MATERIAL_COMPLIANCE_MODULE_KEYS,
    parseLicensedModulesColumn,
    mergeModuleKeys,
    buildAvailableCatalog,
    getLicensedModuleKeysForOrg,
    getOrgLicensesPayload,
    setLicensedModulesForOrg,
    clearLicensedModulesOverride,
    appendLicensedModulesForOrg,
    hasSalLegalConformityCapability,
    hasMaterialComplianceCapability,
};
