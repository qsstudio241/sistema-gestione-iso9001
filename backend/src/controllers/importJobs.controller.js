/**
 * importJobs.controller.js — Sprint 9: pipeline import PDF batch (testo locale, revisione umana)
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { confidenceFromTextLength, extractPdfText } = require('../utils/importPdfText');
const { extractStructuredFromText } = require('../services/importAiExtraction.service');

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
                    extracted_text, error_message, reviewer_notes,
                    ai_extraction_json, ai_extraction_error, ai_extraction_at, ai_model
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

async function suggestAiExtraction(req, res) {
    try {
        const { organization_id } = req.user;
        const jobId = parseInt(req.params.id, 10);
        const fileId = parseInt(req.params.fileId, 10);
        const j = await query(
            `SELECT j.id, j.document_type_hint
             FROM import_jobs j
             WHERE j.id = @job_id AND j.organization_id = @organization_id`,
            { job_id: jobId, organization_id }
        );
        if (!j.recordset.length) return res.status(404).json({ error: 'Job non trovato' });
        const f = await query(
            `SELECT id, status, extracted_text FROM import_job_files
             WHERE id = @file_id AND job_id = @job_id`,
            { file_id: fileId, job_id: jobId }
        );
        if (!f.recordset.length) return res.status(404).json({ error: 'File non trovato' });
        const row = f.recordset[0];
        if (!['extracted', 'reviewed'].includes(row.status)) {
            return res.status(400).json({
                error: 'Analisi AI disponibile solo dopo estrazione testo (stato extracted o reviewed).',
                code: 'INVALID_FILE_STATUS',
            });
        }
        const text = row.extracted_text;
        if (!text || !String(text).trim()) {
            return res.status(400).json({ error: 'Nessun testo estratto da inviare alla AI.', code: 'EMPTY_SOURCE_TEXT' });
        }
        let result;
        try {
            result = await extractStructuredFromText({
                text,
                documentTypeHint: j.recordset[0].document_type_hint || null,
            });
        } catch (e) {
            const code = e.code || 'AI_ERROR';
            if (code === 'AI_NOT_CONFIGURED') {
                return res.status(503).json({
                    error: e.message,
                    code,
                });
            }
            const msg = String(e.message || e).substring(0, 2000);
            await query(
                `UPDATE import_job_files SET ai_extraction_error = @err, updated_at = GETDATE()
                 WHERE id = @file_id AND job_id = @job_id`,
                { file_id: fileId, job_id: jobId, err: msg }
            );
            const status = e.status >= 400 && e.status < 600 ? e.status : 502;
            return res.status(status).json({ error: msg, code });
        }
        const jsonStr = JSON.stringify(result.data);
        await query(
            `UPDATE import_job_files SET
                ai_extraction_json = @json,
                ai_extraction_error = NULL,
                ai_extraction_at = GETDATE(),
                ai_model = @model,
                updated_at = GETDATE()
             WHERE id = @file_id AND job_id = @job_id`,
            { file_id: fileId, job_id: jobId, json: jsonStr, model: result.model }
        );
        res.json({
            success: true,
            data: {
                model: result.model,
                extraction: result.data,
            },
        });
    } catch (err) {
        logger.error('suggestAiExtraction', err);
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

/**
 * Sprint 10 — Commit di un file processato al document_registry.
 *
 * Il frontend invia i campi del documento (pre-compilati dall'AI, editabili dall'utente).
 * Il backend crea un record document_registry con import_status='ai_draft',
 * poi segna il file come 'committed' e salva il link registry_document_id.
 *
 * POST /import-jobs/:id/files/:fileId/commit-to-registry
 */
