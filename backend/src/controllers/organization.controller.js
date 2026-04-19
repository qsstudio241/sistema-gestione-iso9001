/**
 * Organization controller — anagrafica tenant (P.IVA, logo)
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const LOGO_DIR_ORG = path.join(process.env.UPLOAD_DIR || './uploads', 'org-logos');
if (!fsSync.existsSync(LOGO_DIR_ORG)) fsSync.mkdirSync(LOGO_DIR_ORG, { recursive: true });

function isOrgAdmin(role) {
    return role === 'admin' || role === 'superadmin';
}

/**
 * GET /api/v1/organizations/me
 */
async function getMyOrganization(req, res) {
    try {
        const orgId = req.user.organization_id;
        const result = await query(
            `
            SELECT organization_id, organization_code, organization_name,
                   vat_number, logo_url, is_active
            FROM dbo.organizations
            WHERE organization_id = @organization_id
            `,
            { organization_id: orgId }
        );
        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Organizzazione non trovata', code: 'NOT_FOUND' });
        }
        const row = result.recordset[0];
        res.json({
            success: true,
            data: {
                organization_id: row.organization_id,
                organization_code: row.organization_code,
                organization_name: row.organization_name,
                vat_number: row.vat_number || '',
                logo_url: row.logo_url || null,
                is_active: !!row.is_active,
            },
        });
    } catch (error) {
        logger.error('[ORG] getMyOrganization error:', error);
        res.status(500).json({ success: false, error: 'Errore recupero organizzazione', code: 'SERVER_ERROR' });
    }
}

/**
 * PATCH /api/v1/organizations/me
 * Body: { vat_number?: string }
 */
async function patchMyOrganization(req, res) {
    try {
        if (!isOrgAdmin(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Solo amministratori', code: 'FORBIDDEN' });
        }
        const orgId = req.user.organization_id;
        const { vat_number } = req.body || {};
        if (vat_number === undefined) {
            return res.status(400).json({ success: false, error: 'Nessun campo da aggiornare', code: 'NO_FIELDS' });
        }
        const vat = vat_number == null ? null : String(vat_number).trim().slice(0, 32);
        await query(
            `UPDATE dbo.organizations SET vat_number = @vat_number WHERE organization_id = @organization_id`,
            { organization_id: orgId, vat_number: vat || null }
        );
        const refreshed = await query(
            `
            SELECT organization_id, organization_code, organization_name, vat_number, logo_url, is_active
            FROM dbo.organizations WHERE organization_id = @organization_id
            `,
            { organization_id: orgId }
        );
        const row = refreshed.recordset[0];
        res.json({
            success: true,
            data: {
                organization_id: row.organization_id,
                organization_code: row.organization_code,
                organization_name: row.organization_name,
                vat_number: row.vat_number || '',
                logo_url: row.logo_url || null,
                is_active: !!row.is_active,
            },
        });
    } catch (error) {
        logger.error('[ORG] patchMyOrganization error:', error);
        res.status(500).json({ success: false, error: 'Errore aggiornamento', code: 'SERVER_ERROR' });
    }
}

/**
 * POST /api/v1/organizations/me/logo
 */
async function uploadLogo(req, res) {
    try {
        if (!isOrgAdmin(req.user.role)) {
            if (req.file) await fs.unlink(req.file.path).catch(() => {});
            return res.status(403).json({ error: 'Solo amministratori', code: 'FORBIDDEN' });
        }
        const orgId = req.user.organization_id;

        const check = await query(
            `SELECT organization_id, logo_url FROM dbo.organizations WHERE organization_id = @organization_id`,
            { organization_id: orgId }
        );
        if (check.recordset.length === 0) {
            if (req.file) await fs.unlink(req.file.path).catch(() => {});
            return res.status(404).json({ error: 'Organizzazione non trovata', code: 'NOT_FOUND' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Nessun file ricevuto', code: 'NO_FILE' });
        }

        const oldLogoPath = check.recordset[0].logo_url;
        if (oldLogoPath) {
            const oldFile = path.join(process.env.UPLOAD_DIR || './uploads', oldLogoPath);
            await fs.unlink(oldFile).catch(() => {});
        }

        const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
        const logoFileName = `org_${orgId}${ext}`;
        const logoFilePath = path.join(LOGO_DIR_ORG, logoFileName);
        await fs.rename(req.file.path, logoFilePath);

        const logoUrl = `org-logos/${logoFileName}`;

        await query(
            `UPDATE dbo.organizations SET logo_url = @logo_url WHERE organization_id = @organization_id`,
            { organization_id: orgId, logo_url: logoUrl }
        );

        logger.info(`[ORG] Logo aggiornato per organization_id=${orgId}`);
        res.json({ success: true, logo_url: logoUrl });
    } catch (error) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        logger.error('[ORG] uploadLogo error:', error);
        res.status(500).json({ error: 'Errore upload logo', code: 'SERVER_ERROR' });
    }
}

/**
 * GET /api/v1/organizations/me/logo
 * Solo membri dell'organizzazione (Bearer).
 */
async function getLogo(req, res) {
    try {
        const orgId = req.user.organization_id;
        const result = await query(
            `SELECT logo_url FROM dbo.organizations WHERE organization_id = @organization_id`,
            { organization_id: orgId }
        );
        if (result.recordset.length === 0 || !result.recordset[0].logo_url) {
            return res.status(404).json({ error: 'Logo non trovato', code: 'NOT_FOUND' });
        }
        const logoPath = path.join(process.env.UPLOAD_DIR || './uploads', result.recordset[0].logo_url);
        try {
            await fs.access(logoPath);
        } catch {
            return res.status(404).json({ error: 'File logo non trovato sul server', code: 'FILE_NOT_FOUND' });
        }
        res.sendFile(path.resolve(logoPath));
    } catch (error) {
        logger.error('[ORG] getLogo error:', error);
        res.status(500).json({ error: 'Errore recupero logo', code: 'SERVER_ERROR' });
    }
}

/**
 * DELETE /api/v1/organizations/me/logo
 */
async function deleteLogo(req, res) {
    try {
        if (!isOrgAdmin(req.user.role)) {
            return res.status(403).json({ error: 'Solo amministratori', code: 'FORBIDDEN' });
        }
        const orgId = req.user.organization_id;
        const check = await query(
            `SELECT logo_url FROM dbo.organizations WHERE organization_id = @organization_id`,
            { organization_id: orgId }
        );
        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Organizzazione non trovata', code: 'NOT_FOUND' });
        }
        const logoPathRel = check.recordset[0].logo_url;
        if (logoPathRel) {
            const fullPath = path.join(process.env.UPLOAD_DIR || './uploads', logoPathRel);
            await fs.unlink(fullPath).catch(() => {});
            await query(
                `UPDATE dbo.organizations SET logo_url = NULL WHERE organization_id = @organization_id`,
                { organization_id: orgId }
            );
        }
        res.json({ success: true });
    } catch (error) {
        logger.error('[ORG] deleteLogo error:', error);
        res.status(500).json({ error: 'Errore eliminazione logo', code: 'SERVER_ERROR' });
    }
}

module.exports = {
    getMyOrganization,
    patchMyOrganization,
    uploadLogo,
    getLogo,
    deleteLogo,
};
