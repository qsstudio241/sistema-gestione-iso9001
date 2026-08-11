/**
 * Admin Controller - Gestione utenti e assegnazione standard (solo admin)
 */

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const {
    getLicensedModuleKeysForOrg,
    getOrgLicensesPayload,
    setLicensedModulesForOrg,
    clearLicensedModulesOverride,
} = require('../services/moduleLicense.service');
const documentTreeProvisioner = require('../services/documentTreeProvisioner.service');
const billingService = require('../services/billing.service');
const userAuditService = require('../services/userAudit.service');
const userInviteService = require('../services/userInvite.service');

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

/** Superadmin o admin possono promuovere altri admin org. */
function isElevatedAdmin(reqUser) {
    return reqUser.role === 'admin' || reqUser.role === 'superadmin';
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
                    u.created_at, u.last_login, u.organization_id, u.pending_activation,
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
                    u.created_at, u.last_login, u.organization_id, u.pending_activation,
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
        const { email, password, full_name, role = 'auditor', auditor_org_id, send_invite } = req.body || {};

        // Flusso invito (UAL-3): opzionale e aggiuntivo. Se send_invite === true,
        // l'admin non imposta una password: il sistema genera un utente "in attesa"
        // e invia un link di invito via email. Il flusso classico (password impostata
        // subito dall'admin, comportamento invariato) resta il default se send_invite
        // non è passato o è false — nessuna modifica del comportamento esistente.
        const isInviteMode = send_invite === true;

        if (!email || !full_name || (!isInviteMode && !password)) {
            return res.status(400).json({
                success: false,
                error: isInviteMode
                    ? 'Campi obbligatori: email, full_name'
                    : 'Campi obbligatori: email, password, full_name',
                code: 'VALIDATION_ERROR',
            });
        }
        if (!isInviteMode && String(password).length < 8) {
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

        // Univocità GLOBALE (non scoped a organization_id): il vincolo reale nel
        // database (UQ_users_email) è un'email = un account su tutta la
        // piattaforma, non per organizzazione. Un pre-check scoped alla sola
        // organizzazione dell'attore poteva non trovare nulla per un'email già
        // usata in un ALTRO tenant, facendo poi fallire l'INSERT con un errore SQL
        // grezzo mostrato come 500 generico (bug reale riprodotto su un endpoint
        // gemello, auditorOrg.controller.js::inviteFirstStudioAdmin, 11/08/2026).
        const existing = await query(
            `SELECT user_id, organization_id FROM users WHERE email = @email`,
            { email: String(email).trim() }
        );
        if (existing.recordset.length > 0) {
            const sameOrg = existing.recordset[0].organization_id === organization_id;
            return res.status(409).json({
                success: false,
                error: sameOrg
                    ? 'Email già registrata in questa organizzazione'
                    : 'Questa email è già associata a un utente esistente in un\'altra organizzazione. Le email sono univoche su tutta la piattaforma: usa un indirizzo diverso.',
                code: 'EMAIL_DUPLICATE',
            });
        }

        // Invito: password_hash placeholder (hash bcrypt di una stringa casuale) — nessuna
        // password reale potrà mai corrispondere, quindi il login resta bloccato finché
        // l'utente non accetta l'invito e imposta la propria password (accept-invite).
        const password_hash = isInviteMode
            ? await userInviteService.generatePlaceholderPasswordHash()
            : await bcrypt.hash(String(password), 10);

        const result = await query(
            `INSERT INTO users (email, password_hash, full_name, role, organization_id, auditor_org_id, is_active, pending_activation)
             VALUES (@email, @password_hash, @full_name, @role, @organization_id, @auditor_org_id, 1, @pending_activation);
             SELECT SCOPE_IDENTITY() AS user_id;`,
            {
                email: String(email).trim(),
                password_hash,
                full_name: String(full_name).trim(),
                role: normalizedRole,
                organization_id,
                auditor_org_id: aoId,
                pending_activation: isInviteMode ? 1 : 0,
            }
        );

        const newId = result.recordset[0]?.user_id;
        logger.info('Admin create user', { new_user_id: newId, organization_id, actorId, role: normalizedRole, isInviteMode });

        await userAuditService.logUserAuditEvent({
            organizationId: organization_id,
            targetUserId: newId,
            actorUserId: actorId,
            action: 'user_created',
            newValue: { email: String(email).trim(), role: normalizedRole, auditor_org_id: aoId, invited: isInviteMode },
        });

        // Invio invito: MAI bloccante per la creazione utente (stesso pattern
        // dell'auto-provisioning albero documentale qui sotto). Se l'email fallisce,
        // l'utente resta "in attesa" e l'admin può reinviare l'invito in un secondo momento.
        if (isInviteMode && newId) {
            try {
                await userInviteService.sendInviteEmail({
                    userId: newId,
                    email: String(email).trim(),
                    fullName: String(full_name).trim(),
                    organizationId: organization_id,
                    actorUserId: actorId,
                });
            } catch (inviteErr) {
                logger.warn('[Invite] Invio email invito fallito (non bloccante)', { error: inviteErr.message, newId });
            }
        }

        const { company_access: companyAccessInput } = req.body || {};
        if (Array.isArray(companyAccessInput) && companyAccessInput.length > 0 && newId) {
            for (const entry of companyAccessInput) {
                const companyId = parseInt(entry?.company_id, 10);
                const permission = String(entry?.permission || 'read').toLowerCase();
                if (!Number.isFinite(companyId)) continue;
                if (!['read', 'write'].includes(permission)) continue;
                const valid = await validateCompanyInOrg(companyId, organization_id);
                if (!valid) continue;
                await query(`
                    MERGE user_company_access AS target
                    USING (SELECT @user_id AS user_id, @company_id AS company_id) AS source
                    ON target.user_id = source.user_id AND target.company_id = source.company_id
                    WHEN MATCHED THEN
                        UPDATE SET permission = @permission, organization_id = @organization_id
                    WHEN NOT MATCHED THEN
                        INSERT (user_id, company_id, permission, organization_id)
                        VALUES (@user_id, @company_id, @permission, @organization_id);
                `, {
                    user_id: newId,
                    company_id: companyId,
                    permission,
                    organization_id,
                });
                await userAuditService.logUserAuditEvent({
                    organizationId: organization_id,
                    targetUserId: newId,
                    actorUserId: actorId,
                    action: 'company_access_granted',
                    fieldChanged: 'company_access',
                    newValue: { company_id: companyId, permission },
                });
            }
        }

        // Auto-provisioning albero documentale se non esiste ancora
        try {
            const rootCheck = await query(
                `SELECT TOP 1 id FROM document_registry
                 WHERE organization_id = @organization_id AND parent_id IS NULL`,
                { organization_id }
            );
            if (rootCheck.recordset.length === 0) {
                const stdRes = await query(
                    `SELECT standard_code FROM standards WHERE is_active = 1`
                );
                const standardCodes = (stdRes.recordset || []).map(r => r.standard_code);
                await documentTreeProvisioner.provisionTree(organization_id, null, null, standardCodes);
                logger.info('[AutoProvision] Document tree created for org', { organization_id });
            }
        } catch (provErr) {
            logger.warn('[AutoProvision] Failed (non-blocking)', { organization_id, error: provErr.message });
        }

        res.status(201).json({
            success: true,
            data: {
                user_id: newId,
                email: String(email).trim(),
                full_name: String(full_name).trim(),
                role: normalizedRole,
                auditor_org_id: aoId,
                is_active: true,
                pending_activation: isInviteMode,
            },
        });
    } catch (error) {
        // Rete di sicurezza per race condition sul pre-check email (stesso principio
        // difensivo di auditorOrg.controller.js::createAuditorOrg/inviteFirstStudioAdmin).
        if (error.number === 2627 || error.number === 2601 || /UNIQUE|duplicate/i.test(error.message || '')) {
            logger.warn('Admin createUser: violazione univocità email a livello DB (race condition sul pre-check)', { error: error.message });
            return res.status(409).json({
                success: false,
                error: 'Questa email è già associata a un utente esistente. Le email sono univoche su tutta la piattaforma: usa un indirizzo diverso.',
                code: 'EMAIL_DUPLICATE',
            });
        }
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
        const { organization_id: actorOrgId, user_id: actorId, role: actorRole } = req.user;
        const isSuperadmin = actorRole === 'superadmin';
        const targetUserId = parseInt(req.params.id, 10);
        const { full_name, role, is_active, auditor_org_id, password } = req.body || {};

        if (isNaN(targetUserId)) {
            return res.status(400).json({
                success: false,
                error: 'ID utente non valido',
                code: 'VALIDATION_ERROR',
            });
        }

        // superadmin: cerca senza filtro org; admin: solo nella propria org
        const userCheck = isSuperadmin
            ? await query(
                `SELECT user_id, role, is_active, organization_id, full_name, auditor_org_id FROM users WHERE user_id = @user_id`,
                { user_id: targetUserId }
              )
            : await query(
                `SELECT user_id, role, is_active, organization_id, full_name, auditor_org_id FROM users
                 WHERE user_id = @user_id AND organization_id = @organization_id`,
                { user_id: targetUserId, organization_id: actorOrgId }
              );

        if (userCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utente non trovato',
                code: 'USER_NOT_FOUND',
            });
        }

        // Usa sempre l'org del target per validazioni (non quella del superadmin chiamante)
        const organization_id = userCheck.recordset[0].organization_id;
        const current = userCheck.recordset[0];
        const updates = [];
        const params = { user_id: targetUserId, organization_id };
        const auditLogEntries = [];

        if (full_name !== undefined) {
            const trimmedName = String(full_name).trim();
            if (!trimmedName) {
                return res.status(400).json({
                    success: false,
                    error: 'full_name non può essere vuoto',
                    code: 'VALIDATION_ERROR',
                });
            }
            updates.push('full_name = @full_name');
            params.full_name = trimmedName;
            if (trimmedName !== current.full_name) {
                auditLogEntries.push({
                    action: 'profile_updated', fieldChanged: 'full_name',
                    oldValue: current.full_name, newValue: trimmedName,
                });
            }
        }

        if (role !== undefined) {
            const normalizedRole = String(role).toLowerCase().trim();
            const allowed = isSuperadmin
                ? ['auditor', 'viewer', 'admin', 'superadmin']
                : ['auditor', 'viewer', 'admin'];
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
            if (normalizedRole !== current.role) {
                auditLogEntries.push({
                    action: 'role_changed', fieldChanged: 'role',
                    oldValue: current.role, newValue: normalizedRole,
                });
            }
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
            if (Boolean(current.is_active) !== active) {
                auditLogEntries.push({
                    action: active ? 'activated' : 'deactivated', fieldChanged: 'is_active',
                    oldValue: Boolean(current.is_active), newValue: active,
                });
            }
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
            if (aoId !== (current.auditor_org_id ?? null)) {
                auditLogEntries.push({
                    action: 'auditor_org_changed', fieldChanged: 'auditor_org_id',
                    oldValue: current.auditor_org_id, newValue: aoId,
                });
            }
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
            auditLogEntries.push({ action: 'password_reset_by_admin', fieldChanged: 'password_hash' });
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

        for (const entry of auditLogEntries) {
            await userAuditService.logUserAuditEvent({
                organizationId: organization_id,
                targetUserId,
                actorUserId: actorId,
                ...entry,
            });
        }

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
        const { user_id: actorId, role: actorRole } = req.user;
        const isSuperadmin = actorRole === 'superadmin';
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

        const userCheck = isSuperadmin
            ? await query(
                `SELECT user_id, is_active, organization_id FROM users WHERE user_id = @user_id`,
                { user_id: targetUserId }
              )
            : await query(
                `SELECT user_id, is_active, organization_id FROM users
                 WHERE user_id = @user_id AND organization_id = @organization_id`,
                { user_id: targetUserId, organization_id: req.user.organization_id }
              );

        if (userCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utente non trovato',
                code: 'USER_NOT_FOUND',
            });
        }

        const { organization_id } = userCheck.recordset[0];

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
            `UPDATE users SET is_active = 0 WHERE user_id = @user_id`,
            { user_id: targetUserId }
        );

        await userAuditService.logUserAuditEvent({
            organizationId: organization_id,
            targetUserId,
            actorUserId: actorId,
            action: 'deactivated',
            fieldChanged: 'is_active',
            oldValue: true,
            newValue: false,
        });

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

        // Verifica che l'utente target esista (superadmin: cross-org; admin: solo propria org)
        const isSuperadmin = req.user.role === 'superadmin';
        const userCheck = isSuperadmin
            ? await query(`SELECT user_id, full_name, email, organization_id FROM users WHERE user_id = @user_id`, { user_id: targetUserId })
            : await query(`SELECT user_id, full_name, email, organization_id FROM users WHERE user_id = @user_id AND organization_id = @organization_id`, { user_id: targetUserId, organization_id });

        if (userCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utente non trovato o non appartiene alla tua organizzazione',
                code: 'USER_NOT_FOUND'
            });
        }
        const targetOrgId = userCheck.recordset[0].organization_id;

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

        // Snapshot valori precedenti per l'audit trail (letto prima della sostituzione)
        const oldStdRes = await query(
            `SELECT standard_id FROM user_standards WHERE user_id = @user_id ORDER BY standard_id`,
            { user_id: targetUserId }
        );
        const oldIds = (oldStdRes.recordset || []).map((r) => r.standard_id);

        // Sostituisci user_standards: elimina esistenti e inserisci i nuovi
        await query(`DELETE FROM user_standards WHERE user_id = @user_id`, { user_id: targetUserId });

        for (const standard_id of ids) {
            await query(`
                INSERT INTO user_standards (user_id, standard_id) VALUES (@user_id, @standard_id)
            `, { user_id: targetUserId, standard_id });
        }

        await userAuditService.logUserAuditEvent({
            organizationId: targetOrgId,
            targetUserId,
            actorUserId: req.user.user_id,
            action: 'standards_updated',
            fieldChanged: 'allowed_standard_ids',
            oldValue: oldIds,
            newValue: ids,
        });

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
 * GET /api/v1/admin/organizations — elenco tenant (solo superadmin)
 */
