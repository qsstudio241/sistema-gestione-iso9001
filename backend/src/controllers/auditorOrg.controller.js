/**
 * Auditor Org Controller - Fase 1 Multi-Tenant
 * Lista/get auditor_orgs (studi di consulenza)
 * Superadmin: vede tutti. Auditor: vede solo il proprio.
 */

const { query, getPool, sql } = require('../config/database');
const logger = require('../utils/logger');
const documentTreeProvisioner = require('../services/documentTreeProvisioner.service');
const userAuditService = require('../services/userAudit.service');
const userInviteService = require('../services/userInvite.service');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/v1/auditor-orgs
 * Lista auditor_orgs accessibili all'utente
 */
async function listAuditorOrgs(req, res) {
    try {
        const { organization_id, auditor_org_id, role } = req.user;
        const isSuperadmin   = role === 'superadmin';
        const isOrgWideAdmin = role === 'admin' && !auditor_org_id;

        let result;
        if (isSuperadmin) {
            // Superadmin (piattaforma): vede tutti gli studi di tutti i tenant
            // — usata da "Licenze moduli per studio" (UsersAdminPage) e dal selettore
            // studio di CompaniesPage; la creazione utente resta sempre scoped
            // all'organizzazione dell'attore (createUser), non usa questa lista.
            result = await query(`
                SELECT ao.id, ao.organization_id, ao.name, ao.email, ao.subscription_plan, ao.is_active, ao.created_at, ao.updated_at,
                       o.organization_name, o.licensed_modules
                FROM auditor_orgs ao
                INNER JOIN organizations o ON ao.organization_id = o.organization_id
                ORDER BY o.organization_name, ao.name
            `, {});
        } else if (isOrgWideAdmin) {
            // Admin org (senza studio): vede solo i studi del proprio tenant
            result = await query(`
                SELECT ao.id, ao.organization_id, ao.name, ao.email, ao.subscription_plan, ao.is_active, ao.created_at, ao.updated_at,
                       o.organization_name, o.licensed_modules
                FROM auditor_orgs ao
                INNER JOIN organizations o ON ao.organization_id = o.organization_id
                WHERE ao.organization_id = @organization_id
                ORDER BY ao.name
            `, { organization_id });
        } else if (auditor_org_id) {
            result = await query(`
                SELECT ao.id, ao.organization_id, ao.name, ao.email, ao.subscription_plan, ao.is_active, ao.created_at, ao.updated_at,
                       o.organization_name, o.licensed_modules
                FROM auditor_orgs ao
                INNER JOIN organizations o ON ao.organization_id = o.organization_id
                WHERE ao.id = @auditor_org_id
            `, { auditor_org_id });
        } else {
            return res.json({ success: true, data: [] });
        }

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('[AUDITOR_ORGS] list error:', error);
        res.status(500).json({ error: 'Errore recupero auditor orgs', code: 'SERVER_ERROR' });
    }
}

/**
 * GET /api/v1/auditor-orgs/:id
 */
async function getAuditorOrgById(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const { auditor_org_id, role } = req.user;
        const isOrgWideAdmin = (role === 'admin' || role === 'superadmin') && !auditor_org_id;

        if (!isOrgWideAdmin && id !== auditor_org_id) {
            return res.status(403).json({ error: 'Accesso negato', code: 'FORBIDDEN' });
        }

        const result = await query(`
            SELECT ao.id, ao.organization_id, ao.name, ao.email, ao.subscription_plan, ao.is_active, ao.created_at, ao.updated_at,
                   o.organization_name
            FROM auditor_orgs ao
            INNER JOIN organizations o ON ao.organization_id = o.organization_id
            WHERE ao.id = @id
        `, { id });

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Auditor org non trovato', code: 'NOT_FOUND' });
        }

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('[AUDITOR_ORGS] getById error:', error);
        res.status(500).json({ error: 'Errore recupero auditor org', code: 'SERVER_ERROR' });
    }
}

/**
 * POST /api/v1/auditor-orgs — crea un nuovo tenant (organizations + auditor_orgs collegato)
 * Solo superadmin. Un "nuovo studio" = una nuova coppia organizations + auditor_orgs.
 */
