/**
 * Company Controller - Fase 1 Multi-Tenant
 * CRUD aziende auditate (clienti degli auditor)
 * Isolamento: filtra per auditor_org_id dell'utente
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const documentTreeProvisioner = require('../services/documentTreeProvisioner.service');
const billingService = require('../services/billing.service');
const { hardDeleteCompany } = require('../services/companyMaintenance.service');
const {
    ensureCompanyAccessLoaded,
    hasCompanyAccessRows,
    getAllowedCompanyIds,
    assertCompanyAccess,
    assertCompanyWriteAccess,
    assertMutatingAllowed,
    sendAccessDenied,
} = require('../services/companyAccess.service');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const LOGO_DIR = path.join(process.env.UPLOAD_DIR || './uploads', 'logos');
if (!fsSync.existsSync(LOGO_DIR)) fsSync.mkdirSync(LOGO_DIR, { recursive: true });

/**
 * Risolve auditor_org_id da usare per il filtro
 * Superadmin (admin senza auditor_org_id): usa query param se fornito
 * Auditor: usa il proprio auditor_org_id
 */
function resolveAuditorOrgId(req) {
    const userOrgId = req.user.auditor_org_id;
    const isSuperadmin = req.user.role === 'admin' && !userOrgId;
    const queryOrgId = req.query.auditor_org_id ? parseInt(req.query.auditor_org_id, 10) : null;

    if (isSuperadmin && queryOrgId) return queryOrgId;
    return userOrgId;
}

/**
 * GET /api/v1/companies
 * Lista aziende dell'auditor_org dell'utente
 */
async function listCompanies(req, res) {
    try {
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const allowedIds = getAllowedCompanyIds(accessList);

        const { page = 1, limit = 50, search, is_active } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereConditions = [];
        const params = { limit: parseInt(limit), offset };

        if (allowedIds) {
            if (allowedIds.length === 0) {
                return res.json({
                    success: true,
                    data: [],
                    pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, totalPages: 0 },
                });
            }
            const idParams = allowedIds.map((id, i) => {
                const key = `allowed_id_${i}`;
                params[key] = id;
                return `@${key}`;
            });
            whereConditions.push(`id IN (${idParams.join(', ')})`);
        } else {
            const auditorOrgId = resolveAuditorOrgId(req);
            if (!auditorOrgId) {
                return res.status(403).json({
                    error: 'Specificare auditor_org_id (superadmin) o appartenere a un auditor_org',
                    code: 'AUDITOR_ORG_REQUIRED'
                });
            }
            whereConditions.push('auditor_org_id = @auditor_org_id');
            params.auditor_org_id = auditorOrgId;
        }

        if (search) {
            whereConditions.push('(name LIKE @search OR vat_number LIKE @search)');
            params.search = '%' + search + '%';
        }
        if (is_active !== undefined && is_active !== '') {
            whereConditions.push('is_active = @is_active');
            params.is_active = is_active === 'true' || is_active === '1';
        }

        const whereClause = whereConditions.join(' AND ');

        const result = await query(`
            SELECT id, auditor_org_id, name, vat_number, sector, address, logo_url, is_active, created_at, updated_at
            FROM companies
            WHERE ${whereClause}
            ORDER BY name
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `, params);

        const countResult = await query(`
            SELECT COUNT(*) AS total FROM companies WHERE ${whereClause}
        `, params);

        res.json({
            success: true,
            data: result.recordset,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.recordset[0].total,
                totalPages: Math.ceil(countResult.recordset[0].total / parseInt(limit))
            }
        });
    } catch (error) {
        logger.error('[COMPANIES] list error:', error);
        res.status(500).json({ error: 'Errore recupero aziende', code: 'SERVER_ERROR' });
    }
}

/**
 * GET /api/v1/companies/:id
 */
