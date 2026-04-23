/**
 * Admin Controller - Gestione utenti e assegnazione standard (solo admin)
 */

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const {
    KNOWN_MODULE_KEYS,
    LABELS_IT,
    getLicensedModuleKeysForOrg,
    setLicensedModulesForOrg,
    clearLicensedModulesOverride,
} = require('../services/moduleLicense.service');

const ADMIN_ROLES = ['admin', 'superadmin'];

async function countActiveAdminsInOrg(organizationId) {
    const r = await query(
        `SELECT COUNT(*) AS c FROM users
         WHERE organization_id = @organization_id AND role IN ('admin', 'superadmin') AND is_active = 1`,
        { organization_id: organizationId }
    );
    return r.recordset[0]?.c ?? 0;
}

async function userIsAdminRole(userId, organizationId) {
    const r = await query(
        `SELECT role FROM users WHERE user_id = @user_id AND organization_id = @organization_id`,
        { user_id: userId, organization_id: organizationId }
    );
    const role = r.recordset[0]?.role;
    return ADMIN_ROLES.includes(role);
}

/** Admin senza studio (auditor_org_id null) può creare/promuovere altri admin org. */
function isElevatedAdmin(reqUser) {
    return (reqUser.role === 'admin' || reqUser.role === 'superadmin') && (reqUser.auditor_org_id == null);
}

/**
 * GET /api/v1/admin/users
 * Lista utenti dell'organizzazione (solo admin)
 */
async function listUsers(req, res) {
    try {
        const { organization_id, role } = req.user;
        const isSuperadmin = role === 'superadmin';

        // superadmin: vede tutti gli utenti di tutte le organizzazioni (visione piattaforma)
        // admin: vede solo gli utenti della propria organizzazione (isolamento multi-tenant)
        const result = isSuperadmin
            ? await query(`
                SELECT 
                    u.user_id, u.email, u.full_name, u.role, u.auditor_org_id, u.is_active,
                    u.created_at, u.last_login, u.organization_id,
                    o.organization_name,
                    ao.name AS auditor_org_name
                FROM users u
                INNER JOIN organizations o ON u.organization_id = o.organization_id
                LEFT JOIN auditor_orgs ao ON u.auditor_org_id = ao.id
                ORDER BY o.organization_name, u.full_name, u.email
            `, {})
            : await query(`
                SELECT 
                    u.user_id, u.email, u.full_name, u.role, u.auditor_org_id, u.is_active,
                    u.created_at, u.last_login, u.organization_id,
                    o.organization_name,
                    ao.name AS auditor_org_name
                FROM users u
                INNER JOIN organizations o ON u.organization_id = o.organization_id
                LEFT JOIN auditor_orgs ao ON u.auditor_org_id = ao.id
                WHERE u.organization_id = @organization_id
                ORDER BY u.full_name, u.email
            `, { organization_id });

        const users = result.recordset || [];

        // Per ogni utente carica gli standard consentiti (user_standards)
        for (const u of users) {
            try {
                const std = await query(`
                    SELECT standard_id FROM user_standards WHERE user_id = @user_id ORDER BY standard_id
                `, { user_id: u.user_id });
                u.allowed_standard_ids = (std.recordset || []).map(r => r.standard_id);
            } catch (_) {
                u.allowed_standard_ids = []; // tabella inesistente o errore
            }
        }

        logger.info('Admin list users', { organization_id, role, count: users.length, crossOrg: isSuperadmin });

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        logger.error('Admin listUsers error', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Errore recupero elenco utenti',
            code: 'ADMIN_LIST_USERS_ERROR'
        });
    }
}

/**
 * POST /api/v1/admin/users
 * Crea utente nella stessa organizzazione dell'admin.
 * Body: { email, password, full_name, role, auditor_org_id? }
 */