async function listOrganizations(req, res) {
    try {
        const result = await query(`
            SELECT
                organization_id,
                organization_name,
                organization_code,
                is_active,
                CASE
                    WHEN licensed_modules IS NULL OR LTRIM(RTRIM(licensed_modules)) = '' THEN 1
                    ELSE 0
                END AS uses_defaults
            FROM organizations
            ORDER BY organization_name, organization_id
        `, {});
        res.json({ success: true, data: result.recordset || [] });
    } catch (error) {
        logger.error('Admin listOrganizations error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore elenco organizzazioni' });
    }
}

/**
 * GET /api/v1/admin/licenses — moduli licenziati per l'organizzazione corrente (solo admin)
 */
async function getOrgLicenses(req, res) {
    try {
        const { organization_id } = req.user;
        const payload = await getOrgLicensesPayload(organization_id);
        if (!payload) {
            return res.status(404).json({ success: false, error: 'Organizzazione non trovata' });
        }
        res.json({ success: true, data: payload });
    } catch (error) {
        logger.error('Admin getOrgLicenses error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore lettura licenze' });
    }
}

/**
 * GET /api/v1/admin/organizations/:organizationId/licenses — superadmin legge licenze tenant
 */
async function getAnyOrgLicenses(req, res) {
    try {
        const targetOrgId = parseInt(req.params.organizationId, 10);
        if (!Number.isFinite(targetOrgId)) {
            return res.status(400).json({ success: false, error: 'organizationId non valido' });
        }
        const payload = await getOrgLicensesPayload(targetOrgId);
        if (!payload) {
            return res.status(404).json({ success: false, error: 'Organizzazione non trovata' });
        }
        res.json({ success: true, data: payload });
    } catch (error) {
        logger.error('Admin getAnyOrgLicenses error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore lettura licenze organizzazione' });
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
            await billingService.onLicensesUpdated({
                organizationId: organization_id,
                modules: updated,
                useDefaults: true,
                updatedBy: req.user.user_id,
            });
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
        await billingService.onLicensesUpdated({
            organizationId: organization_id,
            modules: updated,
            useDefaults: false,
            updatedBy: req.user.user_id,
        });
        logger.info('Admin licenses updated', { organization_id, modules: updated });
        res.json({ success: true, data: { modules: updated } });
    } catch (error) {
        logger.error('Admin updateOrgLicenses error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore aggiornamento licenze' });
    }
}