async function getCompanyById(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const accessList = await ensureCompanyAccessLoaded(req.user);

        if (hasCompanyAccessRows(accessList)) {
            const denied = await assertCompanyAccess(req.user, id, 'read');
            if (denied) return sendAccessDenied(res, denied);

            const result = await query(`
            SELECT id, auditor_org_id, name, vat_number, sector, address, logo_url, is_active, created_at, updated_at
            FROM companies
            WHERE id = @id
        `, { id });

            if (result.recordset.length === 0) {
                return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
            }

            return res.json({ success: true, data: result.recordset[0] });
        }

        const auditorOrgId = resolveAuditorOrgId(req);
        if (!auditorOrgId) {
            return res.status(403).json({ error: 'Auditor org richiesto', code: 'AUDITOR_ORG_REQUIRED' });
        }

        const result = await query(`
            SELECT id, auditor_org_id, name, vat_number, sector, address, logo_url, is_active, created_at, updated_at
            FROM companies
            WHERE id = @id AND auditor_org_id = @auditor_org_id
        `, { id, auditor_org_id: auditorOrgId });

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
        }

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('[COMPANIES] getById error:', error);
        res.status(500).json({ error: 'Errore recupero azienda', code: 'SERVER_ERROR' });
    }
}

/**
 * POST /api/v1/companies
 */
async function createCompany(req, res) {
    try {
        const accessList = await ensureCompanyAccessLoaded(req.user);
        if (hasCompanyAccessRows(accessList)) {
            return sendAccessDenied(res, {
                status: 403,
                body: { error: 'Permesso negato: sola lettura', code: 'AUTH_FORBIDDEN' },
            });
        }

        const auditorOrgId = req.body.auditor_org_id || req.user.auditor_org_id;
        if (!auditorOrgId) {
            return res.status(400).json({ error: 'auditor_org_id obbligatorio', code: 'MISSING_AUDITOR_ORG' });
        }

        const isSuperadmin = req.user.role === 'admin' && !req.user.auditor_org_id;
        if (!isSuperadmin && parseInt(auditorOrgId, 10) !== req.user.auditor_org_id) {
            return res.status(403).json({ error: 'Non puoi creare aziende per altri auditor_org', code: 'FORBIDDEN' });
        }

        const { name, vat_number, sector, address } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'name obbligatorio', code: 'MISSING_NAME' });
        }

        const result = await query(`
            INSERT INTO companies (auditor_org_id, name, vat_number, sector, address, is_active, updated_at)
            OUTPUT INSERTED.id, INSERTED.auditor_org_id, INSERTED.name, INSERTED.vat_number, INSERTED.sector, INSERTED.address, INSERTED.is_active, INSERTED.created_at, INSERTED.updated_at
            VALUES (@auditor_org_id, @name, @vat_number, @sector, @address, 1, GETDATE())
        `, {
            auditor_org_id: parseInt(auditorOrgId, 10),
            name: name.trim(),
            vat_number: vat_number?.trim() || null,
            sector: sector?.trim() || null,
            address: address?.trim() || null
        });

        const newCompany = result.recordset[0];
        const companyId = newCompany.id;
        const parsedAuditorOrgId = parseInt(auditorOrgId, 10);

        // Auto-provisioning albero documentale per la nuova azienda (idempotente)
        try {
            const orgRes = await query(
                `SELECT organization_id FROM auditor_orgs WHERE id = @auditor_org_id`,
                { auditor_org_id: parsedAuditorOrgId }
            );
            const organizationId = orgRes.recordset[0]?.organization_id || req.user.organization_id;

            if (organizationId) {
                const studioRootCheck = await query(
                    `SELECT TOP 1 id FROM document_registry
                     WHERE organization_id = @organization_id
                       AND company_id IS NULL
                       AND parent_id IS NULL
                       AND doc_type = 'folder'
                       AND ISNULL(status, 'rilasciato') <> 'obsoleto'`,
                    { organization_id: organizationId }
                );
                if (studioRootCheck.recordset.length > 0) {
                    logger.info('[COMPANIES] Skip tree provision: studio-wide tree already exists', {
                        company_id: companyId,
                        organization_id: organizationId,
                    });
                } else {
                    const rootCheck = await query(
                        `SELECT TOP 1 id FROM document_registry
                         WHERE organization_id = @organization_id
                           AND company_id = @company_id
                           AND parent_id IS NULL`,
                        { organization_id: organizationId, company_id: companyId }
                    );
                    if (rootCheck.recordset.length === 0) {
                        const stdRes = await query(
                            `SELECT standard_code FROM standards WHERE is_active = 1`
                        );
                        const standardCodes = (stdRes.recordset || []).map(r => r.standard_code);
                        await documentTreeProvisioner.provisionTree(
                            organizationId, companyId, null, standardCodes
                        );
                        logger.info('[COMPANIES] Auto-provisioned document tree', {
                            company_id: companyId,
                            organization_id: organizationId,
                        });
                    }
                }
            }
        } catch (provErr) {
            logger.warn('[COMPANIES] Tree auto-provision failed (non-blocking)', {
                company_id: companyId,
                error: provErr.message,
            });
        }

        try {
            const orgResBilling = await query(
                `SELECT organization_id FROM auditor_orgs WHERE id = @auditor_org_id`,
                { auditor_org_id: parsedAuditorOrgId }
            );
            await billingService.onCompanyCreated({
                companyId,
                auditorOrgId: parsedAuditorOrgId,
                organizationId: orgResBilling.recordset[0]?.organization_id || req.user.organization_id,
                createdBy: req.user.user_id,
            });
        } catch (billErr) {
            logger.warn('[COMPANIES] Billing hook on create failed (non-blocking)', {
                company_id: companyId,
                error: billErr.message,
            });
        }

        logger.info('[COMPANIES] Created:', companyId);
        res.status(201).json({ success: true, data: newCompany });
    } catch (error) {
        logger.error('[COMPANIES] create error:', error);
        res.status(500).json({ error: 'Errore creazione azienda', code: 'SERVER_ERROR' });
    }
}