async function createUser(req, res) {
    try {
        const { organization_id, user_id: actorId } = req.user;
        const { email, password, full_name, role = 'auditor', auditor_org_id } = req.body || {};

        if (!email || !password || !full_name) {
            return res.status(400).json({
                success: false,
                error: 'Campi obbligatori: email, password, full_name',
                code: 'VALIDATION_ERROR',
            });
        }
        if (String(password).length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password: minimo 8 caratteri',
                code: 'VALIDATION_ERROR',
            });
        }

        const normalizedRole = String(role).toLowerCase().trim();
        const allowed = ['auditor', 'viewer', 'admin'];
        if (!allowed.includes(normalizedRole)) {
            return res.status(400).json({
                success: false,
                error: 'Ruolo non valido (auditor, viewer, admin)',
                code: 'VALIDATION_ERROR',
            });
        }
        if (normalizedRole === 'admin' && !isElevatedAdmin(req.user)) {
            return res.status(403).json({
                success: false,
                error: 'Solo l\'amministratore principale (senza studio associato) può creare utenti con ruolo admin',
                code: 'AUTH_FORBIDDEN',
            });
        }

        let aoId = auditor_org_id != null && auditor_org_id !== '' ? parseInt(auditor_org_id, 10) : null;
        if (Number.isNaN(aoId)) aoId = null;
        if (aoId != null) {
            const ao = await query(
                `SELECT id FROM auditor_orgs WHERE id = @id AND organization_id = @organization_id AND is_active = 1`,
                { id: aoId, organization_id }
            );
            if (ao.recordset.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'auditor_org_id non valido per questa organizzazione',
                    code: 'INVALID_AUDITOR_ORG',
                });
            }
        }

        const existing = await query(
            `SELECT user_id FROM users WHERE email = @email AND organization_id = @organization_id`,
            { email: String(email).trim(), organization_id }
        );
        if (existing.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Email già registrata in questa organizzazione',
                code: 'EMAIL_DUPLICATE',
            });
        }

        const password_hash = await bcrypt.hash(String(password), 10);
        const result = await query(
            `INSERT INTO users (email, password_hash, full_name, role, organization_id, auditor_org_id, is_active)
             VALUES (@email, @password_hash, @full_name, @role, @organization_id, @auditor_org_id, 1);
             SELECT SCOPE_IDENTITY() AS user_id;`,
            {
                email: String(email).trim(),
                password_hash,
                full_name: String(full_name).trim(),
                role: normalizedRole,
                organization_id,
                auditor_org_id: aoId,
            }
        );

        const newId = result.recordset[0]?.user_id;
        logger.info('Admin create user', { new_user_id: newId, organization_id, actorId, role: normalizedRole });

        res.status(201).json({
            success: true,
            data: {
                user_id: newId,
                email: String(email).trim(),
                full_name: String(full_name).trim(),
                role: normalizedRole,
                auditor_org_id: aoId,
                is_active: true,
            },
        });
    } catch (error) {
        logger.error('Admin createUser error', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Errore creazione utente',
            code: 'ADMIN_CREATE_USER_ERROR',
        });
    }
}

/**
 * PATCH /api/v1/admin/users/:id
 * Aggiorna profilo, ruolo, attivo, password (opzionale), auditor_org_id
 */
