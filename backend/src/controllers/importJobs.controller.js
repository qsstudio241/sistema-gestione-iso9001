/**
 * importJobs.controller.js — Sprint 9: pipeline import PDF batch (testo locale, revisione umana)
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { confidenceFromTextLength, extractPdfText } = require('../utils/importPdfText');

async function listJobs(req, res) {
    try {
        const { organization_id } = req.user;
        const r = await query(
            `SELECT j.id, j.title, j.status, j.document_type_hint, j.created_at, j.updated_at,
                    (SELECT COUNT(*) FROM import_job_files f WHERE f.job_id = j.id) AS file_count
             FROM import_jobs j
             WHERE j.organization_id = @organization_id
             ORDER BY j.created_at DESC`,
            { organization_id }
        );
        res.json({ success: true, data: r.recordset || [] });
    } catch (err) {
        logger.error('listJobs', err);
        res.status(500).json({ error: err.message });
    }
}

async function createJob(req, res) {
    try {
        const { organization_id } = req.user;
        const created_by = req.user.user_id != null ? req.user.user_id : null;
        const { title, document_type_hint, notes, company_id } = req.body || {};
        const t = (title && String(title).trim()) || 'Import documenti';
        const r = await query(
            `INSERT INTO import_jobs (organization_id, company_id, created_by, title, status, document_type_hint, notes)
             OUTPUT INSERTED.id
             VALUES (@organization_id, @company_id, @created_by, @title, 'draft', @document_type_hint, @notes)`,
            {
                organization_id,
                company_id: company_id || null,
                created_by,
                title: t.substring(0, 255),
                document_type_hint: document_type_hint || null,
                notes: notes || null,
            }
        );
        const id = r.recordset[0].id;
        res.status(201).json({ success: true, data: { id } });
    } catch (err) {
        logger.error('createJob', err);
        res.status(500).json({ error: err.message });
    }
}

async function getJob(req, res) {
    try {
        const { organization_id } = req.user;
        const id = parseInt(req.params.id, 10);
        const j = await query(
            `SELECT * FROM import_jobs WHERE id = @id AND organization_id = @organization_id`,
            { id, organization_id }
        );
        if (!j.recordset.length) return res.status(404).json({ error: 'Job non trovato' });
        const files = await query(
            `SELECT id, original_name, mime_type, file_size, status, confidence_score,
                    reviewed_by, reviewed_at, created_at,
                    extracted_text, error_message, reviewer_notes
             FROM import_job_files WHERE job_id = @id ORDER BY id`,
            { id }
        );
        res.json({
            success: true,
            data: { job: j.recordset[0], files: files.recordset || [] },
        });
    } catch (err) {
        logger.error('getJob', err);
        res.status(500).json({ error: err.message });
    }
}

async function deleteJob(req, res) {
    try {
        const { organization_id } = req.user;
        const id = parseInt(req.params.id, 10);
        const chk = await query(
            `SELECT id FROM import_jobs WHERE id = @id AND organization_id = @organization_id`,
            { id, organization_id }
        );
        if (!chk.recordset.length) return res.status(404).json({ error: 'Job non trovato' });
        const files = await query(`SELECT storage_path FROM import_job_files WHERE job_id = @id`, { id });
        for (const row of files.recordset || []) {
            try {
                if (row.storage_path && fs.existsSync(row.storage_path)) fs.unlinkSync(row.storage_path);
            } catch (_) { /* ignore */ }
        }
        await query(`DELETE FROM import_jobs WHERE id = @id`, { id });
        res.json({ success: true });
    } catch (err) {
        logger.error('deleteJob', err);
        res.status(500).json({ error: err.message });
    }
}

async function uploadFiles(req, res) {
    try {
        const { organization_id } = req.user;
        const jobId = parseInt(req.params.id, 10);
        const chk = await query(
            `SELECT id, status FROM import_jobs WHERE id = @id AND organization_id = @organization_id`,
            { id: jobId, organization_id }
        );
        if (!chk.recordset.length) {
            if (req.files) req.files.forEach((f) => { try { fs.unlinkSync(f.path); } catch (_) {} });
            return res.status(404).json({ error: 'Job non trovato' });
        }
        if (!req.files?.length) return res.status(400).json({ error: 'Nessun file PDF ricevuto.' });
        for (const f of req.files) {
            await query(
                `INSERT INTO import_job_files (job_id, original_name, storage_path, mime_type, file_size, status)
                 VALUES (@job_id, @original_name, @storage_path, @mime_type, @file_size, 'uploaded')`,
                {
                    job_id: jobId,
                    original_name: f.originalname.substring(0, 500),
                    storage_path: f.path,
                    mime_type: f.mimetype || 'application/pdf',
                    file_size: f.size || null,
                }
            );
        }
        await query(
            `UPDATE import_jobs SET status = 'ready', updated_at = GETDATE() WHERE id = @id`,
            { id: jobId }
        );
        res.status(201).json({ success: true, uploaded: req.files.length });
    } catch (err) {
        if (req.files) req.files.forEach((f) => { try { fs.unlinkSync(f.path); } catch (_) {} });
        logger.error('uploadFiles', err);
        res.status(500).json({ error: err.message });
    }
}

