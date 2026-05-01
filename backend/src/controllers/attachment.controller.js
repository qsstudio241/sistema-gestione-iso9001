/**
 * Attachment Controller
 * Gestisce upload, download ed eliminazione allegati per audit e NC
 * 
 * Storage: filesystem con path in database
 * Categorie: evidence, photo, audio, video, document
 * Max size: 10MB per file
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { assertWriteAllowed, getLockTokenFromRequest } = require('../services/auditLock.service');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

/**
 * GET /api/v1/attachments
 * Lista allegati con filtri
 * 
 * Query params:
 * - audit_id: filter by audit
 * - nc_id: filter by NC
 * - category: filter by category (evidence, photo, audio, video, document)
 * - page: pagination (default 1)
 * - limit: items per page (default 50)
 */
async function listAttachments(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            audit_id,
            nc_id,
            question_id,
            category,
            page = 1,
            limit = 50
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build WHERE clause dinamicamente
        let whereConditions = [];
        let params = { organization_id, limit: parseInt(limit), offset };

        // Filtra per organization_id via audit o NC
        if (audit_id) {
            // Supporta sia audit_id INT che audit_uuid (UUID)
            const numericAuditId = parseInt(audit_id);
            if (!isNaN(numericAuditId)) {
                whereConditions.push('att.audit_id = @audit_id');
                params.audit_id = numericAuditId;
            } else {
                // UUID: join su audits per risolvere a audit_id INT
                whereConditions.push('a.audit_uuid = @audit_uuid');
                params.audit_uuid = audit_id;
            }
            whereConditions.push('a.organization_id = @organization_id');
        } else if (nc_id) {
            whereConditions.push('att.nc_id = @nc_id');
            whereConditions.push('a.organization_id = @organization_id');
            params.nc_id = parseInt(nc_id);
        } else {
            // Lista generale per organizzazione
            whereConditions.push('a.organization_id = @organization_id');
        }

        if (question_id) {
            whereConditions.push('att.question_id = @question_id');
            params.question_id = parseInt(question_id);
        }

        if (req.query.custom_item_id) {
            whereConditions.push('att.custom_item_id = @custom_item_id');
            params.custom_item_id = parseInt(req.query.custom_item_id);
        }

        if (category) {
            whereConditions.push('att.category = @category');
            params.category = category;
        }

        const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '1=1';

        // Query principale
        const result = await query(`
      SELECT 
        att.*,
        u.full_name AS uploaded_by_name,
        a.audit_number,
        nc.nc_number
      FROM attachments att
      LEFT JOIN audits a ON att.audit_id = a.audit_id
      LEFT JOIN non_conformities nc ON att.nc_id = nc.nc_id
      LEFT JOIN users u ON att.uploaded_by = u.user_id
      WHERE ${whereClause}
      ORDER BY att.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `, params);

        // Count totale
        const countResult = await query(`
      SELECT COUNT(*) AS total
      FROM attachments att
      LEFT JOIN audits a ON att.audit_id = a.audit_id
      LEFT JOIN non_conformities nc ON att.nc_id = nc.nc_id
      WHERE ${whereClause}
    `, params);

        const total = countResult.recordset[0].total;

        logger.info('Attachments list retrieved', {
            organization_id,
            count: result.recordset.length,
            filters: { audit_id, nc_id, category }
        });

        res.json({
            success: true,
            data: result.recordset,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        logger.error('Error listing attachments', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante il recupero degli allegati',
            code: 'ATTACHMENT_LIST_ERROR'
        });
    }
}

/**
 * GET /api/v1/attachments/:id
 * Dettagli singolo allegato
 */
async function getAttachmentById(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const result = await query(`
      SELECT 
        att.*,
        u.full_name AS uploaded_by_name,
        u.email AS uploaded_by_email,
        a.audit_number,
        nc.nc_number
      FROM attachments att
      LEFT JOIN audits a ON att.audit_id = a.audit_id
      LEFT JOIN non_conformities nc ON att.nc_id = nc.nc_id
      LEFT JOIN users u ON att.uploaded_by = u.user_id
      WHERE att.attachment_id = @id 
        AND (
          (a.organization_id = @organization_id) OR
          (nc.nc_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM audits a2 
            WHERE a2.audit_id = nc.audit_id AND a2.organization_id = @organization_id
          ))
        )
    `, { id: parseInt(id), organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Allegato non trovato',
                code: 'ATTACHMENT_NOT_FOUND'
            });
        }

        logger.info('Attachment retrieved', { attachment_id: id, organization_id });

        res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (error) {
        logger.error('Error getting attachment', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante il recupero dell\'allegato',
            code: 'ATTACHMENT_GET_ERROR'
        });
    }
}