/**
 * PUT /api/v1/companies/:id
 */
async function updateCompany(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const accessList = await ensureCompanyAccessLoaded(req.user);

        if (hasCompanyAccessRows(accessList)) {
            const writeDenied = await assertCompanyWriteAccess(req.user, id);
            if (writeDenied) return sendAccessDenied(res, writeDenied);

            const check = await query(`
            SELECT id, is_active FROM companies WHERE id = @id
        `, { id });

            if (check.recordset.length === 0) {
                return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
            }

            const previousIsActive = check.recordset[0].is_active;
            const { name, vat_number, sector, address, is_active } = req.body;

            const updates = [];
            const params = { id };
            if (name !== undefined) { updates.push('name = @name'); params.name = name.trim(); }
            if (vat_number !== undefined) { updates.push('vat_number = @vat_number'); params.vat_number = vat_number?.trim() || null; }
            if (sector !== undefined) { updates.push('sector = @sector'); params.sector = sector?.trim() || null; }
            if (address !== undefined) { updates.push('address = @address'); params.address = address?.trim() || null; }
            if (is_active !== undefined) {
                return res.status(403).json({
                    error: 'Non puoi modificare lo stato attivo dell\'azienda',
                    code: 'AUTH_FORBIDDEN',
                });
            }

            if (updates.length === 0) {
                const current = await query('SELECT * FROM companies WHERE id = @id', { id });
                return res.json({ success: true, data: current.recordset[0] });
            }

            updates.push('updated_at = GETDATE()');
            await query(`
            UPDATE companies SET ${updates.join(', ')}
            WHERE id = @id
        `, params);

            const updated = await query(`
            SELECT id, auditor_org_id, name, vat_number, sector, address, logo_url, is_active, created_at, updated_at
            FROM companies WHERE id = @id
        `, { id });

            return res.json({ success: true, data: updated.recordset[0] });
        }

        const auditorOrgId = resolveAuditorOrgId(req);
        if (!auditorOrgId) {
            return res.status(403).json({ error: 'Auditor org richiesto', code: 'AUDITOR_ORG_REQUIRED' });
        }

        const { name, vat_number, sector, address, is_active } = req.body;

        const check = await query(`
            SELECT id, is_active FROM companies WHERE id = @id AND auditor_org_id = @auditor_org_id
        `, { id, auditor_org_id: auditorOrgId });

        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
        }

        const previousIsActive = check.recordset[0].is_active;

        const updates = [];
        const params = { id, auditor_org_id: auditorOrgId };
        if (name !== undefined) { updates.push('name = @name'); params.name = name.trim(); }
        if (vat_number !== undefined) { updates.push('vat_number = @vat_number'); params.vat_number = vat_number?.trim() || null; }
        if (sector !== undefined) { updates.push('sector = @sector'); params.sector = sector?.trim() || null; }
        if (address !== undefined) { updates.push('address = @address'); params.address = address?.trim() || null; }
        if (is_active !== undefined) { updates.push('is_active = @is_active'); params.is_active = is_active === true || is_active === 1; }

        if (updates.length === 0) {
            const current = await query('SELECT * FROM companies WHERE id = @id', { id });
            return res.json({ success: true, data: current.recordset[0] });
        }

        updates.push('updated_at = GETDATE()');
        await query(`
            UPDATE companies SET ${updates.join(', ')}
            WHERE id = @id AND auditor_org_id = @auditor_org_id
        `, params);

        const updated = await query(`
            SELECT id, auditor_org_id, name, vat_number, sector, address, logo_url, is_active, created_at, updated_at
            FROM companies WHERE id = @id
        `, { id });

        if (is_active !== undefined) {
            const newActive = is_active === true || is_active === 1;
            const prevActive = previousIsActive === true || previousIsActive === 1;
            if (newActive !== prevActive) {
                try {
                    const orgRes = await query(
                        `SELECT organization_id FROM auditor_orgs WHERE id = @auditor_org_id`,
                        { auditor_org_id: auditorOrgId }
                    );
                    await billingService.syncCompanyActiveStatus({
                        companyId: id,
                        auditorOrgId,
                        organizationId: orgRes.recordset[0]?.organization_id,
                        isActive: newActive,
                        updatedBy: req.user.user_id,
                    });
                } catch (billErr) {
                    logger.warn('[COMPANIES] Billing hook on is_active failed (non-blocking)', {
                        company_id: id,
                        error: billErr.message,
                    });
                }
            }
        }

        res.json({ success: true, data: updated.recordset[0] });
    } catch (error) {
        logger.error('[COMPANIES] update error:', error);
        res.status(500).json({ error: 'Errore aggiornamento azienda', code: 'SERVER_ERROR' });
    }
}