async function processJob(req, res) {
    try {
        const { organization_id } = req.user;
        const jobId = parseInt(req.params.id, 10);
        const chk = await query(
            `SELECT id, status FROM import_jobs WHERE id = @id AND organization_id = @organization_id`,
            { id: jobId, organization_id }
        );
        if (!chk.recordset.length) return res.status(404).json({ error: 'Job non trovato' });
        const st = chk.recordset[0].status;
        if (!['draft', 'ready', 'review'].includes(st)) {
            return res.status(400).json({ error: 'Stato job non processabile.' });
        }
        await query(
            `UPDATE import_jobs SET status = 'processing', updated_at = GETDATE() WHERE id = @id`,
            { id: jobId }
        );
        const files = await query(
            `SELECT id, storage_path, original_name FROM import_job_files
             WHERE job_id = @job_id AND status = 'uploaded'`,
            { job_id: jobId }
        );
        if (!files.recordset?.length) {
            await query(
                `UPDATE import_jobs SET status = 'ready', updated_at = GETDATE() WHERE id = @id`,
                { id: jobId }
            );
            return res.json({
                success: true,
                extracted: 0,
                errors: 0,
                job_status: 'ready',
                message: 'Nessun file in coda (stato uploaded).',
            });
        }
        let ok = 0;
        let fail = 0;
        for (const row of files.recordset || []) {
            try {
                const buf = fs.readFileSync(row.storage_path);
                const text = await extractPdfText(buf);
                const conf = confidenceFromTextLength(text.length);
                await query(
                    `UPDATE import_job_files SET status = 'extracted', extracted_text = @text,
                     confidence_score = @conf, updated_at = GETDATE(), error_message = NULL
                     WHERE id = @fid`,
                    { fid: row.id, text: text || null, conf }
                );
                ok += 1;
            } catch (e) {
                await query(
                    `UPDATE import_job_files SET status = 'error', error_message = @msg, updated_at = GETDATE()
                     WHERE id = @fid`,
                    { fid: row.id, msg: String(e.message || e).substring(0, 2000) }
                );
                fail += 1;
            }
        }
        const nextStatus = fail && !ok ? 'failed' : 'review';
        await query(
            `UPDATE import_jobs SET status = @st, updated_at = GETDATE() WHERE id = @id`,
            { id: jobId, st: nextStatus }
        );
        res.json({ success: true, extracted: ok, errors: fail, job_status: nextStatus });
    } catch (err) {
        logger.error('processJob', err);
        res.status(500).json({ error: err.message });
    }
}

async function patchFile(req, res) {
    try {
        const { organization_id } = req.user;
        const jobId = parseInt(req.params.id, 10);
        const fileId = parseInt(req.params.fileId, 10);
        const { extracted_text, reviewer_notes, status } = req.body || {};
        const j = await query(
            `SELECT j.id FROM import_jobs j
             WHERE j.id = @job_id AND j.organization_id = @organization_id`,
            { job_id: jobId, organization_id }
        );
        if (!j.recordset.length) return res.status(404).json({ error: 'Job non trovato' });
        const f = await query(
            `SELECT id FROM import_job_files WHERE id = @file_id AND job_id = @job_id`,
            { file_id: fileId, job_id: jobId }
        );
        if (!f.recordset.length) return res.status(404).json({ error: 'File non trovato' });
        const sets = ['updated_at = GETDATE()'];
        const params = { file_id: fileId, job_id: jobId };
        if (extracted_text !== undefined) {
            sets.push('extracted_text = @extracted_text');
            params.extracted_text = extracted_text;
        }
        if (reviewer_notes !== undefined) {
            sets.push('reviewer_notes = @reviewer_notes');
            params.reviewer_notes = reviewer_notes;
        }
        if (status === 'reviewed') {
            sets.push("status = 'reviewed'");
            sets.push('reviewed_by = @reviewed_by');
            sets.push('reviewed_at = GETDATE()');
            params.reviewed_by = req.user.user_id != null ? req.user.user_id : null;
        }
        if (sets.length === 1) return res.status(400).json({ error: 'Nessun campo da aggiornare' });
        await query(
            `UPDATE import_job_files SET ${sets.join(', ')} WHERE id = @file_id AND job_id = @job_id`,
            params
        );
        const cnt = await query(
            `SELECT SUM(CASE WHEN status IN ('uploaded','extracted') THEN 1 ELSE 0 END) AS pending
             FROM import_job_files WHERE job_id = @job_id`,
            { job_id: jobId }
        );
        const pending = cnt.recordset[0]?.pending || 0;
        if (pending === 0) {
            await query(
                `UPDATE import_jobs SET status = 'completed', updated_at = GETDATE() WHERE id = @job_id`,
                { job_id: jobId }
            );
        }
        res.json({ success: true });
    } catch (err) {
        logger.error('patchFile', err);
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    listJobs,
    createJob,
    getJob,
    deleteJob,
    uploadFiles,
    processJob,
    patchFile,
};
