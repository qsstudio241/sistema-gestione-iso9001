/**
 * wpqrIngest.service.js
 * Ingestion automatica WPQR da PDF — pipeline IG-2 + staging IG-3.
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

function calcThicknessRange(t) {
    if (!t || t <= 0) return { thickness_min: null, thickness_max: null };
    const tNum = parseFloat(t);
    let minT;
    let maxT;
    if (tNum <= 3) {
        minT = tNum;
        maxT = 2 * tNum;
    } else if (tNum <= 12) {
        minT = 3;
        maxT = 2 * tNum;
    } else {
        minT = Math.max(0.5 * tNum, 5);
        maxT = Math.min(2 * tNum, 200);
    }
    return {
        thickness_min: parseFloat(minT.toFixed(2)),
        thickness_max: parseFloat(maxT.toFixed(2)),
    };
}

async function checkDuplicate(referenceNumber, organizationId, companyId) {
    if (!referenceNumber) return false;
    const result = await query(`
        SELECT id FROM wpqr_records
        WHERE organization_id = @organizationId
          AND company_id = @companyId
          AND (reference_number = @ref OR wpqr_code = @ref)
    `, { organizationId, companyId: companyId || null, ref: referenceNumber });
    return result.recordset.length > 0;
}

function buildCertificateFileUrl(filePath) {
    if (!filePath) return null;
    const uploadBase = process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve(__dirname, '../../uploads');
    return '/uploads/' + path.relative(uploadBase, filePath).replace(/\\/g, '/');
}

function mapPipelineFieldsToReview(f, fileName) {
    const referenceNumber = String(
        f.wpqr_number || f.reference_number || f.wpqr_code || fileName.replace(/\.[^/.]+$/, '')
    ).trim();

    const thicknessRaw = f.thickness_test_mm ?? f.thickness_tested;
    const thickness_tested = thicknessRaw != null && thicknessRaw !== '' ? parseFloat(thicknessRaw) : null;
    const { thickness_min, thickness_max } = calcThicknessRange(thickness_tested);

    return {
        wpqr_number: referenceNumber,
        reference_number: referenceNumber,
        welding_process: f.welding_process || null,
        material_group: f.material_group || f.base_material_group || null,
        thickness_test_mm: thickness_tested,
        approval_date: f.approval_date || f.issue_date || null,
        standard_reference: f.standard_reference || null,
        filler_material: f.filler_material || null,
        welding_positions: f.welding_positions || null,
        examiner_body: f.issuing_body || f.examiner_body || f.testing_body || null,
        welder_name: f.welder_name || null,
        expiry_date: f.expiry_date || null,
        certificate_number: f.certificate_number || null,
        pwht: f.pwht === true || f.pwht === 1 || f.pwht === '1',
        thickness_min,
        thickness_max,
    };
}

function mapReviewFieldsToDb(f, fileName) {
    const referenceNumber = String(
        f.wpqr_number || f.reference_number || f.wpqr_code || fileName.replace(/\.[^/.]+$/, '')
    ).trim();

    const thicknessRaw = f.thickness_test_mm ?? f.thickness_tested;
    const thickness_tested = thicknessRaw != null && thicknessRaw !== '' ? parseFloat(thicknessRaw) : null;
    const { thickness_min, thickness_max } = calcThicknessRange(thickness_tested);

    return {
        reference_number: referenceNumber,
        welding_process: f.welding_process || null,
        base_material_group: f.material_group || f.base_material_group || null,
        filler_material: f.filler_material || null,
        thickness_tested,
        thickness_min: f.thickness_min ?? thickness_min,
        thickness_max: f.thickness_max ?? thickness_max,
        welding_positions: f.welding_positions || null,
        examiner_body: f.examiner_body || f.issuing_body || f.testing_body || null,
        welder_name: f.welder_name || null,
        issue_date: f.approval_date || f.issue_date || null,
        expiry_date: f.expiry_date || null,
        certificate_number: f.certificate_number || null,
        pwht: f.pwht === true || f.pwht === 1 || f.pwht === '1' ? 1 : 0,
    };
}

async function extractWPQRFromPdf(pdfBuffer, fileName, organizationId, companyId) {
    const pipeline = await runDocumentIngest({
        pdfBuffer,
        docType: 'wpqr',
        fileName,
        organizationId,
    });
    const warnings = [...pipeline.warnings];
    const reviewFields = mapPipelineFieldsToReview(pipeline.fields || {}, fileName);

    if (pipeline.text.length > 30) {
        const docClass = classifyDocument(pipeline.text);
        logger.info('WPQR doc classification', {
            fileName,
            detected_type: docClass.detected_type,
            confidence: docClass.confidence,
        });

        if (WRONG_MODULE_FOR_WPQR.has(docClass.detected_type) && docClass.confidence !== 'low') {
            return {
                status: 'wrong_module',
                detected_type: docClass.detected_type,
                message: WRONG_MODULE_MESSAGES[docClass.detected_type],
                suggested_module: SUGGESTED_MODULE[docClass.detected_type],
            };
        }

        if (docClass.detected_type === 'unknown') {
            warnings.push('Tipo documento non riconosciuto — verificare i dati estratti');
        } else if ((docClass.detected_type === 'wpqr' || docClass.detected_type === 'wps') && docClass.confidence === 'low') {
            warnings.push('Tipo documento incerto — verificare che sia una WPQR');
        }
    }

    if (!reviewFields.reference_number) {
        warnings.push('Numero WPQR non trovato — inserirlo manualmente in revisione');
    }

    if (reviewFields.thickness_test_mm && !reviewFields.thickness_min) {
        warnings.push('Spessore testato non riconoscibile — range non calcolato');
    }

    if (reviewFields.reference_number && await checkDuplicate(reviewFields.reference_number, organizationId, companyId)) {
        return {
            status: 'duplicate',
            reference_number: reviewFields.reference_number,
            warnings,
            fields: reviewFields,
            field_confidence: pipeline.fieldConfidence,
        };
    }

    const confidence = pipeline.extractionConfidence >= 70 ? 'alta'
        : pipeline.aiModel ? 'media' : 'bassa';

    return {
        status: 'pending_review',
        fields: reviewFields,
        field_confidence: pipeline.fieldConfidence,
        confidence,
        warnings,
        ai_model: pipeline.aiModel,
    };
}

async function commitWPQRFromFields(fields, organizationId, companyId, options = {}) {
    const { userId = null, filePath = null, fileName = '' } = options;
    const mapped = mapReviewFieldsToDb(fields, fileName);
    const warnings = [];

    if (!mapped.reference_number) {
        const err = new Error('Numero WPQR obbligatorio');
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    if (await checkDuplicate(mapped.reference_number, organizationId, companyId)) {
        const err = new Error(`WPQR ${mapped.reference_number} già presente`);
        err.code = 'DUPLICATE';
        err.warnings = [`Duplicato: WPQR ${mapped.reference_number} già presente.`];
        throw err;
    }

    const certificate_file_url = buildCertificateFileUrl(filePath);

    const insertResult = await query(`
        INSERT INTO wpqr_records (
            organization_id, company_id,
            reference_number, wpqr_code,
            welding_process, base_material_group, filler_material,
            thickness_tested, thickness_min, thickness_max,
            welding_positions, examiner_body, testing_body,
            welder_name, issue_date, expiry_date,
            certificate_number, certificate_file_url,
            pwht, approval_status, status,
            created_by, created_at, updated_at
        )
        OUTPUT INSERTED.id
        VALUES (
            @organization_id, @company_id,
            @reference_number, @reference_number,
            @welding_process, @base_material_group, @filler_material,
            @thickness_tested, @thickness_min, @thickness_max,
            @welding_positions, @examiner_body, @examiner_body,
            @welder_name, @issue_date, @expiry_date,
            @certificate_number, @certificate_file_url,
            @pwht, 'bozza', 'attiva',
            @created_by, GETDATE(), GETDATE()
        )
    `, {
        organization_id: organizationId,
        company_id: companyId || null,
        reference_number: mapped.reference_number,
        welding_process: mapped.welding_process,
        base_material_group: mapped.base_material_group,
        filler_material: mapped.filler_material,
        thickness_tested: mapped.thickness_tested,
        thickness_min: mapped.thickness_min,
        thickness_max: mapped.thickness_max,
        welding_positions: mapped.welding_positions,
        examiner_body: mapped.examiner_body,
        welder_name: mapped.welder_name,
        issue_date: mapped.issue_date,
        expiry_date: mapped.expiry_date,
        certificate_number: mapped.certificate_number,
        certificate_file_url,
        pwht: mapped.pwht,
        created_by: userId,
    });

    const wpqrId = insertResult.recordset[0].id;
    logger.info('WPQR committed from staging', { wpqrId, reference_number: mapped.reference_number, organizationId });

    return {
        wpqr_id: wpqrId,
        reference_number: mapped.reference_number,
        welding_process: mapped.welding_process,
        thickness_tested: mapped.thickness_tested,
        thickness_min: mapped.thickness_min,
        thickness_max: mapped.thickness_max,
        warnings,
    };
}

async function ingestWPQRFromPdf(pdfBuffer, fileName, organizationId, companyId, options = {}) {
    const extracted = await extractWPQRFromPdf(pdfBuffer, fileName, organizationId, companyId);
    if (extracted.status === 'wrong_module') return extracted;
    if (extracted.status === 'duplicate') {
        return { status: 'duplicate', reference_number: extracted.reference_number, warnings: extracted.warnings };
    }

    const committed = await commitWPQRFromFields(
        extracted.fields,
        organizationId,
        companyId,
        { ...options, fileName },
    );

    return {
        status: 'ok',
        ...committed,
        confidence: extracted.confidence,
        field_confidence: extracted.field_confidence,
        warnings: [...(extracted.warnings || []), ...(committed.warnings || [])],
    };
}

module.exports = {
    ingestWPQRFromPdf,
    extractWPQRFromPdf,
    commitWPQRFromFields,
    calcThicknessRange,
    mapPipelineFieldsToReview,
};
