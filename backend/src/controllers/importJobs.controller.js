/**
 * importJobs.controller.js — Sprint 9: pipeline import PDF batch (testo locale, revisione umana)
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { confidenceFromTextLength } = require('../utils/importPdfText');
const { extractImportFileText } = require('../utils/importExtractText');
const { extractStructuredByDocType } = require('../services/importAiExtraction.service');
const { getActiveProvider } = require('../services/aiProviderAdapter');
const {
    buildNormTypeSpecificData,
    serializeNormTypeSpecificData,
    guessStandardCodeFromFilename,
} = require('../services/documentRegistryNorm.service');
const { resolveNormFolderId } = require('../services/normCodesImport.service');
const {
    calculatePathCache,
    folderCodeForDocType,
    resolveFolderByCode,
    resolveExplicitFolder,
} = require('../services/documentTreeProvisioner.service');
const { resolvePersonnelForQualification } = require('../services/personnelQualificationLink.service');
const { parseCompanyId, companyBelongsToOrg } = require('../services/qualificationCompany.service');
const { buildWelderQualificationDesignation } = require('../utils/weldingDesignation');
const {
    basenameImportRelativePath,
    resolveImportOriginalName,
    relativePathsFromBody,
} = require('../utils/importRelativePath');
const { progressiveScreenImportFile } = require('../utils/importProgressiveScreen');

/** Converte un valore in numero finito o null (per colonne DECIMAL). */
function toNum(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/**
 * Deriva la stringa legacy di range (es. "3-10mm") dai valori numerici min/max.
 * Se e' noto solo il minimo (max vuoto/null) restituisce "\u22653mm" (>=3mm): significa
 * "nessun limite superiore", tipico per gli spessori/diametri ISO 9606-1 (feedback
 * cliente Studio Mason — un valore singolo senza simbolo avrebbe fatto sembrare
 * la qualifica valida SOLO per quel valore esatto).
 */
function deriveRangeString(min, max, suffix = 'mm') {
    const a = toNum(min);
    const b = toNum(max);
    if (a == null && b == null) return null;
    if (a != null && b != null) return a === b ? `${a}${suffix}` : `${a}-${b}${suffix}`;
    if (a != null) return `\u2265${a}${suffix}`;
    return `${b}${suffix}`;
}

const QUALIFICATION_DOC_TYPES = new Set([
    'qualifica',
    'patentino_saldatore',
    'qualifica_14732',
    'qualifica_14731',
    'pes_pav',
    'cert_ndt',
]);

function isQualificationDocType(docType) {
    return QUALIFICATION_DOC_TYPES.has(String(docType || '').trim());
}

/** URL pubblico /uploads/... da path filesystem (stesso pattern qualificationIngest). */
function buildCertificateFileUrl(storagePath) {
    if (!storagePath) return null;
    const uploadBase = process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve(__dirname, '../../uploads');
    try {
        const resolved = path.resolve(storagePath);
        if (!fs.existsSync(resolved)) return null;
        return '/uploads/' + path.relative(uploadBase, resolved).replace(/\\/g, '/');
    } catch {
        return null;
    }
}

const COMPANY_REQUIRED_FOR_UPLOAD = {
    error: "Scegli un'azienda sul job (non Tutto lo studio).",
    code: 'COMPANY_REQUIRED_FOR_UPLOAD',
};

function unlinkUploadedFiles(files) {
    if (!files) return;
    files.forEach((f) => {
        try { if (f?.path) fs.unlinkSync(f.path); } catch (_) { /* ignore */ }
    });
}

async function resolveOptionalCompanyId(rawCompanyId, organizationId) {
    if (rawCompanyId == null || rawCompanyId === '') return { ok: true, companyId: null };
    const companyId = parseCompanyId(rawCompanyId);
    if (!companyId) {
        return { ok: false, status: 400, error: 'company_id non valido', code: 'INVALID_COMPANY_ID' };
    }
    const belongsToOrg = await companyBelongsToOrg(companyId, organizationId);
    if (!belongsToOrg) {
        return {
            ok: false,
            status: 400,
            error: "L'azienda selezionata non appartiene all'organizzazione.",
            code: 'COMPANY_NOT_IN_ORG',
        };
    }
    return { ok: true, companyId };
}

async function listJobs(req, res) {
    try {
        const { organization_id } = req.user;
        const r = await query(
            `SELECT j.id, j.title, j.status, j.document_type_hint, j.company_id, c.name AS company_name,
                    j.created_at, j.updated_at,
                    (SELECT COUNT(*) FROM import_job_files f WHERE f.job_id = j.id) AS file_count
             FROM import_jobs j
             LEFT JOIN companies c ON c.id = j.company_id
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
        const companyScope = await resolveOptionalCompanyId(company_id, organization_id);
        if (!companyScope.ok) {
            return res.status(companyScope.status).json({ error: companyScope.error, code: companyScope.code });
        }
        if (!companyScope.companyId) {
            if (isQualificationDocType(document_type_hint)) {
                return res.status(400).json({
                    error: "company_id obbligatorio per i job di qualifica.",
                    code: 'COMPANY_REQUIRED_FOR_QUALIFICATION_IMPORT',
                });
            }
            return res.status(400).json(COMPANY_REQUIRED_FOR_UPLOAD);
        }
        const t = (title && String(title).trim()) || 'Import documenti';
        const r = await query(
            `INSERT INTO import_jobs (organization_id, company_id, created_by, title, status, document_type_hint, notes)
             OUTPUT INSERTED.id
             VALUES (@organization_id, @company_id, @created_by, @title, 'draft', @document_type_hint, @notes)`,
            {
                organization_id,
                company_id: companyScope.companyId,
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
            `SELECT j.*, c.name AS company_name
             FROM import_jobs j
             LEFT JOIN companies c ON c.id = j.company_id
             WHERE j.id = @id AND j.organization_id = @organization_id`,
            { id, organization_id }
        );
        if (!j.recordset.length) return res.status(404).json({ error: 'Job non trovato' });
        const files = await query(
            `SELECT id, original_name, mime_type, file_size, status, confidence_score,
                    reviewed_by, reviewed_at, created_at, commercial_case_id,
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
            `SELECT id, status, company_id FROM import_jobs WHERE id = @id AND organization_id = @organization_id`,
            { id: jobId, organization_id }
        );
        if (!chk.recordset.length) {
            unlinkUploadedFiles(req.files);
            return res.status(404).json({ error: 'Job non trovato' });
        }
        if (!chk.recordset[0].company_id) {
            unlinkUploadedFiles(req.files);
            return res.status(400).json(COMPANY_REQUIRED_FOR_UPLOAD);
        }
        if (!req.files?.length) return res.status(400).json({ error: 'Nessun file PDF ricevuto.' });
        const relativePaths = relativePathsFromBody(req.body);
        for (let i = 0; i < req.files.length; i++) {
            const f = req.files[i];
            await query(
                `INSERT INTO import_job_files (job_id, original_name, storage_path, mime_type, file_size, status)
                 VALUES (@job_id, @original_name, @storage_path, @mime_type, @file_size, 'uploaded')`,
                {
                    job_id: jobId,
                    original_name: resolveImportOriginalName(f.originalname, relativePaths[i]),
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
                const extracted = await extractImportFileText({
                    storagePath: row.storage_path,
                    originalName: row.original_name,
                });
                const text = extracted.text || null;
                const conf = text ? confidenceFromTextLength(text.length) : 0;
                await query(
                    `UPDATE import_job_files SET status = 'extracted', extracted_text = @text,
                     confidence_score = @conf, updated_at = GETDATE(), error_message = NULL
                     WHERE id = @fid`,
                    { fid: row.id, text, conf }
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

function captureJsonRes() {
    const out = { statusCode: 200, body: null };
    return {
        out,
        status(code) {
            out.statusCode = code;
            return this;
        },
        json(body) {
            out.body = body;
            return this;
        },
    };
}

function mergeScreeningExtraction(existing, screen, placed) {
    let parsed = {};
    if (existing) {
        try {
            parsed = typeof existing === 'string' ? JSON.parse(existing) : { ...existing };
        } catch (_) {
            parsed = {};
        }
    }
    return JSON.stringify({
        ...parsed,
        document_type_guess: screen.doc_type,
        screening: {
            confidence: screen.confidence,
            folder_code: screen.folder_code,
            reason: screen.reason,
            placed: !!placed,
            lines_used: screen.lines_used ?? 0,
            chars_used: screen.chars_used ?? 0,
        },
    });
}

/**
 * IA-5: classifica path+nome+testo corto e, se confidence alta e tipo posabile, commit in scaffale.
 * Qualifiche: solo guess (niente auto-commit registry). Senza azienda: solo guess.
 */
async function screenAndPlace(req, res) {
    try {
        const { organization_id } = req.user;
        const jobId = parseInt(req.params.id, 10);
        const jobRows = await query(
            `SELECT id, company_id, document_type_hint FROM import_jobs
             WHERE id = @id AND organization_id = @organization_id`,
            { id: jobId, organization_id }
        );
        if (!jobRows.recordset.length) return res.status(404).json({ error: 'Job non trovato' });
        const job = jobRows.recordset[0];
        if (!job.company_id) {
            return res.status(400).json(COMPANY_REQUIRED_FOR_UPLOAD);
        }
        const files = await query(
            `SELECT id, original_name, extracted_text, status, ai_extraction_json, registry_document_id
             FROM import_job_files
             WHERE job_id = @job_id AND status IN ('uploaded', 'extracted', 'reviewed')`,
            { job_id: jobId }
        );

        const results = [];
        for (const file of files.recordset || []) {
            if (file.registry_document_id) {
                results.push({
                    file_id: file.id,
                    skipped: true,
                    reason: 'già in registro',
                });
                continue;
            }
            const screen = progressiveScreenImportFile({
                original_name: file.original_name,
                extracted_text: file.extracted_text,
                hint: job.document_type_hint,
            });
            let placed = false;
            let place_error = null;
            if (screen.can_auto_place && !job.company_id) {
                place_error = 'COMPANY_REQUIRED_FOR_FOLDER';
            } else if (screen.can_auto_place) {
                const cap = captureJsonRes();
                await commitToRegistry({
                    user: req.user,
                    params: { id: String(jobId), fileId: String(file.id) },
                    body: {
                        doc_type: screen.doc_type,
                        company_id: job.company_id,
                        title: String(screen.basename || '').replace(/\.pdf$/i, '') || screen.basename,
                    },
                }, cap);
                if (cap.out.statusCode === 201) {
                    placed = true;
                } else {
                    place_error = cap.out.body?.code || cap.out.body?.error || 'PLACE_FAILED';
                }
            }

            await query(
                `UPDATE import_job_files
                 SET ai_extraction_json = @json, ai_extraction_at = GETDATE(), updated_at = GETDATE()
                 WHERE id = @fid AND job_id = @jid`,
                {
                    json: mergeScreeningExtraction(file.ai_extraction_json, screen, placed),
                    fid: file.id,
                    jid: jobId,
                }
            );
            results.push({
                file_id: file.id,
                original_name: file.original_name,
                doc_type: screen.doc_type,
                confidence: screen.confidence,
                folder_code: screen.folder_code,
                reason: screen.reason,
                lines_used: screen.lines_used,
                placed,
                place_error,
            });
        }

        res.json({
            success: true,
            data: {
                screened: results.length,
                placed: results.filter((r) => r.placed).length,
                results,
            },
        });
    } catch (err) {
        logger.error('screenAndPlace', err);
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
            result = await extractStructuredByDocType({
                text,
                docType: j.recordset[0].document_type_hint || null,
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
            _aiMeta: {
                provider: getActiveProvider() || 'unknown',
                model: result.model,
                contextSummary: `import ai-extract job=${jobId} file=${fileId} docType=${j.recordset[0].document_type_hint || 'auto'}`.substring(0, 500),
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
            `SELECT id, status, original_name, storage_path, mime_type, file_size,
                    ai_extraction_json, registry_document_id, extracted_text, confidence_score
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
        // uploaded: screening da path (disegni/foto) senza «Estrai testo»
        if (!['uploaded', 'extracted', 'reviewed'].includes(file.status)) {
            return res.status(400).json({
                error: 'Il file deve essere in stato uploaded, extracted o reviewed per il commit.',
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
        const aiTypeSpecific = aiData.type_specific_data && typeof aiData.type_specific_data === 'object'
            ? aiData.type_specific_data
            : {};
        const doc_type = String(
            body.doc_type
            || aiData.document_type_guess
            || aiData.document_type
            || j.recordset[0].document_type_hint
            || 'altro'
        ).substring(0, 50);
        const isNorma = doc_type === 'norma';
        let company_id = body.company_id ? parseInt(body.company_id, 10) : (j.recordset[0].company_id || null);
        const notes = body.notes != null ? String(body.notes).substring(0, 2000) : null;

        let title;
        let doc_code = null;
        let revision = null;
        let responsible = null;
        let issue_date = null;
        let expiry_date = null;
        let clause_ref = null;
        let standard_id = null;
        let type_specific_data = null;

        if (isNorma) {
            const bodyTsd = body.type_specific_data && typeof body.type_specific_data === 'object'
                ? body.type_specific_data
                : {};
            const normRaw = {
                ...aiTypeSpecific,
                ...bodyTsd,
                standard_code: bodyTsd.standard_code ?? body.standard_code ?? aiTypeSpecific.standard_code,
                issuing_body: bodyTsd.issuing_body ?? body.issuing_body ?? aiTypeSpecific.issuing_body,
                edition_year: bodyTsd.edition_year ?? body.edition_year ?? aiTypeSpecific.edition_year,
                norm_title: bodyTsd.norm_title ?? body.norm_title ?? aiTypeSpecific.norm_title ?? aiData.title,
                validity_status: bodyTsd.validity_status ?? aiTypeSpecific.validity_status,
                validity_check_url: bodyTsd.validity_check_url ?? aiTypeSpecific.validity_check_url,
                last_validity_check: bodyTsd.last_validity_check ?? aiTypeSpecific.last_validity_check,
                superseded_by: bodyTsd.superseded_by ?? aiTypeSpecific.superseded_by,
                scope_summary: bodyTsd.scope_summary ?? aiTypeSpecific.scope_summary ?? aiData.summary,
            };
            if (!normRaw.standard_code && file.original_name) {
                const fromName = guessStandardCodeFromFilename(
                    basenameImportRelativePath(file.original_name) || file.original_name
                );
                if (fromName) normRaw.standard_code = fromName;
            }

            const built = buildNormTypeSpecificData(normRaw);
            if (!built) {
                return res.status(400).json({
                    error: 'Codice norma obbligatorio per il commit (standard_code).',
                    code: 'MISSING_STANDARD_CODE',
                });
            }

            type_specific_data = serializeNormTypeSpecificData(normRaw);
            const codeLabel = built.standard_code;
            const normTitle = built.norm_title || aiData.title || '';
            title = String(body.title || (normTitle ? `${codeLabel} — ${normTitle}` : codeLabel))
                .substring(0, 500);

            if (built.edition_year) {
                issue_date = `${built.edition_year}-01-01`;
            }
        } else {
            title = String(
                body.title
                || aiData.title
                || basenameImportRelativePath(file.original_name)
                || file.original_name
                || 'Documento importato'
            ).substring(0, 500);
            doc_code = body.doc_code != null ? String(body.doc_code).substring(0, 100) : (aiData.doc_code || aiData.code || null);
            revision = body.revision != null ? String(body.revision).substring(0, 20) : (aiData.revision || null);
            responsible = body.responsible != null
                ? String(body.responsible).substring(0, 255)
                : (aiData.person_name || aiData.responsible || null);
            issue_date = body.issue_date || aiData.issue_date || null;
            expiry_date = body.expiry_date || aiData.expiry_date || null;
            clause_ref = body.clause_ref != null ? String(body.clause_ref).substring(0, 30) : null;
            standard_id = body.standard_id ? parseInt(body.standard_id, 10) : null;
            if (body.type_specific_data) {
                type_specific_data = typeof body.type_specific_data === 'string'
                    ? body.type_specific_data
                    : JSON.stringify(body.type_specific_data);
            } else if (Object.keys(aiTypeSpecific).length) {
                type_specific_data = JSON.stringify(aiTypeSpecific);
            }
        }

        let parentId = null;
        let resolvedFolderCompanyId = null;
        const requestedFolderId = body.parent_folder_id
            ? parseInt(body.parent_folder_id, 10)
            : null;

        if (isNorma) {
            const normFolder = await resolveNormFolderId(organization_id, requestedFolderId);
            if (!normFolder) {
                return res.status(404).json({
                    error: 'Cartella "NORME E LEGGI" (folder_code 2.3) non trovata. Inizializza la struttura documentale.',
                    code: 'NORM_FOLDER_NOT_FOUND',
                });
            }
            parentId = normFolder.id;
            resolvedFolderCompanyId = normFolder.company_id;
        }

        if (isNorma && company_id == null && resolvedFolderCompanyId != null) {
            company_id = resolvedFolderCompanyId;
        }

        const companyScope = await resolveOptionalCompanyId(company_id, organization_id);
        if (!companyScope.ok) {
            return res.status(companyScope.status).json({ error: companyScope.error, code: companyScope.code });
        }
        company_id = companyScope.companyId;

        if (!isNorma) {
            let folder = null;
            if (requestedFolderId) {
                folder = await resolveExplicitFolder(organization_id, requestedFolderId);
                if (!folder) {
                    return res.status(404).json({
                        error: 'Cartella destinazione non trovata.',
                        code: 'FOLDER_NOT_FOUND',
                    });
                }
            } else {
                const folderCode = folderCodeForDocType(doc_type);
                if (folderCode) {
                    if (company_id == null) {
                        return res.status(400).json({
                            error: 'Seleziona l\'azienda del job (o nel commit) per posare il documento nello scaffale. Senza azienda lo scaffale azienda non esiste.',
                            code: 'COMPANY_REQUIRED_FOR_FOLDER',
                        });
                    }
                    folder = await resolveFolderByCode(organization_id, folderCode, company_id);
                    if (!folder) {
                        return res.status(404).json({
                            error: `Cartella albero (folder_code ${folderCode}) non trovata. Inizializza la struttura documentale.`,
                            code: 'FOLDER_NOT_FOUND',
                        });
                    }
                }
            }
            if (folder) {
                parentId = folder.id;
                if (company_id == null && folder.company_id != null) {
                    company_id = folder.company_id;
                }
            }
        }

        // Crea record document_registry
        const ins = await query(
            `INSERT INTO document_registry
             (organization_id, company_id, parent_id, standard_id, clause_ref, doc_type, doc_code,
              title, revision, status, issue_date, expiry_date, responsible,
              import_status, extraction_confidence, notes, type_specific_data,
              created_by, created_at, updated_at)
             OUTPUT INSERTED.id
             VALUES
             (@organization_id, @company_id, @parent_id, @standard_id, @clause_ref, @doc_type, @doc_code,
              @title, @revision, 'in_approvazione', @issue_date, @expiry_date, @responsible,
              'ai_draft', @confidence, @notes, @type_specific_data,
              @created_by, GETDATE(), GETDATE())`,
            {
                organization_id,
                company_id,
                parent_id: parentId,
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
                type_specific_data,
                created_by: user_id || null,
            }
        );
        const registryId = ins.recordset[0].id;

        if (parentId) {
            const pathCache = await calculatePathCache(registryId, organization_id);
            await query(
                `UPDATE document_registry SET path_cache = @path_cache WHERE id = @id`,
                { path_cache: pathCache, id: registryId }
            );
        }

        // Collega il PDF originale come prima versione file del documento
        if (file.storage_path && fs.existsSync(file.storage_path)) {
            try {
                const fileExt = path.extname(file.original_name || '').toLowerCase() || '.pdf';
                await query(
                    `INSERT INTO attachments
                        (document_id, uploaded_by,
                         file_name, file_type, storage_path, file_size, mime_type,
                         doc_file_version, is_current_doc_version,
                         category, created_at)
                     VALUES
                        (@docId, @userId,
                         @fileName, @fileType, @storagePath, @fileSize, @mimeType,
                         1, 1,
                         'document', GETDATE())`,
                    {
                        docId: registryId,
                        userId: user_id || null,
                        fileName: basenameImportRelativePath(file.original_name) || file.original_name || 'documento.pdf',
                        fileType: fileExt,
                        storagePath: file.storage_path,
                        fileSize: file.file_size || null,
                        mimeType: file.mime_type || 'application/pdf',
                    }
                );
                logger.info(`commitToRegistry: PDF ${file.original_name} allegato come v1 al documento #${registryId}`);
            } catch (attErr) {
                logger.warn(`commitToRegistry: impossibile allegare PDF al documento #${registryId}`, { error: attErr.message });
            }
        }

        if (isNorma && type_specific_data) {
            try {
                const tsd = typeof type_specific_data === 'string'
                    ? JSON.parse(type_specific_data)
                    : type_specific_data;
                const textQuality = file.extracted_text && file.extracted_text.length >= 5000
                    ? 'good'
                    : (file.extracted_text && file.extracted_text.length >= 500 ? 'partial' : 'ocr_poor');
                await query(
                    `INSERT INTO norm_document_sources (
                       document_id, organization_id, standard_code, norm_title,
                       edition_year, issuing_body, extracted_text, text_quality,
                       validity_status, created_at, updated_at
                     )
                     VALUES (
                       @docId, @orgId, @stdCode, @normTitle,
                       @editionYear, @issuingBody, @extractedText, @textQuality,
                       'vigente', GETDATE(), GETDATE()
                     )`,
                    {
                        docId: registryId,
                        orgId: organization_id,
                        stdCode: tsd.standard_code || null,
                        normTitle: tsd.norm_title || null,
                        editionYear: tsd.edition_year || null,
                        issuingBody: tsd.issuing_body || null,
                        extractedText: file.extracted_text || null,
                        textQuality,
                    }
                );
            } catch (normSrcErr) {
                logger.warn(`commitToRegistry: norm_document_sources non creato per #${registryId}`, {
                    error: normSrcErr.message,
                });
            }
        }

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

/**
 * POST /import-jobs/:id/files/:fileId/commit-to-qualification
 * Crea un record qualifications da un file AI-estratto, immediatamente attivo
 * (approval_status = 'approvata' — nessun gate di approvazione interna, v.
 * qualifications.controller.js header). Il corpo può sovrascrivere i campi estratti dall'AI.
 */
async function commitToQualification(req, res) {
    try {
        const { organization_id } = req.user;
        const user_id = req.user.user_id || req.user.id || null;
        const jobId   = parseInt(req.params.id, 10);
        const fileId  = parseInt(req.params.fileId, 10);

        const jCheck = await query(
            `SELECT id, company_id FROM import_jobs WHERE id=@id AND organization_id=@organization_id`,
            { id: jobId, organization_id }
        );
        if (!jCheck.recordset.length) return res.status(404).json({ error: 'Job non trovato' });
        const jobCompanyId = jCheck.recordset[0].company_id || null;

        const fRows = await query(
            `SELECT id, status, ai_extraction_json, original_name, confidence_score, storage_path
             FROM import_job_files WHERE id=@fid AND job_id=@jid`,
            { fid: fileId, jid: jobId }
        );
        if (!fRows.recordset.length) return res.status(404).json({ error: 'File non trovato' });
        const file = fRows.recordset[0];
        if (file.status === 'committed') {
            return res.status(409).json({ error: 'File già committato', code: 'ALREADY_COMMITTED' });
        }

        // Estrae dati AI
        let aiData = {};
        let aiTypeSpecific = {};
        if (file.ai_extraction_json) {
            try {
                const parsed = JSON.parse(file.ai_extraction_json);
                aiData = parsed || {};
                aiTypeSpecific = aiData.type_specific_data || {};
            } catch (_) { /* ignora */ }
        }

        const body = req.body || {};

        // Merge body su aiTypeSpecific (body vince)
        const tsd = { ...aiTypeSpecific, ...body };

        // Determina tipo qualifica
        const docTypeHint = body.qualification_type || aiData.document_type_guess || 'generico';
        const QUAL_TYPES = {
            patentino_saldatore: 'Saldatore ISO 9606-1',
            qualifica_14732:     'Operatore ISO 14732',
            cert_ndt:            'Operatore NDT ISO 9712',
            qualifica_14731:     'Coordinatore ISO 14731',
            pes_pav:             'Abilitazione PES/PAV',
        };
        const qualificationType = body.qualification_type_label || QUAL_TYPES[docTypeHint] || docTypeHint || 'Generica';

        // Costruisce record qualifications: l'azienda autorevole è quella del job.
        if (!jobCompanyId) {
            return res.status(400).json({
                error: 'company_id obbligatorio: seleziona l\'azienda del job prima di creare la bozza qualifica.',
                code: 'MISSING_COMPANY_ID',
            });
        }
        const jobCompanyScope = await resolveOptionalCompanyId(jobCompanyId, organization_id);
        if (!jobCompanyScope.ok) {
            return res.status(jobCompanyScope.status).json({ error: jobCompanyScope.error, code: jobCompanyScope.code });
        }
        if (body.company_id != null && body.company_id !== '') {
            const requestedCompanyId = parseCompanyId(body.company_id);
            if (!requestedCompanyId) {
                return res.status(400).json({ error: 'company_id non valido', code: 'INVALID_COMPANY_ID' });
            }
            if (requestedCompanyId !== jobCompanyScope.companyId) {
                return res.status(409).json({
                    error: "company_id non coerente con l'azienda del job.",
                    code: 'COMPANY_ID_MISMATCH',
                });
            }
        }

        // Range numerici saldatura (fonte primaria) + derivazione stringa legacy.
        const thickness_min_mm = toNum(body.thickness_min_mm ?? tsd.thickness_min_mm);
        const thickness_max_mm = toNum(body.thickness_max_mm ?? tsd.thickness_max_mm);
        const pipe_diameter_min_mm = toNum(body.pipe_diameter_min_mm ?? tsd.pipe_diameter_min_mm ?? tsd.pipe_diameter_mm);
        const pipe_diameter_max_mm = toNum(body.pipe_diameter_max_mm ?? tsd.pipe_diameter_max_mm);

        const welding_process = body.welding_process || tsd.welding_process || null;
        const product_type    = body.product_type || tsd.product_type || null;
        const joint_type      = body.joint_type || tsd.joint_type || null;
        const weld_details    = body.weld_details || tsd.weld_details || null;
        const filler_material = body.filler_material || tsd.filler_material_group || null;
        const transfer_mode   = body.transfer_mode || tsd.transfer_mode || null;
        const position_range  = body.position_range
            || (Array.isArray(tsd.welding_positions) ? tsd.welding_positions.join(',') : tsd.welding_positions)
            || null;

        const qualification_designation = body.qualification_designation
            || buildWelderQualificationDesignation({
                welding_process,
                product_type,
                joint_type,
                filler_material_group: filler_material,
                thickness_min_mm,
                thickness_max_mm,
                pipe_diameter_min_mm,
                pipe_diameter_max_mm,
                welding_positions: position_range,
                weld_details,
            });

        const qData = {
            organization_id,
            company_id:           jobCompanyScope.companyId,
            person_name:          body.person_name || tsd.person_name || tsd.welder_name || tsd.operator_name || null,
            person_code:          body.person_code || null,
            department:           body.department || null,
            qualification_type:   qualificationType,
            standard_ref:         body.standard_ref || tsd.standard_reference || null,
            scope_detail:         body.scope_detail || null,
            certificate_number:   body.certificate_number || tsd.certificate_number || null,
            issuing_body:         body.issuing_body || tsd.issuing_body || null,
            // exam_date dedicata; issue_date non piu' sovrascritta ma in transizione popola entrambe.
            issue_date:           body.issue_date || tsd.issue_date || tsd.exam_date || null,
            exam_date:            body.exam_date || tsd.exam_date || null,
            expiry_date:          body.expiry_date || tsd.expiry_date || null,
            last_renewal_date:    body.last_renewal_date || null,
            last_confirmation_date: body.last_confirmation_date || tsd.last_confirmation_date || null,
            next_confirmation_due:  body.next_confirmation_due || tsd.next_confirmation_due || null,
            revalidation_date:    body.revalidation_date || tsd.revalidation_date || null,
            status:               'valida',
            notes:                body.notes || null,
            approval_status:      'approvata',
            created_by:           user_id,
            // Saldatori
            welding_process:      welding_process,
            material_group:       body.material_group || tsd.material_group || null,
            position_range:       position_range,
            ndt_method:           body.ndt_method || tsd.ndt_method || null,
            ndt_level:            body.ndt_level || tsd.certification_level ? parseInt(body.ndt_level || tsd.certification_level) : null,
            joint_type:           joint_type,
            product_type:         product_type,
            weld_details:         weld_details,
            qualification_designation: qualification_designation,
            // Range numerici (fonte primaria) + stringhe legacy derivate (compatibilita').
            thickness_min_mm:     thickness_min_mm,
            thickness_max_mm:     thickness_max_mm,
            pipe_diameter_min_mm: pipe_diameter_min_mm,
            pipe_diameter_max_mm: pipe_diameter_max_mm,
            thickness_range:      body.thickness_range || deriveRangeString(thickness_min_mm, thickness_max_mm),
            pipe_diameter:        body.pipe_diameter || deriveRangeString(pipe_diameter_min_mm, pipe_diameter_max_mm),
            filler_material:      filler_material,
            transfer_mode:        transfer_mode,
            shielding_gas:        body.shielding_gas || tsd.shielding_gas || null,
            equipment_type:       body.equipment_type || tsd.equipment_type || null,
            // Operatori ISO 14732 (saldatura automatica/meccanizzata)
            welding_type:         body.welding_type || tsd.welding_type || null,
            single_multi_run:     body.single_multi_run || tsd.single_multi_run || null,
            qualification_method: body.qualification_method || tsd.qualification_method || null,
            // NDT
            ndt_sector:           body.ndt_sector || tsd.ndt_sector || null,
            certification_scheme: body.certification_scheme || tsd.certification_scheme || null,
            // Coordinatori
            coordinator_title:    body.coordinator_title || tsd.coordinator_title || null,
            diploma_number:       body.diploma_number || tsd.diploma_number || null,
            cpd_valid_until:      body.cpd_valid_until || tsd.cpd_valid_until || null,
            // PES/PAV
            patent_type:          body.patent_type || tsd.patent_type || null,
            training_body:        body.training_body || tsd.training_body || null,
            // Generico
            course_name:          body.course_name || null,
            training_hours:       body.training_hours ? parseInt(body.training_hours) : null,
            examiner_body:        body.examiner_body || tsd.examiner_body || null,
        };

        if (!qData.person_name) {
            return res.status(400).json({ error: 'person_name obbligatorio (non estratto dall\'AI).', code: 'MISSING_PERSON_NAME' });
        }

        // Avvisi campi obbligatori mancanti per il saldatore — NON bloccano la creazione bozza.
        const warnings = [];
        if (String(docTypeHint) === 'patentino_saldatore') {
            const requiredChecks = [
                ['welding_process', qData.welding_process, 'processo di saldatura'],
                ['material_group', qData.material_group, 'gruppo materiale'],
                ['position_range', qData.position_range, 'posizioni qualificate'],
                ['expiry_date', qData.expiry_date, 'data scadenza'],
            ];
            for (const [, value, label] of requiredChecks) {
                if (value == null || value === '') warnings.push(`Campo obbligatorio mancante: ${label}`);
            }
            if (warnings.length) {
                logger.warn(`commitToQualification: bozza saldatore con campi mancanti (file ${fileId})`, { warnings });
            }
        }

        // Risolve personnel_id da company_personnel (parametri camelCase come richiesto dal service)
        const personnelResult = await resolvePersonnelForQualification({
            personName:     qData.person_name,
            companyId:      qData.company_id,
            organizationId: qData.organization_id,
        });
        qData.personnel_id = (personnelResult?.ok && personnelResult.personnelId != null)
            ? personnelResult.personnelId
            : null;

        const ins = await query(
            `INSERT INTO qualifications
             (organization_id, company_id, person_name, person_code, department,
              qualification_type, standard_ref, scope_detail, certificate_number, issuing_body,
              issue_date, exam_date, expiry_date, last_renewal_date,
              last_confirmation_date, next_confirmation_due, revalidation_date,
              status, notes, created_by,
              approval_status, personnel_id,
              welding_process, material_group, position_range, ndt_method, ndt_level,
              joint_type, product_type, weld_details, transfer_mode, qualification_designation,
              thickness_min_mm, thickness_max_mm, pipe_diameter_min_mm, pipe_diameter_max_mm,
              thickness_range, pipe_diameter, filler_material, shielding_gas, equipment_type,
              welding_type, single_multi_run, qualification_method,
              ndt_sector, certification_scheme, coordinator_title, diploma_number, cpd_valid_until,
              patent_type, training_body, course_name, training_hours, examiner_body)
             OUTPUT INSERTED.id
             VALUES
             (@organization_id, @company_id, @person_name, @person_code, @department,
              @qualification_type, @standard_ref, @scope_detail, @certificate_number, @issuing_body,
              @issue_date, @exam_date, @expiry_date, @last_renewal_date,
              @last_confirmation_date, @next_confirmation_due, @revalidation_date,
              @status, @notes, @created_by,
              @approval_status, @personnel_id,
              @welding_process, @material_group, @position_range, @ndt_method, @ndt_level,
              @joint_type, @product_type, @weld_details, @transfer_mode, @qualification_designation,
              @thickness_min_mm, @thickness_max_mm, @pipe_diameter_min_mm, @pipe_diameter_max_mm,
              @thickness_range, @pipe_diameter, @filler_material, @shielding_gas, @equipment_type,
              @welding_type, @single_multi_run, @qualification_method,
              @ndt_sector, @certification_scheme, @coordinator_title, @diploma_number, @cpd_valid_until,
              @patent_type, @training_body, @course_name, @training_hours, @examiner_body)`,
            qData
        );
        const qualId = ins.recordset[0].id;

        // Collega PDF import al certificato qualifica (certificate_file_url)
        let certificate_file_url = null;
        if (file.storage_path) {
            certificate_file_url = buildCertificateFileUrl(file.storage_path);
            if (certificate_file_url) {
                await query(
                    `UPDATE qualifications
                     SET certificate_file_url = @url, updated_at = GETDATE()
                     WHERE id = @qualId AND organization_id = @orgId`,
                    { url: certificate_file_url, qualId, orgId: organization_id }
                );
                logger.info(`commitToQualification: PDF ${file.original_name} collegato a qualification #${qualId}`);
            } else {
                logger.warn(`commitToQualification: PDF non trovato o path non valido per file ${fileId}`, {
                    storage_path: file.storage_path,
                });
            }
        }

        // Aggiorna file: committed + tracciabilità bidirezionale
        await query(
            `UPDATE import_job_files
             SET status = 'committed', qualification_id = @qualId, updated_at = GETDATE()
             WHERE id = @fid AND job_id = @jid`,
            { qualId, fid: fileId, jid: jobId }
        );

        logger.info(`commitToQualification: file ${fileId} → qualification #${qualId} (org ${organization_id})`);
        res.status(201).json({
            success: true,
            data: {
                qualification_id: qualId,
                approval_status: 'approvata',
                certificate_file_url,
                warnings,
            },
        });
    } catch (err) {
        logger.error('commitToQualification', err);
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
    screenAndPlace,
    patchFile,
    suggestAiExtraction,
    commitToRegistry,
    commitToQualification,
};
