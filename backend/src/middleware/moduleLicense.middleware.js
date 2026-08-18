/**
 * Verifica che l'organizzazione abbia la licenza per il modulo richiesto.
 * Usare dopo authenticate.
 */

const logger = require('../utils/logger');
const {
    getLicensedModuleKeysForOrg,
    expandWithImpliedModuleKeys,
    hasMaterialComplianceCapability,
} = require('../services/moduleLicense.service');

async function userHasAnyLicensedModule(req, moduleKeys) {
    const role = req.user?.role ? String(req.user.role).trim().toLowerCase() : '';
    if (role === 'superadmin' || role === 'admin') return true;
    const keys = await getLicensedModuleKeysForOrg(req.user.organization_id);
    // Bridge ISO 3834 P0: 'saldatura' implica accesso a 'cnd' (vedi moduleLicense.service).
    const effectiveKeys = expandWithImpliedModuleKeys(keys);
    return moduleKeys.some((k) => effectiveKeys.includes(k));
}

function requireLicensedModule(moduleKey) {
    return async (req, res, next) => {
        try {
            if (await userHasAnyLicensedModule(req, [moduleKey])) return next();

            logger.warn('Module license denied', { moduleKey, org: req.user.organization_id, path: req.path });
            return res.status(403).json({
                error: 'Modulo non abilitato per la tua organizzazione',
                code: 'MODULE_NOT_LICENSED',
                module: moduleKey,
            });
        } catch (err) {
            logger.error('requireLicensedModule', err);
            next(err);
        }
    };
}

/** Almeno una delle chiavi modulo deve essere licenziata (ADR-016 bundle CND/strumenti/saldatura). */
function requireLicensedModuleAny(moduleKeys) {
    return async (req, res, next) => {
        try {
            if (await userHasAnyLicensedModule(req, moduleKeys)) return next();

            logger.warn('Module license denied (any)', { moduleKeys, org: req.user.organization_id, path: req.path });
            return res.status(403).json({
                error: 'Modulo non abilitato per la tua organizzazione',
                code: 'MODULE_NOT_LICENSED',
                module: moduleKeys.join('|'),
            });
        } catch (err) {
            logger.error('requireLicensedModuleAny', err);
            next(err);
        }
    };
}

/**
 * AND di saldatura + ai_import (MC-4). Non usare requireLicensedModuleAny (è OR).
 */
function requireMaterialComplianceCapability() {
    return async (req, res, next) => {
        try {
            const ok = await hasMaterialComplianceCapability(
                req.user?.organization_id,
                req.user?.role
            );
            if (ok) return next();

            logger.warn('Module license denied (MATERIAL_COMPLIANCE)', {
                org: req.user?.organization_id,
                path: req.path,
            });
            return res.status(403).json({
                error: 'Modulo Material Compliance non abilitato per la tua organizzazione',
                code: 'MODULE_NOT_LICENSED',
                module: 'MATERIAL_COMPLIANCE',
            });
        } catch (err) {
            logger.error('requireMaterialComplianceCapability', err);
            next(err);
        }
    };
}

module.exports = {
    requireLicensedModule,
    requireLicensedModuleAny,
    requireMaterialComplianceCapability,
};