/**
 * PATCH /api/v1/admin/organizations/:organizationId/licenses
 * Superadmin: aggiorna licensed_modules di qualsiasi organizzazione (studio cliente).
 * body: { modules: string[] } | { use_defaults: true }
 */
async function updateAnyOrgLicenses(req, res) {
    try {
        const targetOrgId = parseInt(req.params.organizationId, 10);
        if (!Number.isFinite(targetOrgId)) {
            return res.status(400).json({ success: false, error: 'organizationId non valido' });
        }

        const orgCheck = await query(
            `SELECT organization_id FROM organizations WHERE organization_id = @organization_id`,
            { organization_id: targetOrgId }
        );
        if (!orgCheck.recordset.length) {
            return res.status(404).json({ success: false, error: 'Organizzazione non trovata' });
        }

        const { modules, use_defaults } = req.body || {};

        if (use_defaults === true) {
            await clearLicensedModulesOverride(targetOrgId);
            const updated = await getLicensedModuleKeysForOrg(targetOrgId);
            await billingService.onLicensesUpdated({
                organizationId: targetOrgId,
                modules: updated,
                useDefaults: true,
                updatedBy: req.user.user_id,
            });
            logger.info('Superadmin reset org licenses to defaults', { targetOrgId, actor: req.user.user_id });
            return res.json({ success: true, data: { modules: updated } });
        }

        if (!Array.isArray(modules)) {
            return res.status(400).json({ success: false, error: 'Campo "modules" deve essere un array', code: 'INVALID_BODY' });
        }

        const updated = await setLicensedModulesForOrg(targetOrgId, modules);
        await billingService.onLicensesUpdated({
            organizationId: targetOrgId,
            modules: updated,
            useDefaults: false,
            updatedBy: req.user.user_id,
        });
        logger.info('Superadmin updated org licenses', { targetOrgId, modules: updated, actor: req.user.user_id });
        res.json({ success: true, data: { modules: updated } });
    } catch (error) {
        logger.error('Admin updateAnyOrgLicenses error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore aggiornamento licenze organizzazione' });
    }
}