/**
 * DELETE /api/v1/companies/:id
 */
async function deleteCompany(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const accessList = await ensureCompanyAccessLoaded(req.user);

        if (hasCompanyAccessRows(accessList)) {
            const writeDenied = await assertCompanyWriteAccess(req.user, id);
            if (writeDenied) return sendAccessDenied(res, writeDenied);
        }

        const auditorOrgId = resolveAuditorOrgId(req);
        if (!auditorOrgId) {
            return res.status(403).json({ error: 'Auditor org richiesto', code: 'AUDITOR_ORG_REQUIRED' });
        }

        const ok = await hardDeleteCompany(id, auditorOrgId);
        if (!ok) {
            return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
        }

        res.json({ success: true, deleted_id: id });
    } catch (error) {
        logger.error('[COMPANIES] delete error:', error);
        res.status(500).json({ error: 'Errore eliminazione azienda', code: 'SERVER_ERROR' });
    }
}

/**
 * POST /api/v1/companies/:id/logo
 * Carica o aggiorna il logo aziendale
 */
async function uploadLogo(req, res) {
    try {
        const auditorOrgId = resolveAuditorOrgId(req);
        if (!auditorOrgId) {
            return res.status(403).json({ error: 'Auditor org richiesto', code: 'AUDITOR_ORG_REQUIRED' });
        }

        const id = parseInt(req.params.id, 10);

        // Verifica ownership
        const check = await query(
            `SELECT id, logo_url FROM companies WHERE id = @id AND auditor_org_id = @auditor_org_id`,
            { id, auditor_org_id: auditorOrgId }
        );
        if (check.recordset.length === 0) {
            if (req.file) await fs.unlink(req.file.path).catch(() => {});
            return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Nessun file ricevuto', code: 'NO_FILE' });
        }

        // Elimina vecchio logo se esiste
        const oldLogoPath = check.recordset[0].logo_url;
        if (oldLogoPath) {
            const oldFile = path.join(process.env.UPLOAD_DIR || './uploads', oldLogoPath);
            await fs.unlink(oldFile).catch(() => {});
        }

        // Sposta il file nella cartella logos con nome standard: logo_<id>.<ext>
        const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
        const logoFileName = `logo_${id}${ext}`;
        const logoFilePath = path.join(LOGO_DIR, logoFileName);
        await fs.rename(req.file.path, logoFilePath);

        const logoUrl = `logos/${logoFileName}`;

        await query(
            `UPDATE companies SET logo_url = @logo_url, updated_at = GETDATE() WHERE id = @id`,
            { id, logo_url: logoUrl }
        );

        logger.info(`[COMPANIES] Logo aggiornato per company ${id}: ${logoUrl}`);
        res.json({ success: true, logo_url: logoUrl });
    } catch (error) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        logger.error('[COMPANIES] uploadLogo error:', error);
        res.status(500).json({ error: 'Errore upload logo', code: 'SERVER_ERROR' });
    }
}

