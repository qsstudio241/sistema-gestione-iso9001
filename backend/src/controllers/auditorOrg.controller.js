/**
 * Auditor Org Controller - Fase 1 Multi-Tenant
 * Lista/get auditor_orgs (studi di consulenza)
 * Superadmin: vede tutti. Auditor: vede solo il proprio.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

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
            // — serve per assegnare correttamente gli auditor cross-tenant dalla UI
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

module.exports = {
    listAuditorOrgs,
    getAuditorOrgById
};