async function createAuditorOrg(req, res) {
    const body = req.body || {};
    const organizationName = typeof body.organization_name === 'string' ? body.organization_name.trim() : '';
    const studioName = typeof body.studio_name === 'string' ? body.studio_name.trim() : '';
    const studioEmail = typeof body.studio_email === 'string' ? body.studio_email.trim() : '';
    const subscriptionPlan = typeof body.subscription_plan === 'string' && body.subscription_plan.trim()
        ? body.subscription_plan.trim()
        : 'standard';

    if (!organizationName || !studioName || !studioEmail) {
        return res.status(400).json({
            error: 'Nome cliente/organizzazione, nome studio ed email referente sono obbligatori',
            code: 'VALIDATION_ERROR'
        });
    }
    if (!EMAIL_REGEX.test(studioEmail)) {
        return res.status(400).json({ error: 'Email referente non valida', code: 'VALIDATION_ERROR' });
    }

    let transaction;
    try {
        const dupOrg = await query(
            `SELECT organization_id FROM organizations WHERE LOWER(organization_name) = LOWER(@organization_name)`,
            { organization_name: organizationName }
        );
        if (dupOrg.recordset.length > 0) {
            return res.status(409).json({
                error: 'Esiste già un\'organizzazione con questo nome',
                code: 'DUPLICATE_ORGANIZATION_NAME'
            });
        }

        const dupEmail = await query(
            `SELECT id FROM auditor_orgs WHERE LOWER(email) = LOWER(@studio_email)`,
            { studio_email: studioEmail }
        );
        if (dupEmail.recordset.length > 0) {
            return res.status(409).json({
                error: 'Esiste già uno studio con questa email',
                code: 'DUPLICATE_STUDIO_EMAIL'
            });
        }

        const pool = await getPool();
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const codeReq = new sql.Request(transaction);
        const codeResult = await codeReq.query(`
            SELECT MAX(CAST(SUBSTRING(organization_code, 5, 10) AS INT)) AS max_num
            FROM organizations
            WHERE organization_code LIKE 'ORG[_]%'
        `);
        const nextNum = (codeResult.recordset[0] && codeResult.recordset[0].max_num ? codeResult.recordset[0].max_num : 0) + 1;
        const organizationCode = `ORG_${String(nextNum).padStart(5, '0')}`;

        const orgInsertReq = new sql.Request(transaction);
        orgInsertReq.input('organization_code', organizationCode);
        orgInsertReq.input('organization_name', organizationName);
        const orgInsertResult = await orgInsertReq.query(`
            INSERT INTO organizations (organization_code, organization_name, is_active, created_at, updated_at)
            OUTPUT INSERTED.organization_id
            VALUES (@organization_code, @organization_name, 1, GETDATE(), GETDATE())
        `);
        const newOrganizationId = orgInsertResult.recordset[0].organization_id;

        const studioInsertReq = new sql.Request(transaction);
        studioInsertReq.input('organization_id', newOrganizationId);
        studioInsertReq.input('name', studioName);
        studioInsertReq.input('email', studioEmail);
        studioInsertReq.input('subscription_plan', subscriptionPlan);
        const studioInsertResult = await studioInsertReq.query(`
            INSERT INTO auditor_orgs (organization_id, name, email, subscription_plan, is_active, created_at, updated_at)
            OUTPUT INSERTED.id, INSERTED.organization_id, INSERTED.name, INSERTED.email,
                   INSERTED.subscription_plan, INSERTED.is_active, INSERTED.created_at, INSERTED.updated_at
            VALUES (@organization_id, @name, @email, @subscription_plan, 1, GETDATE(), GETDATE())
        `);
        const newAuditorOrg = studioInsertResult.recordset[0];

        await transaction.commit();

        logger.info(`[AUDITOR_ORGS] Nuovo studio creato: ${studioName} (organization_id=${newOrganizationId}, code=${organizationCode})`);

        return res.status(201).json({
            success: true,
            data: {
                ...newAuditorOrg,
                organization_name: organizationName,
                licensed_modules: null
            }
        });
    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (_) {
                /* ignore: transazione già chiusa o non avviata */
            }
        }
        // Race condition: due richieste concorrenti possono superare entrambe i controlli
        // di univocità pre-transazione (SELECT non atomiche) — l'indice UNIQUE filtrato
        // UX_auditor_orgs_email (migration 144) è la garanzia reale a livello DB.
        if (error.number === 2627 || error.number === 2601 || /UNIQUE|duplicate/i.test(error.message || '')) {
            logger.warn('[AUDITOR_ORGS] create: violazione univocità a livello DB (race condition sul pre-check)', error.message);
            return res.status(409).json({
                error: 'Esiste già uno studio con questa email o organizzazione',
                code: 'DUPLICATE_STUDIO'
            });
        }
        logger.error('[AUDITOR_ORGS] create error:', error);
        return res.status(500).json({ error: 'Errore creazione studio', code: 'SERVER_ERROR' });
    }
}

