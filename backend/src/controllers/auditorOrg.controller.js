/**
 * Auditor Org Controller - Fase 1 Multi-Tenant
 * Lista/get auditor_orgs (studi di consulenza)
 * Superadmin: vede tutti. Auditor: vede solo il proprio.
 */

const { query, getPool, sql } = require('../config/database');
const logger = require('../utils/logger');

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
        logger.error('[AUDITOR_ORGS] create error:', error);
        return res.status(500).json({ error: 'Errore creazione studio', code: 'SERVER_ERROR' });
    }
}

module.exports = {
    listAuditorOrgs,
    getAuditorOrgById,
    createAuditorOrg
};