async function commitToRegistry(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const jobId = parseInt(req.params.id, 10);
        const fileId = parseInt(req.params.fileId, 10);

        // Verifica job appartenente all'org
        const j = await query(
            `SELECT j.id, j.company_id FROM import_jobs j
             WHERE j.id = @job_id AND j.organization_id = @organization_id`,
            { job_id: jobId, organization_id }
        );
        if (!j.recordset.length) return res.status(404).json({ error: 'Job non trovato' });

        // Verifica file e stato
        const f = await query(
            `SELECT id, status, original_name, ai_extraction_json, registry_document_id
             FROM import_job_files WHERE id = @file_id AND job_id = @job_id`,
            { file_id: fileId, job_id: jobId }
        );
        if (!f.recordset.length) return res.status(404).json({ error: 'File non trovato' });
        const file = f.recordset[0];

        if (file.registry_document_id) {
            return res.status(409).json({
                error: 'File già committato nel registry',
                code: 'ALREADY_COMMITTED',
                registry_document_id: file.registry_document_id,
            });
        }
        if (!['extracted', 'reviewed'].includes(file.status)) {
            return res.status(400).json({
                error: 'Il file deve essere in stato extracted o reviewed per il commit.',
                code: 'INVALID_FILE_STATUS',
            });
        }

        // Legge eventuali valori dall'AI extraction come fallback
        let aiData = {};
        try {
            if (file.ai_extraction_json) {
                aiData = typeof file.ai_extraction_json === 'object'
                    ? file.ai_extraction_json
                    : JSON.parse(file.ai_extraction_json);
            }
        } catch (_) { /* ignore malformed */ }

        // Campi del documento — priorità: body utente > AI > fallback
        const body = req.body || {};
        const title = String(body.title || aiData.title || file.original_name || 'Documento importato').substring(0, 500);
        const doc_type = String(body.doc_type || aiData.document_type || j.recordset[0].document_type_hint || 'altro').substring(0, 50);
        const doc_code = body.doc_code != null ? String(body.doc_code).substring(0, 100) : (aiData.doc_code || aiData.code || null);
        const revision = body.revision != null ? String(body.revision).substring(0, 20) : (aiData.revision || null);
        const responsible = body.responsible != null ? String(body.responsible).substring(0, 255) : (aiData.person_name || aiData.responsible || null);
        const issue_date = body.issue_date || aiData.issue_date || null;
        const expiry_date = body.expiry_date || aiData.expiry_date || null;
        const clause_ref = body.clause_ref != null ? String(body.clause_ref).substring(0, 30) : null;
        const standard_id = body.standard_id ? parseInt(body.standard_id, 10) : null;
        const company_id = body.company_id ? parseInt(body.company_id, 10) : (j.recordset[0].company_id || null);
        const notes = body.notes != null ? String(body.notes).substring(0, 2000) : null;

        // Crea record document_registry
        const ins = await query(
            `INSERT INTO document_registry
             (organization_id, company_id, standard_id, clause_ref, doc_type, doc_code,
              title, revision, status, issue_date, expiry_date, responsible,
              import_status, extraction_confidence, notes, created_by, created_at, updated_at)
             OUTPUT INSERTED.id
             VALUES
             (@organization_id, @company_id, @standard_id, @clause_ref, @doc_type, @doc_code,
              @title, @revision, 'in_approvazione', @issue_date, @expiry_date, @responsible,
              'ai_draft', @confidence, @notes, @created_by, GETDATE(), GETDATE())`,
            {
                organization_id,
                company_id,
                standard_id,
                clause_ref,
                doc_type,
                doc_code,
                title,
                revision,
                issue_date: issue_date || null,
                expiry_date: expiry_date || null,
                responsible,
                confidence: file.confidence_score || null,
                notes,
                created_by: user_id || null,
            }
        );
        const registryId = ins.recordset[0].id;

        // Aggiorna il file: committed + link al registry
        await query(
            `UPDATE import_job_files
             SET status = 'committed', registry_document_id = @reg_id, updated_at = GETDATE()
             WHERE id = @file_id AND job_id = @job_id`,
            { file_id: fileId, job_id: jobId, reg_id: registryId }
        );

        logger.info(`commitToRegistry: file ${fileId} → document_registry #${registryId} (org ${organization_id})`);
        res.status(201).json({
            success: true,
            data: { registry_document_id: registryId, doc_type, title },
        });
    } catch (err) {
        logger.error('commitToRegistry', err);
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
    suggestAiExtraction,
    commitToRegistry,
};