async function validateCompanyInOrg(companyId, organizationId) {
    const r = await query(`
        SELECT c.id
        FROM companies c
        INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
        WHERE c.id = @company_id AND ao.organization_id = @organization_id
    `, { company_id: companyId, organization_id: organizationId });
    return r.recordset.length > 0;
}

async function resolveTargetUser(req, targetUserId) {
    const { organization_id: actorOrgId, role: actorRole } = req.user;
    const isSuperadmin = actorRole === 'superadmin';
    const parsedId = parseInt(targetUserId, 10);
    if (!Number.isFinite(parsedId)) return null;

    const userCheck = isSuperadmin
        ? await query(
            `SELECT user_id, organization_id FROM users WHERE user_id = @user_id`,
            { user_id: parsedId }
        )
        : await query(
            `SELECT user_id, organization_id FROM users
             WHERE user_id = @user_id AND organization_id = @organization_id`,
            { user_id: parsedId, organization_id: actorOrgId }
        );

    return userCheck.recordset[0] || null;
}

/**
 * GET /api/v1/admin/users/:id/company-access
 */
async function listUserCompanyAccess(req, res) {
    try {
        const target = await resolveTargetUser(req, req.params.id);
        if (!target) {
            return res.status(404).json({ success: false, error: 'Utente non trovato', code: 'USER_NOT_FOUND' });
        }

        const result = await query(`
            SELECT uca.id, uca.company_id, uca.permission, c.name AS company_name
            FROM user_company_access uca
            INNER JOIN companies c ON c.id = uca.company_id
            WHERE uca.user_id = @user_id
            ORDER BY c.name
        `, { user_id: target.user_id });

        res.json({ success: true, data: result.recordset || [] });
    } catch (error) {
        logger.error('Admin listUserCompanyAccess error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore recupero accessi azienda' });
    }
}

