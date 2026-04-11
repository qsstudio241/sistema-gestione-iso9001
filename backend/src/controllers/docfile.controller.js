/**
 * docfile.controller.js — Gestione file allegati ai documenti del registro
 * Sprint 2B
 *
 * Flusso:
 *   GET  /documents/:docId/files           → lista versioni (più recente prima)
 *   POST /documents/:docId/file            → upload nuova versione
 *   GET  /documents/:docId/file/download   → download versione corrente (inline per PDF)
 *   GET  /documents/:docId/file/:attId/download → download versione specifica
 *
 * Note schema attachments:
 *   PK  = attachment_id  (NON id)
 *   col = storage_path   (NON file_path)
 *   FK  = uploaded_by → users.user_id
 *   usr = users.full_name (NON name)
 */

const { getPool } = require('../config/database');
const logger      = require('../utils/logger');
const path        = require('path');
const fs          = require('fs');

// ─── helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
    if (!bytes) return null;
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function getDocumentOrFail(pool, docId, orgId) {
    const r = await pool.request()
        .input('docId', docId)
        .input('orgId', orgId)
        .query('SELECT id, title, revision, status FROM document_registry WHERE id=@docId AND organization_id=@orgId');
    if (!r.recordset.length) return null;
    return r.recordset[0];
}

// ─── GET /documents/:docId/files ────────────────────────────────────────────

async function listDocFiles(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const docId = parseInt(req.params.docId);

        const doc = await getDocumentOrFail(pool, docId, orgId);
        if (!doc) return res.status(404).json({ error: 'Documento non trovato.' });

        const r = await pool.request()
            .input('docId', docId)
            .query(`
                SELECT a.attachment_id AS id,
                       a.file_name,
                       a.storage_path,
                       a.file_size,
                       a.mime_type,
                       a.doc_file_version,
                       a.is_current_doc_version,
                       a.created_at,
                       u.full_name AS uploaded_by_name
                FROM attachments a
                LEFT JOIN users u ON u.user_id = a.uploaded_by
                WHERE a.document_id = @docId
                ORDER BY a.created_at DESC
            `);

        const files = r.recordset.map(f => ({
            id:               f.id,
            file_name:        f.file_name,
            file_size:        f.file_size,
            file_size_label:  formatBytes(f.file_size),
            mime_type:        f.mime_type,
            version:          f.doc_file_version,
            is_current:       !!f.is_current_doc_version,
            uploaded_at:      f.created_at,
            uploaded_by:      f.uploaded_by_name,
        }));

        res.json({ document: doc, files });
    } catch (err) {
        logger.error('listDocFiles:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ─── POST /documents/:docId/file ────────────────────────────────────────────

async function uploadDocFile(req, res) {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nessun file ricevuto.' });

        const pool    = await getPool();
        const orgId   = req.user.organization_id;
        const userId  = req.user.user_id;
        const docId   = parseInt(req.params.docId);
        const version = (req.body.version || '').trim() || null;

        const doc = await getDocumentOrFail(pool, docId, orgId);
        if (!doc) {
            fs.unlink(req.file.path, () => {});
            return res.status(404).json({ error: 'Documento non trovato.' });
        }

        // Marca le versioni precedenti come non correnti
        await pool.request()
            .input('docId', docId)
            .query(`UPDATE attachments SET is_current_doc_version = 0 WHERE document_id = @docId`);

        // Inserisci il nuovo allegato
        const insertResult = await pool.request()
            .input('docId',    docId)
            .input('userId',   userId)
            .input('fileName', req.file.originalname)
            .input('storagePath', req.file.path)
            .input('fileSize', req.file.size)
            .input('fileType', path.extname(req.file.originalname).toLowerCase())
            .input('mimeType', req.file.mimetype || null)
            .input('version',  version)
            .query(`
                INSERT INTO attachments
                    (document_id, uploaded_by,
                     file_name, file_type, storage_path, file_size, mime_type,
                     doc_file_version, is_current_doc_version,
                     category, created_at)
                OUTPUT INSERTED.attachment_id AS id
                VALUES
                    (@docId, @userId,
                     @fileName, @fileType, @storagePath, @fileSize, @mimeType,
                     @version, 1,
                     'document', GETDATE())
            `);

        const newId = insertResult.recordset[0].id;
        logger.info(`[DocFile] Upload doc ${docId} → attachment ${newId} (${req.file.originalname})`);

        res.status(201).json({
            success:  true,
            id:       newId,
            file_name: req.file.originalname,
            file_size: req.file.size,
            file_size_label: formatBytes(req.file.size),
            version,
            message:  'File caricato con successo.',
        });
    } catch (err) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        logger.error('uploadDocFile:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ─── GET /documents/:docId/file/download  (versione corrente) ───────────────
// ─── GET /documents/:docId/file/:attId/download  (versione specifica) ───────

async function downloadDocFile(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const docId = parseInt(req.params.docId);
        const attId = req.params.attId ? parseInt(req.params.attId) : null;

        const doc = await getDocumentOrFail(pool, docId, orgId);
        if (!doc) return res.status(404).json({ error: 'Documento non trovato.' });

        const req2 = pool.request().input('docId', docId);
        let sql;
        if (attId) {
            req2.input('attId', attId);
            sql = `SELECT attachment_id AS id, file_name, storage_path, mime_type
                   FROM attachments
                   WHERE document_id=@docId AND attachment_id=@attId`;
        } else {
            sql = `SELECT TOP 1 attachment_id AS id, file_name, storage_path, mime_type
                   FROM attachments
                   WHERE document_id=@docId AND is_current_doc_version=1
                   ORDER BY created_at DESC`;
        }

        const r = await req2.query(sql);
        if (!r.recordset.length) return res.status(404).json({ error: 'Nessun file allegato per questo documento.' });

        const att = r.recordset[0];
        if (!fs.existsSync(att.storage_path)) {
            return res.status(410).json({ error: 'File non trovato sul server. Potrebbe essere stato spostato.' });
        }

        const inline = req.query.inline === '1' && att.mime_type === 'application/pdf';
        const disposition = inline
            ? `inline; filename="${encodeURIComponent(att.file_name)}"`
            : `attachment; filename="${encodeURIComponent(att.file_name)}"`;

        res.setHeader('Content-Disposition', disposition);
        if (att.mime_type) res.setHeader('Content-Type', att.mime_type);
        res.sendFile(path.resolve(att.storage_path));
    } catch (err) {
        logger.error('downloadDocFile:', err.message);
        res.status(500).json({ error: err.message });
    }
}

module.exports = { listDocFiles, uploadDocFile, downloadDocFile };
