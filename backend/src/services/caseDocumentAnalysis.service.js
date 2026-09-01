/**
 * caseDocumentAnalysis.service.js
 * Orchestratore analisi AI su tutti i documenti di una commessa (slice #5).
 *
 * Seleziona l'estrattore in base a ruolo documento + MIME:
 *   - drawing → drawingExtraction.service (vision)
 *   - capitolato/order + PDF → caseTextAnalysis.service (testo)
 *
 * Riusa le stesse tabelle di persistenza (migr. 101/116) e la semantica
 * idempotente "ultima estrazione vince" per attachment_id.
 */

'use strict';

const fs = require('fs').promises;
const { query } = require('../config/database');
const logger = require('../utils/logger');
const drawingExtractionService = require('./drawingExtraction.service');
const caseTextAnalysisService = require('./caseTextAnalysis.service');
const { getActiveProvider } = require('./aiProviderAdapter');
const caseCapabilityGapReportService = require('./caseCapabilityGapReport.service');

/** Ruoli ammessi in catalogazione allegati caso (VC-2). */
const CATALOG_DOC_ROLES = Object.freeze([
    'order',
    'rfq',
    'capitolato',
    'quote',
    'drawing',
    'other',
]);
const CATALOG_DOC_ROLE_SET = new Set(CATALOG_DOC_ROLES);

/**
 * Allegato catalogato = ruolo non vuoto e nella whitelist.
 * @param {string|null|undefined} docRole
 * @returns {boolean}
 */
function isCatalogedDocRole(docRole) {
    const role = String(docRole || '').trim().toLowerCase();
    return role.length > 0 && CATALOG_DOC_ROLE_SET.has(role);
}

/**
 * @param {string|null|undefined} docRole
 * @param {string|null|undefined} mimeType
 * @returns {'drawing'|'text'|null}
 */
function resolveAnalysisSource(docRole, mimeType) {
    if (!isCatalogedDocRole(docRole)) return null;
    const mime = String(mimeType || '').toLowerCase();
    const role = String(docRole || '').trim().toLowerCase();
    if (role === 'drawing') return 'drawing';
    if ((role === 'capitolato' || role === 'order') && mime === 'application/pdf') return 'text';
    return null;
}

async function insertRequirements(extractionId, requirements) {
    for (const r of requirements || []) {
        await query(
            `
            INSERT INTO commercial_case_extracted_requirements
              (extraction_id, req_type, field_key, value_text, unit, confidence, source_bbox)
            VALUES
              (@extractionId, @reqType, @fieldKey, @valueText, @unit, @confidence, @sourceBbox)
            `,
            {
                extractionId,
                reqType: r.req_type,
                fieldKey: r.field_key ?? null,
                valueText: r.value_text ?? null,
                unit: r.unit ?? null,
                confidence: r.confidence ?? null,
                sourceBbox: r.source_bbox ?? null,
            },
        );
    }
}

async function clearPreviousExtractions(caseId, attachmentId) {
    await query(
        `
        DELETE r
        FROM commercial_case_extracted_requirements r
        INNER JOIN commercial_case_drawing_extractions e ON e.id = r.extraction_id
        WHERE e.case_id = @caseId AND e.attachment_id = @attachmentId
        `,
        { caseId, attachmentId },
    );
    await query(
        `
        DELETE FROM commercial_case_drawing_extractions
        WHERE case_id = @caseId AND attachment_id = @attachmentId
        `,
        { caseId, attachmentId },
    );
}

async function runExtractionPipeline({ extractionId, buffer, mimeType, source }) {
    let out;
    if (source === 'drawing') {
        out = await drawingExtractionService.extractFromFile(buffer, mimeType, {});
    } else {
        out = await caseTextAnalysisService.extractTextRequirements(buffer, mimeType, {});
    }

    await insertRequirements(extractionId, out.requirements || []);

    await query(
        `
        UPDATE commercial_case_drawing_extractions
        SET status = 'done', raw_response = @raw, completed_at = SYSDATETIME()
        WHERE id = @extractionId
        `,
        {
            extractionId,
            raw: out.raw != null ? String(out.raw).substring(0, 1000000) : null,
        },
    );

    return out;
}

async function markExtractionError(extractionId, err) {
    const msg = err && err.code ? `${err.code}: ${err.message}` : (err && err.message) || 'Errore sconosciuto';
    try {
        await query(
            `
            UPDATE commercial_case_drawing_extractions
            SET status = 'error', error_message = @msg, completed_at = SYSDATETIME()
            WHERE id = @extractionId
            `,
            { extractionId, msg: String(msg).substring(0, 4000) },
        );
    } catch { /* best effort */ }
}

/**
 * Avvia analisi AI su un singolo allegato.
 *
 * @param {object} params
 * @param {'async'|'sync'} [params.mode='async']
 * @returns {Promise<{ attachment_id, extraction_id, source, status, error_message?, requirements_count? }|null>}
 */