/**
 * POST /api/v1/attachments/upload
 * Upload file allegato
 * 
 * Multipart form-data:
 * - file: file da caricare (REQUIRED, max 10MB)
 * - audit_id: ID audit (REQUIRED se no nc_id)
 * - nc_id: ID NC (REQUIRED se no audit_id)
 * - category: evidence|photo|audio|video|document (default: evidence)
 * - description: descrizione opzionale
 * 
 * Nota: Questo endpoint richiede multer middleware configurato nella route
 */
async function uploadAttachment(req, res) {
    try {
        const { user_id, organization_id } = req.user;
        const { audit_id, nc_id, question_id, custom_item_id, category = 'evidence', description } = req.body;

        // Validazione: deve avere file
        if (!req.file) {
            logger.warn('Upload: nessun file ricevuto', { user_id, organization_id, body: req.body });
            return res.status(400).json({
                error: 'Nessun file caricato',
                code: 'VALIDATION_ERROR'
            });
        }

        // Validazione: deve avere audit_id o nc_id (ma non entrambi)
        if ((!audit_id && !nc_id) || (audit_id && nc_id)) {
            // Cleanup file uploaded
            await fs.unlink(req.file.path).catch(() => { });
            logger.warn('Upload: audit_id/nc_id mancante o duplicato', { audit_id, nc_id, user_id, organization_id });
            return res.status(400).json({
                error: 'Specificare audit_id O nc_id (non entrambi)',
                code: 'VALIDATION_ERROR'
            });
        }

        // Validazione category
        const validCategories = ['evidence', 'photo', 'audio', 'video', 'document'];
        if (!validCategories.includes(category)) {
            // Cleanup file uploaded
            await fs.unlink(req.file.path).catch(() => { });
            logger.warn('Upload: categoria non valida', { category, validCategories, user_id, organization_id });
            return res.status(400).json({
                error: 'Categoria non valida',
                code: 'VALIDATION_ERROR',
                allowed: validCategories
            });
        }

        // Validazione: question_id e custom_item_id mutualmente esclusivi
        if (question_id && custom_item_id) {
            await fs.unlink(req.file.path).catch(() => { });
            return res.status(400).json({
                error: 'Specificare question_id O custom_item_id (non entrambi)',
                code: 'VALIDATION_ERROR'
            });
        }

        // Verifica ownership audit o NC
        if (audit_id) {
            // Supporta sia audit_id INT che audit_uuid (UUID)
            const numericAuditId = parseInt(audit_id);
            let resolvedAuditId;
            let auditCustomChecklistId = null;

            if (!isNaN(numericAuditId)) {
                const auditCheck = await query(`
        SELECT audit_id, custom_checklist_id FROM audits
        WHERE audit_id = @audit_id AND organization_id = @organization_id AND is_deleted = 0
      `, { audit_id: numericAuditId, organization_id });
                if (auditCheck.recordset.length === 0) {
                    await fs.unlink(req.file.path).catch(() => { });
                    logger.warn('Upload: audit non trovato (INT)', { audit_id: numericAuditId, organization_id });
                    return res.status(404).json({ error: 'Audit non trovato', code: 'AUDIT_NOT_FOUND' });
                }
                resolvedAuditId = numericAuditId;
                auditCustomChecklistId = auditCheck.recordset[0].custom_checklist_id;
            } else {
                // UUID: risolvi a numeric audit_id
                const auditCheck = await query(`
        SELECT audit_id, custom_checklist_id FROM audits
        WHERE audit_uuid = @audit_uuid AND organization_id = @organization_id AND is_deleted = 0
      `, { audit_uuid: audit_id, organization_id });
                if (auditCheck.recordset.length === 0) {
                    await fs.unlink(req.file.path).catch(() => { });
                    logger.warn('Upload: audit non trovato (UUID)', { audit_uuid: audit_id, organization_id });
                    return res.status(404).json({ error: 'Audit non trovato', code: 'AUDIT_NOT_FOUND' });
                }
                resolvedAuditId = auditCheck.recordset[0].audit_id;
                auditCustomChecklistId = auditCheck.recordset[0].custom_checklist_id;
            }
            // Sostituisci audit_id con il valore numerico risolto (usato nell'INSERT)
            req.body.audit_id = resolvedAuditId;

            // Lock check rimosso (T5): il lock è solo UX informativo, non blocca scrittura.

            // Se custom_item_id: verifica che l'audit abbia checklist custom e che l'item appartenga a quella checklist
            if (custom_item_id) {
                if (!auditCustomChecklistId) {
                    await fs.unlink(req.file.path).catch(() => { });
                    return res.status(400).json({
                        error: 'custom_item_id richiede un audit con checklist personalizzata',
                        code: 'VALIDATION_ERROR'
                    });
                }
                const itemCheck = await query(`
          SELECT 1 FROM custom_checklist_items cci
          INNER JOIN custom_checklist_sections ccs ON cci.section_id = ccs.id
          WHERE cci.id = @custom_item_id AND ccs.custom_checklist_id = @custom_checklist_id
        `, { custom_item_id: parseInt(custom_item_id), custom_checklist_id: auditCustomChecklistId });
                if (itemCheck.recordset.length === 0) {
                    await fs.unlink(req.file.path).catch(() => { });
                    return res.status(400).json({
                        error: 'custom_item_id non valido per questa checklist',
                        code: 'VALIDATION_ERROR'
                    });
                }
            }
        }

        if (nc_id) {
            const ncCheck = await query(`
        SELECT nc.nc_id
        FROM non_conformities nc
        INNER JOIN audits a ON nc.audit_id = a.audit_id
        WHERE nc.nc_id = @nc_id AND a.organization_id = @organization_id
      `, { nc_id: parseInt(nc_id), organization_id });

            if (ncCheck.recordset.length === 0) {
                // Cleanup file uploaded
                await fs.unlink(req.file.path).catch(() => { });

                return res.status(404).json({
                    error: 'Non conformità non trovata',
                    code: 'NC_NOT_FOUND'
                });
            }
        }

        // Salva metadati in DB
        const result = await query(`
      INSERT INTO attachments (
        audit_id,
        nc_id,
        question_id,
        custom_item_id,
        file_name,
        file_type,
        file_size,
        mime_type,
        storage_path,
        category,
        description,
        uploaded_by,
        created_at
      )
      OUTPUT INSERTED.attachment_id, INSERTED.attachment_uuid
      VALUES (
        @audit_id,
        @nc_id,
        @question_id,
        @custom_item_id,
        @file_name,
        @file_type,
        @file_size,
        @mime_type,
        @storage_path,
        @category,
        @description,
        @user_id,
        GETDATE()
      )
    `, {
            audit_id: req.body.audit_id ? parseInt(req.body.audit_id) : null,
            nc_id: nc_id ? parseInt(nc_id) : null,
            question_id: question_id ? parseInt(question_id) : null,
            custom_item_id: custom_item_id ? parseInt(custom_item_id) : null,
            file_name: req.file.originalname,
            file_type: path.extname(req.file.originalname).toLowerCase(),
            file_size: req.file.size,
            mime_type: req.file.mimetype,
            storage_path: req.file.path,
            category,
            description: description || null,
            user_id
        });

        const newAttachment = result.recordset[0];

        logger.info('Attachment uploaded', {
            attachment_id: newAttachment.attachment_id,
            audit_id,
            nc_id,
            organization_id,
            file_name: req.file.originalname,
            file_size: req.file.size
        });

        res.status(201).json({
            success: true,
            data: {
                attachment_id: newAttachment.attachment_id,
                attachment_uuid: newAttachment.attachment_uuid,
                file_name: req.file.originalname,
                file_size: req.file.size,
                category
            }
        });

    } catch (error) {
        // Cleanup file in caso di errore DB
        if (req.file) {
            await fs.unlink(req.file.path).catch(() => { });
        }

        logger.error('Error uploading attachment', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante l\'upload dell\'allegato',
            code: 'ATTACHMENT_UPLOAD_ERROR'
        });
    }
}