async function updateUser(req, res) {
    try {
        const { organization_id, user_id: actorId } = req.user;
        const targetUserId = parseInt(req.params.id, 10);
        const { full_name, role, is_active, auditor_org_id, password } = req.body || {};

        if (isNaN(targetUserId)) {
            return res.status(400).json({
                success: false,
                error: 'ID utente non valido',
                code: 'VALIDATION_ERROR',
            });
        }

        const userCheck = await query(
            `SELECT user_id, role, is_active FROM users
             WHERE user_id = @user_id AND organization_id = @organization_id`,
            { user_id: targetUserId, organization_id }
        );
        if (userCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utente non trovato',
                code: 'USER_NOT_FOUND',
            });
        }

        const current = userCheck.recordset[0];
        const updates = [];
        const params = { user_id: targetUserId, organization_id };

        if (full_name !== undefined) {
            if (!String(full_name).trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'full_name non può essere vuoto',
                    code: 'VALIDATION_ERROR',
                });
            }
            updates.push('full_name = @full_name');
            params.full_name = String(full_name).trim();
        }

        if (role !== undefined) {
            const normalizedRole = String(role).toLowerCase().trim();
            const allowed = ['auditor', 'viewer', 'admin'];
            if (!allowed.includes(normalizedRole)) {
                return res.status(400).json({
                    success: false,
                    error: 'Ruolo non valido',
                    code: 'VALIDATION_ERROR',
                });
            }
            if (normalizedRole === 'admin' && !isElevatedAdmin(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: 'Solo l\'amministratore principale può assegnare il ruolo admin',
                    code: 'AUTH_FORBIDDEN',
                });
            }
            if (ADMIN_ROLES.includes(current.role) && !ADMIN_ROLES.includes(normalizedRole)) {
                const admins = await countActiveAdminsInOrg(organization_id);
                if (admins <= 1 && current.is_active) {
                    return res.status(400).json({
                        success: false,
                        error: 'Non si può togliere il ruolo admin all\'ultimo amministratore attivo',
                        code: 'LAST_ADMIN_PROTECTED',
                    });
                }
            }
            updates.push('role = @role');
            params.role = normalizedRole;
        }

        if (is_active !== undefined) {
            const active = Boolean(is_active);
            if (!active && targetUserId === actorId) {
                return res.status(400).json({
                    success: false,
                    error: 'Non puoi disattivare il tuo stesso account',
                    code: 'SELF_DEACTIVATE_FORBIDDEN',
                });
            }
            if (!active && (await userIsAdminRole(targetUserId, organization_id))) {
                const admins = await countActiveAdminsInOrg(organization_id);
                if (admins <= 1) {
                    return res.status(400).json({
                        success: false,
                        error: 'Non si può disattivare l\'ultimo amministratore',
                        code: 'LAST_ADMIN_PROTECTED',
                    });
                }
            }
            updates.push('is_active = @is_active');
            params.is_active = active ? 1 : 0;
        }

        if (auditor_org_id !== undefined) {
            let aoId = auditor_org_id === null || auditor_org_id === '' ? null : parseInt(auditor_org_id, 10);
            if (Number.isNaN(aoId)) aoId = null;
            if (aoId != null) {
                const ao = await query(
                    `SELECT id FROM auditor_orgs WHERE id = @id AND organization_id = @organization_id AND is_active = 1`,
                    { id: aoId, organization_id }
                );
                if (ao.recordset.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'auditor_org_id non valido',
                        code: 'INVALID_AUDITOR_ORG',
                    });
                }
            }
            updates.push('auditor_org_id = @auditor_org_id');
            params.auditor_org_id = aoId;
        }

        if (password !== undefined && password !== null && String(password).length > 0) {
            if (String(password).length < 8) {
                return res.status(400).json({
                    success: false,
                    error: 'Password: minimo 8 caratteri',
                    code: 'VALIDATION_ERROR',
                });
            }
            const password_hash = await bcrypt.hash(String(password), 10);
            updates.push('password_hash = @password_hash');
            params.password_hash = password_hash;
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nessun campo da aggiornare',
                code: 'VALIDATION_ERROR',
            });
        }

        await query(
            `UPDATE users SET ${updates.join(', ')} WHERE user_id = @user_id AND organization_id = @organization_id`,
            params
        );

        logger.info('Admin update user', { target_user_id: targetUserId, organization_id, actorId, fields: updates });

        res.json({ success: true, message: 'Utente aggiornato' });
    } catch (error) {
        logger.error('Admin updateUser error', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Errore aggiornamento utente',
            code: 'ADMIN_UPDATE_USER_ERROR',
        });
    }
}

/**
 * DELETE /api/v1/admin/users/:id
 * Disattiva utente (soft: is_active = 0)
 */
async function deactivateUser(req, res) {
    try {
        const { organization_id, user_id: actorId } = req.user;
        const targetUserId = parseInt(req.params.id, 10);

        if (isNaN(targetUserId)) {
            return res.status(400).json({
                success: false,
                error: 'ID utente non valido',
                code: 'VALIDATION_ERROR',
            });
        }

        if (targetUserId === actorId) {
            return res.status(400).json({
                success: false,
                error: 'Non puoi disattivare il tuo stesso account',
                code: 'SELF_DEACTIVATE_FORBIDDEN',
            });
        }

        const userCheck = await query(
            `SELECT user_id, is_active FROM users
             WHERE user_id = @user_id AND organization_id = @organization_id`,
            { user_id: targetUserId, organization_id }
        );
        if (userCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utente non trovato',
                code: 'USER_NOT_FOUND',
            });
        }

        if (!userCheck.recordset[0].is_active) {
            return res.json({ success: true, message: 'Utente già disattivato' });
        }

        if (await userIsAdminRole(targetUserId, organization_id)) {
            const admins = await countActiveAdminsInOrg(organization_id);
            if (admins <= 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Non si può disattivare l\'ultimo amministratore',
                    code: 'LAST_ADMIN_PROTECTED',
                });
            }
        }

        await query(
            `UPDATE users SET is_active = 0 WHERE user_id = @user_id AND organization_id = @organization_id`,
            { user_id: targetUserId, organization_id }
        );

        logger.info('Admin deactivate user', { target_user_id: targetUserId, organization_id, actorId });

        res.json({ success: true, message: 'Utente disattivato' });
    } catch (error) {
        logger.error('Admin deactivateUser error', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Errore disattivazione utente',
            code: 'ADMIN_DEACTIVATE_USER_ERROR',
        });
    }
}

/**
 * PUT /api/v1/admin/users/:id/standards
 * Aggiorna gli standard consentiti per un utente (solo admin)
 * Body: { standard_ids: [1, 2, 3] } — array di standard_id (vuoto = nessuna restrizione, ma per "tutti" non usare questo endpoint, elimina le righe)
 */
