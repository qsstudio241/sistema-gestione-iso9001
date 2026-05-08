/**
 * Verifica che l'organizzazione abbia la licenza per il modulo richiesto.
 * Usare dopo authenticate.
 */

const logger = require('../utils/logger');
const { getLicensedModuleKeysForOrg } = require('../services/moduleLicense.service');

function requireLicensedModule(moduleKey) {
    return async (req, res, next) => {
        try {
            // Allineato a authorize(): superadmin e admin di organizzazione non sono bloccati
            // da licensed_modules — configurazione licenze, smoke test e collaudo interno.
            // Gli auditor (e gli altri ruoli) restano vincolati ai moduli acquistati per l'org.
            const role = req.user?.role ? String(req.user.role).trim().toLowerCase() : '';
            if (role === 'superadmin' || role === 'admin') {
                return next();
            }

            const keys = await getLicensedModuleKeysForOrg(req.user.organization_id);
            if (!keys.includes(moduleKey)) {
                logger.warn('Module license denied', { moduleKey, org: req.user.organization_id, path: req.path });
                return res.status(403).json({
                    error: 'Modulo non abilitato per la tua organizzazione',
                    code: 'MODULE_NOT_LICENSED',
                    module: moduleKey,
                });
            }
            next();
        } catch (err) {
            logger.error('requireLicensedModule', err);
            next(err);
        }
    };
}

module.exports = { requireLicensedModule };
