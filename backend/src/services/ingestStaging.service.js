/**
 * ingestStaging.service.js — staging revisione pre-commit (IG-3) + feedback IG-4
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { query } = require('../config/database');
const { commitWPQRFromFields, applyFieldReprocessUpdate: applyWpqrFieldReprocessUpdate } = require('./wpqrIngest.service');
const { commitQualificationFromFields, applyFieldReprocessUpdate: applyQualificationFieldReprocessUpdate } = require('./qualificationIngest.service');
const { commitWPSFromFields } = require('./wpsIngest.service');
const { commitNormFromFields, applyNormToExistingDocument } = require('./normIngest.service');
const { recordFeedback } = require('./ingestFeedback.service');

const DOC_TYPE_MODULES = {
    wpqr: 'saldatura',
    wps: 'saldatura',
    patentino_saldatore: 'qualifiche',
    qualifica_14732: 'qualifiche',
    norma: 'documents',
};

// Tipi documento che confluiscono nella tabella qualifications (stesso commit di patentino_saldatore).
// cert_ndt (ISO 9712) confluisce in qualifications con i campi ndt_method/level/sector
const QUALIFICATION_DOC_TYPES = new Set(['patentino_saldatore', 'qualifica_14732', 'cert_ndt']);

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
        // Modalità rielaborazione (backfill, migrazioni 137/143): quando
        // valorizzati, la conferma di questo staging NON crea un nuovo record
        // ma aggiorna solo i campi in fieldScope sul record esistente
        // (qualifica o WPQR — SOLO uno dei due è valorizzato per riga).
        targetQualificationId = null,
        targetWpqrId = null,
        fieldScope = null,
    } = params;

    const insertResult = await query(`
        INSERT INTO ingest_staging (
            organization_id, company_id, doc_type,
            original_name, storage_path, mime_type, file_size,
            staged_fields_json, field_confidence_json, warnings_json,
            qualification_type, review_status, created_by, ai_model,
            target_qualification_id, target_wpqr_id, field_scope
        )
        OUTPUT INSERTED.id
        VALUES (
            @organizationId, @companyId, @docType,
            @originalName, @storagePath, @mimeType, @fileSize,
            @stagedFieldsJson, @fieldConfidenceJson, @warningsJson,
            @qualificationType, 'pending', @userId, @aiModel,
            @targetQualificationId, @targetWpqrId, @fieldScope
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
        targetQualificationId: targetQualificationId || null,
        targetWpqrId: targetWpqrId || null,
        fieldScope: fieldScope || null,
    });

    return insertResult.recordset[0].id;
}

async function confirmStaging(stagingId, organizationId, userId, fieldsOverride = {}, user = null) {
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
        if (row.target_qualification_id) {
            // Modalità rielaborazione (backfill campo su qualifica esistente,
            // migrazione 137): MAI una nuova INSERT, solo UPDATE mirato ai campi
            // in field_scope — vedi backend/scripts/reprocess-qualifications.js.
            const updateResult = await applyQualificationFieldReprocessUpdate(
                row.target_qualification_id,
                organizationId,
                row.field_scope,
                fields,
            );
            commitResult = {
                qualification_id: updateResult.qualification_id,
                updated_fields: updateResult.updated_fields,
            };
        } else if (row.target_wpqr_id) {
            // Modalità rielaborazione su WPQR esistente (migrazione 143,
            // generalizzazione 08/08/2026 dello stesso pattern) — MAI una
            // nuova INSERT, solo UPDATE mirato ai campi in field_scope.
            const updateResult = await applyWpqrFieldReprocessUpdate(
                row.target_wpqr_id,
                organizationId,
                row.field_scope,
                fields,
            );
            commitResult = {
                wpqr_id: updateResult.wpqr_id,
                updated_fields: updateResult.updated_fields,
            };
        } else if (row.doc_type === 'wpqr') {
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
        } else if (QUALIFICATION_DOC_TYPES.has(row.doc_type)) {
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
        } else if (row.doc_type === 'norma') {
            const meta = parseJson(row.staged_fields_json, {});
            const targetDocId = parseInt(meta._target_document_id, 10);
            const normOpts = {
                userId,
                user,
                filePath: row.storage_path,
                fileName: row.original_name,
                parentFolderId: meta._parent_folder_id ?? null,
                expectedFolderId: meta._parent_folder_id ?? null,
                extractedText: meta._extracted_text ?? null,
                textQuality: meta._text_quality ?? null,
                mimeType: row.mime_type,
                fileSize: row.file_size,
            };
            if (Number.isFinite(targetDocId)) {
                commitResult = await applyNormToExistingDocument(
                    targetDocId,
                    fields,
                    organizationId,
                    normOpts,
                );
            } else {
                commitResult = await commitNormFromFields(
                    fields,
                    organizationId,
                    normOpts,
                );
            }
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

    // In modalità rielaborazione (target_qualification_id o target_wpqr_id
    // valorizzato) lo storage_path NON è un file temporaneo di upload: è il
    // certificato già collegato a un record esistente (certificate_file_url).
    // Cancellarlo romperebbe il record definitivo — va preservato sempre, a
    // prescindere dal flag deleteFile richiesto dal chiamante.
    const stagedMeta = parseJson(row.staged_fields_json, {});
    const preservesRegistryFile = Boolean(
        row.target_qualification_id
        || row.target_wpqr_id
        || stagedMeta._target_document_id,
    );
    if (deleteFile && row.storage_path && !preservesRegistryFile) {
        try {
            fs.unlinkSync(row.storage_path);
        } catch (_) {
            /* file già rimosso */
        }
    }

    logger.info('[IngestStaging] Scartato', { stagingId, organizationId });
    return { status: 'rejected', staging_id: stagingId };
}