/**
 * GET /api/v1/attachments/:id/download
 * Download file allegato
 */
async function downloadAttachment(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        // Recupera metadati con verifica ownership
        const result = await query(`
      SELECT 
        att.*,
        a.organization_id AS audit_org_id
      FROM attachments att
      LEFT JOIN audits a ON att.audit_id = a.audit_id
      LEFT JOIN non_conformities nc ON att.nc_id = nc.nc_id
      LEFT JOIN audits a2 ON nc.audit_id = a2.audit_id
      WHERE att.attachment_id = @id 
        AND (
          a.organization_id = @organization_id OR
          a2.organization_id = @organization_id
        )
    `, { id: parseInt(id), organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Allegato non trovato',
                code: 'ATTACHMENT_NOT_FOUND'
            });
        }

        const attachment = result.recordset[0];

        // Verifica esistenza file fisico
        if (!fsSync.existsSync(attachment.storage_path)) {
            logger.error('Attachment file not found on disk', {
                attachment_id: id,
                storage_path: attachment.storage_path
            });

            return res.status(404).json({
                error: 'File non trovato sul server',
                code: 'FILE_NOT_FOUND_ON_DISK'
            });
        }

        // Download file
        res.setHeader('Content-Type', attachment.mime_type);
        res.setHeader('Content-Disposition', `attachment; filename="${attachment.file_name}"`);
        res.setHeader('Content-Length', attachment.file_size);

        const fileStream = fsSync.createReadStream(attachment.storage_path);
        fileStream.pipe(res);

        logger.info('Attachment downloaded', { attachment_id: id, organization_id });

    } catch (error) {
        logger.error('Error downloading attachment', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante il download dell\'allegato',
            code: 'ATTACHMENT_DOWNLOAD_ERROR'
        });
    }
}