async function analyzeAttachment({
    caseId,
    attachmentId,
    organizationId,
    userId,
    mode = 'async',
    force = true,
}) {
    const attRes = await query(
        `
        SELECT a.attachment_id, a.storage_path, a.mime_type, a.file_name, a.commercial_doc_role
        FROM attachments a
        INNER JOIN commercial_cases c ON c.id = a.commercial_case_id
        WHERE a.attachment_id = @attachmentId
          AND a.commercial_case_id = @caseId
          AND c.organization_id = @organizationId
        `,
        { attachmentId, caseId, organizationId },
    );
    const att = attRes.recordset[0];
    if (!att) return null;

    const source = resolveAnalysisSource(att.commercial_doc_role, att.mime_type);
    if (!source) return null;

    if (force) {
        await clearPreviousExtractions(caseId, attachmentId);
    }

    const provider = source === 'drawing'
        ? drawingExtractionService.resolveProvider()
        : (getActiveProvider() || 'gemini');

    const ins = await query(
        `
        INSERT INTO commercial_case_drawing_extractions
          (organization_id, case_id, attachment_id, provider, source, status, created_by)
        OUTPUT INSERTED.id
        VALUES (@organizationId, @caseId, @attachmentId, @provider, @source, 'processing', @userId)
        `,
        { organizationId, caseId, attachmentId, provider, source, userId },
    );
    const extractionId = ins.recordset[0].id;

    const execute = async () => {
        try {
            let buffer;
            try {
                buffer = await fs.readFile(att.storage_path);
            } catch {
                throw Object.assign(new Error('File non disponibile sul server'), { code: 'FILE_NOT_FOUND' });
            }
            const out = await runExtractionPipeline({
                extractionId,
                buffer,
                mimeType: att.mime_type,
                source,
            });
            logger.info('caseDocumentAnalysis: completata', {
                extractionId,
                source,
                caseId,
                attachmentId,
                count: (out.requirements || []).length,
            });
            // VC-3: refresh snapshot report studio (best-effort; non blocca l'analisi)
            const reportRefresh = await caseCapabilityGapReportService.maybeRefreshCapabilityGapReport({
                caseId,
                organizationId,
            });
            return {
                attachment_id: attachmentId,
                extraction_id: extractionId,
                source,
                status: 'done',
                requirements_count: (out.requirements || []).length,
                report_refresh: reportRefresh,
            };
        } catch (err) {
            await markExtractionError(extractionId, err);
            logger.error('caseDocumentAnalysis: errore', {
                extractionId,
                source,
                caseId,
                attachmentId,
                msg: err.message,
            });
            return {
                attachment_id: attachmentId,
                extraction_id: extractionId,
                source,
                status: 'error',
                error_message: err.message,
            };
        }
    };

    if (mode === 'sync') {
        return execute();
    }

    Promise.resolve().then(execute).catch(() => { /* già gestito in execute */ });

    return {
        attachment_id: attachmentId,
        extraction_id: extractionId,
        source,
        status: 'processing',
        file_name: att.file_name,
    };
}

/**
 * Orchestrazione su tutti gli allegati analizzabili della commessa.
 *
 * @returns {Promise<{ case_id, started, skipped, jobs, skipped_attachments }>}
 */
async function analyzeAllCaseDocuments({
    caseId,
    organizationId,
    userId,
    mode = 'async',
    force = true,
    attachmentIds = null,
}) {
    const caseRes = await query(
        `SELECT id FROM commercial_cases WHERE id = @caseId AND organization_id = @organizationId`,
        { caseId, organizationId },
    );
    if (!caseRes.recordset.length) {
        const e = new Error('Caso non trovato');
        e.code = 'NOT_FOUND';
        throw e;
    }

    const attRes = await query(
        `
        SELECT attachment_id, file_name, mime_type, commercial_doc_role
        FROM attachments
        WHERE commercial_case_id = @caseId
        ORDER BY created_at ASC
        `,
        { caseId },
    );

    let attachments = attRes.recordset || [];
    if (Array.isArray(attachmentIds) && attachmentIds.length) {
        const wanted = new Set(attachmentIds.map((id) => parseInt(String(id), 10)).filter(Boolean));
        attachments = attachments.filter((a) => wanted.has(a.attachment_id));
    }

    const jobs = [];
    const skipped = [];

    for (const att of attachments) {
        if (!isCatalogedDocRole(att.commercial_doc_role)) {
            skipped.push({
                attachment_id: att.attachment_id,
                file_name: att.file_name,
                reason: 'non catalogato (ruolo mancante)',
            });
            continue;
        }
        const source = resolveAnalysisSource(att.commercial_doc_role, att.mime_type);
        if (!source) {
            skipped.push({
                attachment_id: att.attachment_id,
                file_name: att.file_name,
                reason: 'ruolo o formato non analizzabile',
            });
            continue;
        }

        const job = await analyzeAttachment({
            caseId,
            attachmentId: att.attachment_id,
            organizationId,
            userId,
            mode,
            force,
        });
        if (job) jobs.push(job);
    }

    return {
        case_id: caseId,
        started: jobs.length,
        skipped: skipped.length,
        jobs,
        skipped_attachments: skipped,
    };
}

module.exports = {
    CATALOG_DOC_ROLES,
    isCatalogedDocRole,
    resolveAnalysisSource,
    analyzeAttachment,
    analyzeAllCaseDocuments,
};
