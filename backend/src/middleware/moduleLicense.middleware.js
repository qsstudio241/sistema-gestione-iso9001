/**
 * Verifica che l'organizzazione abbia la licenza per il modulo richiesto.
 * Usare dopo authenticate.
 */

const logger = require('../utils/logger');
const { getLicensedModuleKeysForOrg } = require('../services/moduleLicense.service');

async function userHasAnyLicensedModule(req, moduleKeys) {
    const role = req.user?.role ? String(req.user.role).trim().toLowerCase() : '';
    if (role === 'superadmin' || role === 'admin') return true;
    const keys = await getLicensedModuleKeysForOrg(req.user.organization_id);
    return moduleKeys.some((k) => keys.includes(k));
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

module.exports = { requireLicensedModule, requireLicensedModuleAny };