/**
 * POST /api/v1/admin/users/:id/company-access
 * body: { company_id, permission: 'read'|'write' }
 */
async function addUserCompanyAccess(req, res) {
    try {
        const target = await resolveTargetUser(req, req.params.id);
        if (!target) {
            return res.status(404).json({ success: false, error: 'Utente non trovato', code: 'USER_NOT_FOUND' });
        }

        const companyId = parseInt(req.body?.company_id, 10);
        const permission = String(req.body?.permission || 'read').toLowerCase();
        if (!Number.isFinite(companyId)) {
            return res.status(400).json({ success: false, error: 'company_id obbligatorio', code: 'VALIDATION_ERROR' });
        }
        if (!['read', 'write'].includes(permission)) {
            return res.status(400).json({ success: false, error: 'permission deve essere read o write', code: 'VALIDATION_ERROR' });
        }
        if (!(await validateCompanyInOrg(companyId, target.organization_id))) {
            return res.status(400).json({ success: false, error: 'Azienda non valida per questa organizzazione', code: 'INVALID_COMPANY' });
        }

        const mergeResult = await query(`
            MERGE user_company_access AS target
            USING (SELECT @user_id AS user_id, @company_id AS company_id) AS source
            ON target.user_id = source.user_id AND target.company_id = source.company_id
            WHEN MATCHED THEN
                UPDATE SET permission = @permission, organization_id = @organization_id
            WHEN NOT MATCHED THEN
                INSERT (user_id, company_id, permission, organization_id)
                VALUES (@user_id, @company_id, @permission, @organization_id)
            OUTPUT $action AS merge_action, deleted.permission AS old_permission;
        `, {
            user_id: target.user_id,
            company_id: companyId,
            permission,
            organization_id: target.organization_id,
        });

        const mergeRow = mergeResult?.recordset && mergeResult.recordset[0];
        const wasUpdate = mergeRow?.merge_action === 'UPDATE';
        await userAuditService.logUserAuditEvent({
            organizationId: target.organization_id,
            targetUserId: target.user_id,
            actorUserId: req.user.user_id,
            action: wasUpdate ? 'company_access_updated' : 'company_access_granted',
            fieldChanged: 'company_access',
            oldValue: wasUpdate ? { company_id: companyId, permission: mergeRow?.old_permission ?? null } : null,
            newValue: { company_id: companyId, permission },
        });

        res.status(201).json({ success: true, data: { company_id: companyId, permission } });
    } catch (error) {
        logger.error('Admin addUserCompanyAccess error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore assegnazione accesso azienda' });
    }
}

