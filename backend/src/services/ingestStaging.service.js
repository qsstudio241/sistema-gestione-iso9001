/**
 * ingestStaging.service.js — staging revisione pre-commit (IG-3)
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { query } = require('../config/database');
const { commitWPQRFromFields } = require('./wpqrIngest.service');
const { commitQualificationFromFields } = require('./qualificationIngest.service');

const DOC_TYPE_MODULES = {
    wpqr: 'saldatura',
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

/**
 * @param {object} params
 */
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
    } = params;

    const insertResult = await query(`
        INSERT INTO ingest_staging (
            organization_id, company_id, doc_type,
            original_name, storage_path, mime_type, file_size,
            staged_fields_json, field_confidence_json, warnings_json,
            qualification_type, review_status, created_by
        )
        OUTPUT INSERTED.id
        VALUES (
            @organizationId, @companyId, @docType,
            @originalName, @storagePath, @mimeType, @fileSize,
            @stagedFieldsJson, @fieldConfidenceJson, @warningsJson,
            @qualificationType, 'pending', @userId
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

    const fields = { ...parseJson(row.staged_fields_json, {}), ...fieldsOverride };
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

    if (commitResult.status === 'duplicate') {
        return {
            status: 'duplicate',
            staging_id: stagingId,
            warnings: commitResult.warnings || [],
        };
    }

    await query(`
        UPDATE ingest_staging
        SET review_status = 'confirmed',
            reviewed_by = @userId,
            reviewed_at = GETDATE(),
            staged_fields_json = @stagedFieldsJson,
            committed_wpqr_id = @wpqrId,
            committed_qualification_id = @qualificationId
        WHERE id = @id AND organization_id = @organizationId
    `, {
        id: stagingId,
        organizationId,
        userId,
        stagedFieldsJson: JSON.stringify(fields),
        wpqrId: commitResult.wpqr_id || null,
        qualificationId: commitResult.qualification_id || null,
    });

    logger.info('[IngestStaging] Confermato', {
        stagingId,
        docType: row.doc_type,
        organizationId,
    });

    return {
        status: 'confirmed',
        staging_id: stagingId,
        doc_type: row.doc_type,
        warnings,
        ...commitResult,
    };
}

async function rejectStaging(stagingId, organizationId, userId, deleteFile = true) {
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

    await query(`
        UPDATE ingest_staging
        SET review_status = 'rejected',
            reviewed_by = @userId,
            reviewed_at = GETDATE()
        WHERE id = @id AND organization_id = @organizationId
    `, { id: stagingId, organizationId, userId });

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

module.exports = {
    createStagingRecord,
    getStagingById,
    confirmStaging,
    rejectStaging,
    getModuleForDocType,
    parseJson,
};