/**
 * DELETE /api/v1/attachments/:id
 * Elimina allegato (DB + filesystem)
 */
async function deleteAttachment(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        // Recupera metadati con verifica ownership
        const result = await query(`
      SELECT 
        att.*,
        a.organization_id AS audit_org_id
      FROM attachments att
      LEFT JOIN audits a ON att.audit_id = a.audit_id
      LEFT JOIN non_conformities nc ON att.nc_id = nc.nc_id
      LEFT JOIN audits a2 ON nc.audit_id = a2.audit_id
      WHERE att.attachment_id = @id 
        AND (
          a.organization_id = @organization_id OR
          a2.organization_id = @organization_id
        )
    `, { id: parseInt(id), organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Allegato non trovato',
                code: 'ATTACHMENT_NOT_FOUND'
            });
        }

        const attachment = result.recordset[0];

        // Delete da DB
        await query(`
      DELETE FROM attachments WHERE attachment_id = @id
    `, { id: parseInt(id) });

        // Delete file fisico (best effort - non bloccare se fallisce)
        try {
            if (fsSync.existsSync(attachment.storage_path)) {
                await fs.unlink(attachment.storage_path);
            }
        } catch (fsError) {
            logger.warn('Failed to delete file from disk', {
                attachment_id: id,
                storage_path: attachment.storage_path,
                error: fsError.message
            });
        }

        logger.info('Attachment deleted', { attachment_id: id, organization_id });

        res.json({
            success: true,
            message: 'Allegato eliminato con successo'
        });

    } catch (error) {
        logger.error('Error deleting attachment', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante l\'eliminazione dell\'allegato',
            code: 'ATTACHMENT_DELETE_ERROR'
        });
    }
}

/**
 * GET /api/v1/attachments/:id/view
 * Visualizzazione inline nel browser (immagini + PDF)
 * Per altri tipi forza il download (fallback identico a downloadAttachment)
 *
 * Differenza da /download:
 * - immagini e PDF → Content-Disposition: inline (apre nel browser)
 * - altri tipi     → Content-Disposition: attachment (forza download)
 */