/**
 * DELETE /api/v1/admin/users/:id/company-access/:companyId
 */
async function removeUserCompanyAccess(req, res) {
    try {
        const target = await resolveTargetUser(req, req.params.id);
        if (!target) {
            return res.status(404).json({ success: false, error: 'Utente non trovato', code: 'USER_NOT_FOUND' });
        }

        const companyId = parseInt(req.params.companyId, 10);
        if (!Number.isFinite(companyId)) {
            return res.status(400).json({ success: false, error: 'companyId non valido', code: 'VALIDATION_ERROR' });
        }

        const deleteResult = await query(`
            DELETE FROM user_company_access
            OUTPUT deleted.permission
            WHERE user_id = @user_id AND company_id = @company_id
        `, { user_id: target.user_id, company_id: companyId });

        const deletedRow = deleteResult?.recordset && deleteResult.recordset[0];
        await userAuditService.logUserAuditEvent({
            organizationId: target.organization_id,
            targetUserId: target.user_id,
            actorUserId: req.user.user_id,
            action: 'company_access_revoked',
            fieldChanged: 'company_access',
            oldValue: { company_id: companyId, permission: deletedRow?.permission ?? null },
        });

        res.json({ success: true });
    } catch (error) {
        logger.error('Admin removeUserCompanyAccess error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore rimozione accesso azienda' });
    }
}