/**
 * POST /api/v1/auditor-orgs/:id/invite-admin — invita il primo admin (org-wide, senza
 * auditor_org_id — "amministratore principale", stesso pattern isOrgWideAdmin usato in
 * tutto il codice) del tenant a cui appartiene lo studio indicato.
 * Solo superadmin. Colma il gap architetturale: POST /admin/users (createUser) crea
 * sempre utenti nell'organizzazione dell'attore, quindi non può mai assegnare un utente
 * a un nuovo studio (organization_id diverso per costruzione) — vedi DEPUTYTASK1 S3.
 * Riusa lo stesso flusso invito via email di createUser (nessuna password provvisoria:
 * link "Imposta la tua password" → AcceptInvitePage), MAI la logica di createUser stessa.
 */
async function inviteFirstStudioAdmin(req, res) {
    try {
        const auditorOrgId = parseInt(req.params.id, 10);
        if (Number.isNaN(auditorOrgId)) {
            return res.status(400).json({ error: 'ID studio non valido', code: 'VALIDATION_ERROR' });
        }

        const body = req.body || {};
        const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
        if (!fullName) {
            return res.status(400).json({ error: 'Nome e cognome obbligatorio', code: 'VALIDATION_ERROR' });
        }

        const aoRes = await query(
            `SELECT id, organization_id, name, email FROM auditor_orgs WHERE id = @id`,
            { id: auditorOrgId }
        );
        if (aoRes.recordset.length === 0) {
            return res.status(404).json({ error: 'Studio non trovato', code: 'NOT_FOUND' });
        }
        const auditorOrg = aoRes.recordset[0];
        const organizationId = auditorOrg.organization_id;

        const email = (typeof body.email === 'string' && body.email.trim()) || auditorOrg.email || '';
        if (!email) {
            return res.status(400).json({
                error: 'Email obbligatoria (nessuna email referente salvata per questo studio)',
                code: 'VALIDATION_ERROR'
            });
        }
        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ error: 'Email non valida', code: 'VALIDATION_ERROR' });
        }

        // Univocità GLOBALE (non scoped a organization_id): a differenza di
        // admin.controller.js::createUser — che scopa il controllo alla org
        // dell'attore perché l'attore può creare utenti solo nella propria org,
        // quindi un duplicato cross-org è comunque intercettato dal vincolo DB al
        // primo utilizzo reale — qui l'attore (superadmin) crea utenti in una org
        // DIVERSA dalla propria: uno scoped-check può non trovare nulla (nessun
        // utente con quella email nel NUOVO studio) mentre il DB ha comunque un
        // vincolo UNIQUE globale su users.email (UQ_users_email, un'email = un
        // account su tutta la piattaforma) — senza questo controllo l'INSERT
        // fallisce con un errore SQL grezzo mostrato come 500 generico (bug reale
        // riprodotto in produzione 11/08/2026: email già in uso su un'altra org).
        const existing = await query(
            `SELECT user_id, organization_id FROM users WHERE email = @email`,
            { email }
        );
        if (existing.recordset.length > 0) {
            const sameOrg = existing.recordset[0].organization_id === organizationId;
            return res.status(409).json({
                error: sameOrg
                    ? 'Esiste già un utente con questa email in questo studio'
                    : 'Questa email è già associata a un utente esistente in un\'altra organizzazione. Le email sono univoche su tutta la piattaforma: usa un indirizzo diverso per il primo admin di questo studio.',
                code: 'EMAIL_DUPLICATE'
            });
        }

        // auditor_org_id = NULL (non l'id dello studio target): l'invitato deve essere
        // "amministratore principale" del nuovo tenant (org-wide, come da pattern
        // isOrgWideAdmin usato in tutto il codice), non un semplice "Admin Studio"
        // scoped a un singolo studio — altrimenti perderebbe visibilità org-wide su
        // audit/registro documenti/checklist e non potrebbe gestire eventuali futuri
        // studi aggiuntivi nello stesso tenant (rilievo Bugbot, PR #384).
        const password_hash = await userInviteService.generatePlaceholderPasswordHash();
        const insertRes = await query(
            `INSERT INTO users (email, password_hash, full_name, role, organization_id, auditor_org_id, is_active, pending_activation)
             VALUES (@email, @password_hash, @full_name, 'admin', @organization_id, NULL, 1, 1);
             SELECT SCOPE_IDENTITY() AS user_id;`,
            {
                email,
                password_hash,
                full_name: fullName,
                organization_id: organizationId,
            }
        );
        const newUserId = insertRes.recordset[0]?.user_id;

        logger.info('[AUDITOR_ORGS] Primo admin (org-wide) invitato per nuovo studio', {
            newUserId, auditorOrgId, organizationId, actorId: req.user.user_id
        });

        await userAuditService.logUserAuditEvent({
            organizationId,
            targetUserId: newUserId,
            actorUserId: req.user.user_id,
            action: 'user_created',
            newValue: { email, role: 'admin', auditor_org_id: null, invited: true },
        });

        // Invio invito: MAI bloccante (stesso pattern di admin.controller.js::createUser).
        try {
            await userInviteService.sendInviteEmail({
                userId: newUserId,
                email,
                fullName,
                organizationId,
                actorUserId: req.user.user_id,
            });
        } catch (inviteErr) {
            logger.warn('[AUDITOR_ORGS] Invio email invito fallito (non bloccante)', { error: inviteErr.message, newUserId });
        }

        // Auto-provisioning albero documentale (stesso pattern di createUser): un nuovo
        // studio/organizzazione parte senza alcun documento, serve la radice del registro.
        try {
            const rootCheck = await query(
                `SELECT TOP 1 id FROM document_registry WHERE organization_id = @organization_id AND parent_id IS NULL`,
                { organization_id: organizationId }
            );
            if (rootCheck.recordset.length === 0) {
                const stdRes = await query(`SELECT standard_code FROM standards WHERE is_active = 1`);
                const standardCodes = (stdRes.recordset || []).map(r => r.standard_code);
                await documentTreeProvisioner.provisionTree(organizationId, null, null, standardCodes);
                logger.info('[AUDITOR_ORGS] Document tree creato per nuovo studio', { organizationId });
            }
        } catch (provErr) {
            logger.warn('[AUDITOR_ORGS] Auto-provisioning document tree fallito (non bloccante)', {
                organizationId, error: provErr.message
            });
        }

        return res.status(201).json({
            success: true,
            data: {
                user_id: newUserId,
                email,
                full_name: fullName,
                role: 'admin',
                organization_id: organizationId,
                auditor_org_id: null,
                is_active: true,
                pending_activation: true,
            }
        });
    } catch (error) {
        // Rete di sicurezza per race condition sul pre-check email (stesso principio
        // difensivo di createAuditorOrg, migration 144): il vincolo reale è
        // UQ_users_email (globale su tutta la piattaforma, non per organizzazione).
        if (error.number === 2627 || error.number === 2601 || /UNIQUE|duplicate/i.test(error.message || '')) {
            logger.warn('[AUDITOR_ORGS] inviteFirstStudioAdmin: violazione univocità email a livello DB', error.message);
            return res.status(409).json({
                error: 'Questa email è già associata a un utente esistente. Le email sono univoche su tutta la piattaforma: usa un indirizzo diverso.',
                code: 'EMAIL_DUPLICATE'
            });
        }
        logger.error('[AUDITOR_ORGS] inviteFirstStudioAdmin error:', error);
        return res.status(500).json({ error: 'Errore invito primo admin studio', code: 'SERVER_ERROR' });
    }
}

module.exports = {
    listAuditorOrgs,
    getAuditorOrgById,
    createAuditorOrg,
    inviteFirstStudioAdmin
};