/**
 * GET /api/v1/companies/:id/logo
 * Serve il logo aziendale come immagine
 */
async function getLogo(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const result = await query(
            `SELECT logo_url FROM companies WHERE id = @id`,
            { id }
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
        logger.error('[COMPANIES] getLogo error:', error);
        res.status(500).json({ error: 'Errore recupero logo', code: 'SERVER_ERROR' });
    }
}

/**
 * DELETE /api/v1/companies/:id/logo
 * Rimuove il logo aziendale
 */
async function deleteLogo(req, res) {
    try {
        const auditorOrgId = resolveAuditorOrgId(req);
        if (!auditorOrgId) {
            return res.status(403).json({ error: 'Auditor org richiesto', code: 'AUDITOR_ORG_REQUIRED' });
        }

        const id = parseInt(req.params.id, 10);
        const check = await query(
            `SELECT id, logo_url FROM companies WHERE id = @id AND auditor_org_id = @auditor_org_id`,
            { id, auditor_org_id: auditorOrgId }
        );

        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
        }

        const logoPath = check.recordset[0].logo_url;
        if (logoPath) {
            const fullPath = path.join(process.env.UPLOAD_DIR || './uploads', logoPath);
            await fs.unlink(fullPath).catch(() => {});
            await query(
                `UPDATE companies SET logo_url = NULL, updated_at = GETDATE() WHERE id = @id`,
                { id }
            );
        }

        res.json({ success: true });
    } catch (error) {
        logger.error('[COMPANIES] deleteLogo error:', error);
        res.status(500).json({ error: 'Errore eliminazione logo', code: 'SERVER_ERROR' });
    }
}

module.exports = {
    listCompanies,
    getCompanyById,
    createCompany,
    updateCompany,
    deleteCompany,
    uploadLogo,
    getLogo,
    deleteLogo
};
