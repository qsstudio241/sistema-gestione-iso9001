/**
 * ingestStaging.service.js — staging revisione pre-commit (IG-3) + feedback IG-4
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { query } = require('../config/database');
const { commitWPQRFromFields } = require('./wpqrIngest.service');
const { commitQualificationFromFields } = require('./qualificationIngest.service');
const { commitWPSFromFields } = require('./wpsIngest.service');
const { recordFeedback } = require('./ingestFeedback.service');

const DOC_TYPE_MODULES = {
    wpqr: 'saldatura',
    wps: 'saldatura',
    patentino_saldatore: 'qualifiche',
};

function parseJson(val, fallback = null) {
    if (val == null) return fallback;
    if (typeof val === 'object') return val;
    try {
        return JSON.parse(val);
    } catch {
        return fallback;
    }
}

async function getStagingById(stagingId, organizationId) {
    const result = await query(`
        SELECT *
        FROM ingest_staging
        WHERE id = @id AND organization_id = @organizationId
    `, { id: stagingId, organizationId });
    return result.recordset[0] || null;
}

async function createStagingRecord(params) {
    const {
        organizationId,
        companyId,
        docType,
        originalName,
        storagePath,
        mimeType,
        fileSize,
        fields,
        fieldConfidence,
        warnings,
        qualificationType,
        userId,
        aiModel = null,
    } = params;

    const insertResult = await query(`
        INSERT INTO ingest_staging (
            organization_id, company_id, doc_type,
            original_name, storage_path, mime_type, file_size,
            staged_fields_json, field_confidence_json, warnings_json,
            qualification_type, review_status, created_by, ai_model
        )
        OUTPUT INSERTED.id
        VALUES (
            @organizationId, @companyId, @docType,
            @originalName, @storagePath, @mimeType, @fileSize,
            @stagedFieldsJson, @fieldConfidenceJson, @warningsJson,
            @qualificationType, 'pending', @userId, @aiModel
        )
    `, {
        organizationId,
        companyId: companyId || null,
        docType,
        originalName,
        storagePath,
        mimeType: mimeType || null,
        fileSize: fileSize || null,
        stagedFieldsJson: JSON.stringify(fields || {}),
        fieldConfidenceJson: JSON.stringify(fieldConfidence || {}),
        warningsJson: JSON.stringify(warnings || []),
        qualificationType: qualificationType || null,
        userId: userId || null,
        aiModel: aiModel || null,
    });

    return insertResult.recordset[0].id;
}

async function confirmStaging(stagingId, organizationId, userId, fieldsOverride = {}) {
    const row = await getStagingById(stagingId, organizationId);
    if (!row) {
        const err = new Error('Staging non trovato');
        err.code = 'NOT_FOUND';
        throw err;
    }
    if (row.review_status !== 'pending') {
        const err = new Error(`Staging già ${row.review_status}`);
        err.code = 'INVALID_STATUS';
        throw err;
    }

    const aiPayload = parseJson(row.staged_fields_json, {});
    const fieldConfidence = parseJson(row.field_confidence_json, {});
    const fields = { ...aiPayload, ...fieldsOverride };
    const warnings = parseJson(row.warnings_json, []);

    let commitResult;
    try {
        if (row.doc_type === 'wpqr') {
            commitResult = await commitWPQRFromFields(
                fields,
                organizationId,
                row.company_id,
                { userId, filePath: row.storage_path, fileName: row.original_name },
            );
        } else if (row.doc_type === 'wps') {
            commitResult = await commitWPSFromFields(
                fields,
                organizationId,
                row.company_id,
                { userId, fileName: row.original_name },
            );
        } else if (row.doc_type === 'patentino_saldatore') {
            commitResult = await commitQualificationFromFields(
                fields,
                organizationId,
                row.company_id,
                {
                    userId,
                    filePath: row.storage_path,
                    fileName: row.original_name,
                    qualificationType: row.qualification_type,
                },
            );
        } else {
            const err = new Error(`Tipo documento non supportato: ${row.doc_type}`);
            err.code = 'UNSUPPORTED_DOC_TYPE';
            throw err;
        }
    } catch (commitErr) {
        if (commitErr.code === 'DUPLICATE') {
            return {
                status: 'duplicate',
                staging_id: stagingId,
                warnings: commitErr.warnings || [commitErr.message],
            };
        }
        throw commitErr;
    }

    await query(`
        UPDATE ingest_staging
        SET review_status = 'confirmed',
            reviewed_by = @userId,
            reviewed_at = GETDATE(),
            staged_fields_json = @stagedFieldsJson,
            committed_wpqr_id = @wpqrId,
            committed_qualification_id = @qualificationId,
            committed_wps_id = @wpsId
        WHERE id = @id AND organization_id = @organizationId
    `, {
        id: stagingId,
        organizationId,
        userId,
        stagedFieldsJson: JSON.stringify(fields),
        wpqrId: commitResult.wpqr_id || null,
        qualificationId: commitResult.qualification_id || null,
        wpsId: commitResult.wps_id || null,
    });

    try {
        await recordFeedback({
            organizationId,
            companyId: row.company_id,
            docType: row.doc_type,
            source: 'batch',
            action: 'accepted',
            aiPayload,
            humanPayload: fields,
            fieldConfidence,
            fileName: row.original_name,
            modelUsed: row.ai_model,
            stagingId,
            createdBy: userId,
        });
    } catch (fbErr) {
        logger.warn('[IngestStaging] Feedback non salvato', { error: fbErr.message, stagingId });
    }

    logger.info('[IngestStaging] Confermato', { stagingId, docType: row.doc_type, organizationId });

    return {
        status: 'confirmed',
        staging_id: stagingId,
        doc_type: row.doc_type,
        warnings,
        ...commitResult,
    };
}

async function rejectStaging(stagingId, organizationId, userId, deleteFile = true, rejectReason = null) {
    const row = await getStagingById(stagingId, organizationId);
    if (!row) {
        const err = new Error('Staging non trovato');
        err.code = 'NOT_FOUND';
        throw err;
    }
    if (row.review_status !== 'pending') {
        const err = new Error(`Staging già ${row.review_status}`);
        err.code = 'INVALID_STATUS';
        throw err;
    }

    const aiPayload = parseJson(row.staged_fields_json, {});
    const fieldConfidence = parseJson(row.field_confidence_json, {});

    await query(`
        UPDATE ingest_staging
        SET review_status = 'rejected',
            reviewed_by = @userId,
            reviewed_at = GETDATE()
        WHERE id = @id AND organization_id = @organizationId
    `, { id: stagingId, organizationId, userId });

    try {
        await recordFeedback({
            organizationId,
            companyId: row.company_id,
            docType: row.doc_type,
            source: 'batch',
            action: 'rejected',
            aiPayload,
            humanPayload: {},
            fieldConfidence,
            fileName: row.original_name,
            modelUsed: row.ai_model,
            stagingId,
            rejectReason,
            createdBy: userId,
        });
    } catch (fbErr) {
        logger.warn('[IngestStaging] Feedback scarto non salvato', { error: fbErr.message, stagingId });
    }

    if (deleteFile && row.storage_path) {
        try {
            fs.unlinkSync(row.storage_path);
        } catch (_) {
            /* file già rimosso */
        }
    }

    logger.info('[IngestStaging] Scartato', { stagingId, organizationId });
    return { status: 'rejected', staging_id: stagingId };
}

function getModuleForDocType(docType) {
    return DOC_TYPE_MODULES[docType] || null;
}

function resolveStagingFilePath(storagePath) {
    if (!storagePath || typeof storagePath !== 'string') {
        const err = new Error('File staging non disponibile');
        err.code = 'FILE_NOT_FOUND';
        throw err;
    }

    const uploadBase = path.resolve(
        process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
    );
    const resolved = path.resolve(storagePath);
    const relative = path.relative(uploadBase, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        const err = new Error('Percorso file non valido');
        err.code = 'FILE_FORBIDDEN';
        throw err;
    }
    if (!fs.existsSync(resolved)) {
        const err = new Error('File non trovato sul server');
        err.code = 'FILE_NOT_FOUND';
        throw err;
    }
    return resolved;
}

module.exports = {
    createStagingRecord,
    getStagingById,
    confirmStaging,
    rejectStaging,
    getModuleForDocType,
    resolveStagingFilePath,
    parseJson,
};