async function viewAttachment(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const result = await query(`
      SELECT 
        att.*,
        a.organization_id AS audit_org_id
      FROM attachments att
      LEFT JOIN audits a ON att.audit_id = a.audit_id
      LEFT JOIN non_conformities nc ON att.nc_id = nc.nc_id
      LEFT JOIN audits a2 ON nc.audit_id = a2.audit_id
      WHERE att.attachment_id = @id 
        AND (
          a.organization_id = @organization_id OR
          a2.organization_id = @organization_id
        )
    `, { id: parseInt(id), organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Allegato non trovato',
                code: 'ATTACHMENT_NOT_FOUND'
            });
        }

        const attachment = result.recordset[0];

        if (!fsSync.existsSync(attachment.storage_path)) {
            logger.error('View: file fisico mancante', {
                attachment_id: id,
                storage_path: attachment.storage_path
            });
            return res.status(404).json({
                error: 'File non trovato sul server',
                code: 'FILE_NOT_FOUND_ON_DISK'
            });
        }

        // Tipi che il browser può mostrare inline
        const INLINE_TYPES = new Set([
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'image/heic', 'image/heif',
            'application/pdf'
        ]);

        const disposition = INLINE_TYPES.has(attachment.mime_type)
            ? 'inline'
            : 'attachment';

        res.setHeader('Content-Type', attachment.mime_type);
        res.setHeader('Content-Disposition', `${disposition}; filename="${attachment.file_name}"`);
        res.setHeader('Content-Length', attachment.file_size);
        // Cache 1h: file immutabili (mai sovrascritti, solo cancellati)
        res.setHeader('Cache-Control', 'private, max-age=3600');

        const fileStream = fsSync.createReadStream(attachment.storage_path);
        fileStream.on('error', (streamErr) => {
            logger.error('View: stream error', { error: streamErr.message });
            if (!res.headersSent) {
                res.status(500).json({ error: 'Errore lettura file' });
            }
        });
        fileStream.pipe(res);

        logger.info('Attachment viewed', { attachment_id: id, disposition, organization_id });

    } catch (error) {
        logger.error('Error viewing attachment', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante la visualizzazione dell\'allegato',
            code: 'ATTACHMENT_VIEW_ERROR'
        });
    }
}

/**
 * PUT /api/v1/attachments/:id/replace
 * Sostituisce il file fisico di un allegato esistente.
 * Usato per modifiche da browser desktop (Word/Excel/immagini).
 * Elimina il vecchio file dal disco, aggiorna i metadati in DB.
 */
async function replaceAttachment(req, res) {
    const { id: attachment_id } = req.params;
    const { organization_id } = req.user;

    if (!req.file) {
        return res.status(400).json({ error: 'Nessun file caricato', code: 'VALIDATION_ERROR' });
    }

    try {
        // 1. Verifica ownership: allegato appartiene a un audit di questa org
        const existing = await query(`
            SELECT att.attachment_id, att.storage_path, att.file_name
            FROM attachments att
            LEFT JOIN audits a ON att.audit_id = a.audit_id
            WHERE att.attachment_id = @attachment_id
              AND a.organization_id = @organization_id
        `, { attachment_id: parseInt(attachment_id), organization_id });

        if (!existing.recordset?.length) {
            await fs.unlink(req.file.path).catch(() => { });
            return res.status(404).json({ error: 'Allegato non trovato', code: 'NOT_FOUND' });
        }

        const old = existing.recordset[0];

        // 2. Elimina vecchio file dal disco (soft failure: non blocca se già rimosso)
        await fs.unlink(old.storage_path).catch(err =>
            logger.warn('[REPLACE] Impossibile eliminare vecchio file:', { path: old.storage_path, error: err.message })
        );

        // 3. Aggiorna DB con nuovi metadati file
        await query(`
            UPDATE attachments
            SET file_name     = @file_name,
                file_type     = @file_type,
                file_size     = @file_size,
                mime_type     = @mime_type,
                storage_path  = @storage_path
            WHERE attachment_id = @attachment_id
        `, {
            attachment_id: parseInt(attachment_id),
            file_name: req.file.originalname,
            file_type: path.extname(req.file.originalname).toLowerCase(),
            file_size: req.file.size,
            mime_type: req.file.mimetype,
            storage_path: req.file.path,
        });

        logger.info('[REPLACE] Allegato sostituito', {
            attachment_id,
            old_file: old.file_name,
            new_file: req.file.originalname,
            organization_id
        });

        return res.json({
            success: true,
            data: {
                attachment_id: parseInt(attachment_id),
                file_name: req.file.originalname,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
            }
        });

    } catch (error) {
        // Cleanup file appena caricato in caso di errore DB
        await fs.unlink(req.file.path).catch(() => { });
        logger.error('[REPLACE] Errore:', error);
        return res.status(500).json({ error: 'Errore server', code: 'SERVER_ERROR' });
    }
}

module.exports = {
    listAttachments,
    getAttachmentById,
    uploadAttachment,
    downloadAttachment,
    viewAttachment,
    deleteAttachment,
    replaceAttachment
};