/**
 * Lista voci di ingest_staging per organizzazione — usata dalla coda di
 * revisione (sia upload normali pending sia proposte di rielaborazione,
 * migrazione 137). `reprocessOnly` filtra solo le proposte di aggiornamento
 * su qualifiche esistenti (target_qualification_id valorizzato).
 */
async function listStaging({ organizationId, reviewStatus = 'pending', docType = null, docTypes = null, reprocessOnly = false, limit = 100 }) {
    const conditions = ['organization_id = @organizationId'];
    const params = { organizationId, limit };
    if (reviewStatus) {
        conditions.push('review_status = @reviewStatus');
        params.reviewStatus = reviewStatus;
    }
    if (docType) {
        conditions.push('doc_type = @docType');
        params.docType = docType;
    } else if (Array.isArray(docTypes) && docTypes.length) {
        const placeholders = docTypes.map((_, i) => `@docType${i}`).join(',');
        docTypes.forEach((dt, i) => { params[`docType${i}`] = dt; });
        conditions.push(`doc_type IN (${placeholders})`);
    }
    if (reprocessOnly) {
        conditions.push('(target_qualification_id IS NOT NULL OR target_wpqr_id IS NOT NULL)');
    }

    const result = await query(`
        SELECT TOP (@limit)
            id, doc_type, original_name, review_status, qualification_type,
            target_qualification_id, target_wpqr_id, field_scope, staged_fields_json,
            warnings_json, created_at
        FROM ingest_staging
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
    `, params);

    return (result.recordset || []).map((row) => ({
        id: row.id,
        doc_type: row.doc_type,
        original_name: row.original_name,
        review_status: row.review_status,
        qualification_type: row.qualification_type,
        target_qualification_id: row.target_qualification_id,
        target_wpqr_id: row.target_wpqr_id,
        field_scope: row.field_scope,
        fields: parseJson(row.staged_fields_json, {}),
        warnings: parseJson(row.warnings_json, []),
        created_at: row.created_at,
        is_reprocess: !!(row.target_qualification_id || row.target_wpqr_id),
    }));
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
    listStaging,
    confirmStaging,
    rejectStaging,
    getModuleForDocType,
    resolveStagingFilePath,
    parseJson,
};