/**
 * GET /api/v1/admin/users/:id/audit-log
 * Storico modifiche (chi ha fatto cosa e quando) per un utente — solo admin/superadmin.
 */
async function getUserAuditLog(req, res) {
    try {
        const target = await resolveTargetUser(req, req.params.id);
        if (!target) {
            return res.status(404).json({ success: false, error: 'Utente non trovato', code: 'USER_NOT_FOUND' });
        }

        const limit = req.query.limit;
        const events = await userAuditService.getUserAuditLog(target.user_id, target.organization_id, limit);

        res.json({ success: true, data: events });
    } catch (error) {
        logger.error('Admin getUserAuditLog error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore recupero storico modifiche', code: 'ADMIN_AUDIT_LOG_ERROR' });
    }
}

/**
 * POST /api/v1/admin/users/:id/resend-invite
 * Rigenera e reinvia il link di invito (es. link scaduto) — solo utenti
 * ancora "in attesa di attivazione" (pending_activation = 1).
 */
async function resendUserInvite(req, res) {
    try {
        const target = await resolveTargetUser(req, req.params.id);
        if (!target) {
            return res.status(404).json({ success: false, error: 'Utente non trovato', code: 'USER_NOT_FOUND' });
        }

        const userRes = await query(
            `SELECT email, full_name, pending_activation, is_active FROM users WHERE user_id = @user_id`,
            { user_id: target.user_id }
        );
        const u = userRes.recordset[0];
        if (!u) {
            return res.status(404).json({ success: false, error: 'Utente non trovato', code: 'USER_NOT_FOUND' });
        }
        if (!u.is_active) {
            return res.status(400).json({ success: false, error: 'Utente disattivato', code: 'USER_INACTIVE' });
        }
        if (!u.pending_activation) {
            return res.status(400).json({
                success: false,
                error: 'Questo utente ha già attivato il proprio account',
                code: 'NOT_PENDING',
            });
        }

        await userInviteService.sendInviteEmail({
            userId: target.user_id,
            email: u.email,
            fullName: u.full_name,
            organizationId: target.organization_id,
            actorUserId: req.user.user_id,
            isResend: true,
        });

        logger.info('Admin resend invite', { target_user_id: target.user_id, actor: req.user.user_id });
        res.json({ success: true, message: 'Invito reinviato' });
    } catch (error) {
        logger.error('Admin resendUserInvite error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore reinvio invito', code: 'ADMIN_RESEND_INVITE_ERROR' });
    }
}

module.exports = {
    listUsers,
    createUser,
    updateUser,
    deactivateUser,
    updateUserStandards,
    listOrganizations,
    getOrgLicenses,
    getAnyOrgLicenses,
    updateOrgLicenses,
    updateAnyOrgLicenses,
    listUserCompanyAccess,
    addUserCompanyAccess,
    removeUserCompanyAccess,
    getUserAuditLog,
    resendUserInvite,
};
