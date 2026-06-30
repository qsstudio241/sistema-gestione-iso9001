/**
 * wpsIngest.service.js — ingest WPS da PDF (IG-6) su pipeline unificata
 */

const path = require('path');
const logger = require('../utils/logger');
const { query } = require('../config/database');
const { runDocumentIngest } = require('./documentIngestPipeline.service');
const {
    classifyDocument,
    WRONG_MODULE_FOR_WPQR,
    WRONG_MODULE_MESSAGES,
    SUGGESTED_MODULE,
} = require('../utils/documentClassifier');

async function checkDuplicate(wpsCode, organizationId, companyId) {
    if (!wpsCode) return false;
    const result = await query(`
        SELECT id FROM welding_procedures
        WHERE organization_id = @organizationId
          AND company_id = @companyId
          AND wps_code = @wpsCode
    `, { organizationId, companyId: companyId || null, wpsCode });
    return result.recordset.length > 0;
}

function buildFileUrl(filePath) {
    if (!filePath) return null;
    const uploadBase = process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve(__dirname, '../../uploads');
    return '/uploads/' + path.relative(uploadBase, filePath).replace(/\\/g, '/');
}

function mapPipelineFieldsToReview(f, fileName) {
    const wpsCode = String(f.wps_number || f.wps_code || fileName.replace(/\.[^/.]+$/, '')).trim();
    return {
        wps_number: wpsCode,
        wps_code: wpsCode,
        welding_process: f.welding_process || null,
        base_material: f.base_material || f.material_group || null,
        material_group: f.material_group || f.base_material || null,
        thickness_min_mm: f.thickness_min_mm ?? null,
        thickness_max_mm: f.thickness_max_mm ?? null,
        wpqr_ref: f.wpqr_ref || null,
        qualification_standard: f.qualification_standard || f.standard_reference || null,
    };
}

function mapReviewFieldsToDb(f, fileName) {
    const wpsCode = String(f.wps_number || f.wps_code || fileName.replace(/\.[^/.]+$/, '')).trim();
    return {
        wps_code: wpsCode,
        welding_process: f.welding_process || null,
        material_group: f.material_group || f.base_material || null,
        thickness_range_min: f.thickness_min_mm != null ? parseFloat(f.thickness_min_mm) : null,
        thickness_range_max: f.thickness_max_mm != null ? parseFloat(f.thickness_max_mm) : null,
        qualification_standard: f.qualification_standard || f.wpqr_ref || null,
    };
}

async function extractWPSFromPdf(pdfBuffer, fileName, organizationId, companyId) {
    const pipeline = await runDocumentIngest({
        pdfBuffer,
        docType: 'wps',
        fileName,
        organizationId,
    });
    const warnings = [...pipeline.warnings];
    const reviewFields = mapPipelineFieldsToReview(pipeline.fields || {}, fileName);

    if (pipeline.text.length > 30) {
        const docClass = classifyDocument(pipeline.text);
        if (docClass.detected_type === 'wpqr' && docClass.confidence === 'high') {
            return {
                status: 'wrong_module',
                detected_type: docClass.detected_type,
                message: WRONG_MODULE_MESSAGES.wpqr || 'Documento sembra una WPQR, non una WPS.',
                suggested_module: SUGGESTED_MODULE.wpqr,
            };
        }
        if (WRONG_MODULE_FOR_WPQR.has(docClass.detected_type) && docClass.confidence === 'high' && docClass.detected_type !== 'wps') {
            return {
                status: 'wrong_module',
                detected_type: docClass.detected_type,
                message: WRONG_MODULE_MESSAGES[docClass.detected_type] || 'Tipo documento non compatibile con WPS.',
                suggested_module: SUGGESTED_MODULE[docClass.detected_type],
            };
        }
    }

    if (!reviewFields.wps_code) {
        warnings.push('Codice WPS non trovato — inserirlo manualmente in revisione');
    }

    if (reviewFields.wps_code && await checkDuplicate(reviewFields.wps_code, organizationId, companyId)) {
        return {
            status: 'duplicate',
            wps_code: reviewFields.wps_code,
            warnings,
            fields: reviewFields,
            field_confidence: pipeline.fieldConfidence,
        };
    }

    return {
        status: 'pending_review',
        fields: reviewFields,
        field_confidence: pipeline.fieldConfidence,
        confidence: pipeline.extractionConfidence >= 70 ? 'alta' : pipeline.aiModel ? 'media' : 'bassa',
        warnings,
        ai_model: pipeline.aiModel,
    };
}

async function commitWPSFromFields(fields, organizationId, companyId, options = {}) {
    const { userId = null, fileName = '' } = options;
    const mapped = mapReviewFieldsToDb(fields, fileName);

    if (!mapped.wps_code) {
        const err = new Error('Codice WPS obbligatorio');
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    if (await checkDuplicate(mapped.wps_code, organizationId, companyId)) {
        const err = new Error(`WPS ${mapped.wps_code} già presente`);
        err.code = 'DUPLICATE';
        err.warnings = [`Duplicato: WPS ${mapped.wps_code} già presente.`];
        throw err;
    }

    const insertResult = await query(`
        INSERT INTO welding_procedures (
            organization_id, company_id, wps_code, revision,
            welding_process, material_group,
            thickness_range_min, thickness_range_max,
            qualification_standard, status,
            created_by, created_at, updated_at
        )
        OUTPUT INSERTED.id
        VALUES (
            @organization_id, @company_id, @wps_code, NULL,
            @welding_process, @material_group,
            @thickness_range_min, @thickness_range_max,
            @qualification_standard, 'bozza',
            @created_by, GETDATE(), GETDATE()
        )
    `, {
        organization_id: organizationId,
        company_id: companyId || null,
        wps_code: mapped.wps_code,
        welding_process: mapped.welding_process,
        material_group: mapped.material_group,
        thickness_range_min: mapped.thickness_range_min,
        thickness_range_max: mapped.thickness_range_max,
        qualification_standard: mapped.qualification_standard,
        created_by: userId,
    });

    const wpsId = insertResult.recordset[0].id;
    logger.info('WPS committed from staging', { wpsId, wps_code: mapped.wps_code, organizationId });

    return {
        wps_id: wpsId,
        wps_code: mapped.wps_code,
        welding_process: mapped.welding_process,
        warnings: [],
    };
}

module.exports = {
    extractWPSFromPdf,
    commitWPSFromFields,
    mapPipelineFieldsToReview,
};