async function updateUserStandards(req, res) {
    try {
        const { organization_id } = req.user;
        const targetUserId = parseInt(req.params.id, 10);
        const { standard_ids } = req.body || {};

        if (isNaN(targetUserId)) {
            return res.status(400).json({
                success: false,
                error: 'ID utente non valido',
                code: 'VALIDATION_ERROR'
            });
        }

        // Verifica che l'utente target appartenga all'organizzazione
        const userCheck = await query(`
            SELECT user_id, full_name, email FROM users
            WHERE user_id = @user_id AND organization_id = @organization_id
        `, { user_id: targetUserId, organization_id });

        if (userCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utente non trovato o non appartiene alla tua organizzazione',
                code: 'USER_NOT_FOUND'
            });
        }

        const ids = Array.isArray(standard_ids)
            ? standard_ids.map(i => parseInt(i, 10)).filter(i => !isNaN(i) && i > 0)
            : [];

        // Verifica che tutti gli standard_id esistano
        if (ids.length > 0) {
            const placeholders = ids.map((_, i) => `@sid${i}`).join(',');
            const params = ids.reduce((acc, id, i) => ({ ...acc, [`sid${i}`]: id }), {});
            const stdCheck = await query(
                `SELECT standard_id FROM standards WHERE standard_id IN (${placeholders}) AND is_active = 1`,
                params
            );
            const existingIds = (stdCheck.recordset || []).map(r => r.standard_id);
            const invalid = ids.filter(id => !existingIds.includes(id));
            if (invalid.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Uno o più standard_id non validi o non attivi',
                    code: 'INVALID_STANDARD_IDS',
                    invalid_standard_ids: invalid
                });
            }
        }

        // Sostituisci user_standards: elimina esistenti e inserisci i nuovi
        await query(`DELETE FROM user_standards WHERE user_id = @user_id`, { user_id: targetUserId });

        for (const standard_id of ids) {
            await query(`
                INSERT INTO user_standards (user_id, standard_id) VALUES (@user_id, @standard_id)
            `, { user_id: targetUserId, standard_id });
        }

        logger.info('Admin update user standards', {
            target_user_id: targetUserId,
            standard_ids: ids,
            admin_org: organization_id
        });

        res.json({
            success: true,
            message: 'Standard consentiti aggiornati',
            user_id: targetUserId,
            allowed_standard_ids: ids
        });
    } catch (error) {
        logger.error('Admin updateUserStandards error', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Errore aggiornamento standard utente',
            code: 'ADMIN_UPDATE_STANDARDS_ERROR'
        });
    }
}

/**
 * GET /api/v1/admin/licenses — moduli licenziati per l'organizzazione corrente (solo admin)
 */
async function getOrgLicenses(req, res) {
    try {
        const { organization_id } = req.user;
        const modules = await getLicensedModuleKeysForOrg(organization_id);
        const r = await query(
            `SELECT licensed_modules FROM organizations WHERE organization_id = @organization_id`,
            { organization_id }
        );
        const raw = r.recordset[0]?.licensed_modules ?? null;
        res.json({
            success: true,
            data: {
                modules,
                raw_override: raw,
                available: KNOWN_MODULE_KEYS.map((key) => ({ key, label: LABELS_IT[key] || key })),
            },
        });
    } catch (error) {
        logger.error('Admin getOrgLicenses error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore lettura licenze' });
    }
}

/**
 * PATCH /api/v1/admin/licenses
 * body: { modules: string[] } oppure { use_defaults: true } per tornare a NULL (tutti i moduli)
 */
async function updateOrgLicenses(req, res) {
    try {
        const { organization_id } = req.user;
        const { modules, use_defaults } = req.body || {};

        if (use_defaults === true) {
            await clearLicensedModulesOverride(organization_id);
            const updated = await getLicensedModuleKeysForOrg(organization_id);
            logger.info('Admin licenses reset to defaults', { organization_id });
            return res.json({ success: true, data: { modules: updated } });
        }

        if (!Array.isArray(modules)) {
            return res.status(400).json({
                success: false,
                error: 'Campo "modules" deve essere un array di stringhe',
                code: 'INVALID_BODY',
            });
        }

        const updated = await setLicensedModulesForOrg(organization_id, modules);
        logger.info('Admin licenses updated', { organization_id, modules: updated });
        res.json({ success: true, data: { modules: updated } });
    } catch (error) {
        logger.error('Admin updateOrgLicenses error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore aggiornamento licenze' });
    }
}

module.exports = {
    listUsers,
    createUser,
    updateUser,
    deactivateUser,
    updateUserStandards,
    getOrgLicenses,
    updateOrgLicenses,
};
