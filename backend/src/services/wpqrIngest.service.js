/**
 * wpqrIngest.service.js
 * Ingestion automatica WPQR da PDF — delega estrazione a documentIngestPipeline (IG-2).
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

/**
 * @param {Buffer} pdfBuffer
 * @param {string} fileName
 * @param {number} organizationId
 * @param {number|null} companyId
 * @param {object} options — { userId, filePath }
 */
async function ingestWPQRFromPdf(pdfBuffer, fileName, organizationId, companyId, options = {}) {
    const { userId = null, filePath = null } = options;

    const pipeline = await runDocumentIngest({
        pdfBuffer,
        docType: 'wpqr',
        fileName,
        organizationId,
    });
    const warnings = [...pipeline.warnings];
    const f = pipeline.fields || {};

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

    const referenceNumber = String(
        f.wpqr_number || f.reference_number || f.wpqr_code || fileName.replace(/\.[^/.]+$/, '')
    ).trim();

    const welding_process = f.welding_process || null;
    const base_material_group = f.material_group || f.base_material_group || null;
    const filler_material = f.filler_material || null;
    const thicknessRaw = f.thickness_test_mm ?? f.thickness_tested;
    const thickness_tested = thicknessRaw != null && thicknessRaw !== '' ? parseFloat(thicknessRaw) : null;
    const welding_positions = f.welding_positions || null;
    const examiner_body = f.issuing_body || f.examiner_body || f.testing_body || null;
    const welder_name = f.welder_name || null;
    const issue_date = f.approval_date || f.issue_date || null;
    const expiry_date = f.expiry_date || null;
    const certificate_number = f.certificate_number || null;
    const pwht = f.pwht === true || f.pwht === 1 || f.pwht === '1' ? 1 : 0;

    const { thickness_min, thickness_max } = calcThicknessRange(thickness_tested);
    if (thickness_tested && !thickness_min) {
        warnings.push('Spessore testato non riconoscibile — range non calcolato');
    }

    if (!referenceNumber) {
        throw new Error('reference_number obbligatorio: non trovato nel documento');
    }

    if (await checkDuplicate(referenceNumber, organizationId, companyId)) {
        return { status: 'duplicate', reference_number: referenceNumber, warnings };
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
        reference_number: referenceNumber,
        welding_process,
        base_material_group,
        filler_material,
        thickness_tested,
        thickness_min,
        thickness_max,
        welding_positions,
        examiner_body,
        welder_name,
        issue_date,
        expiry_date,
        certificate_number,
        certificate_file_url,
        pwht,
        created_by: userId,
    });

    const wpqrId = insertResult.recordset[0].id;
    const confidence = pipeline.extractionConfidence >= 70 ? 'alta'
        : pipeline.aiModel ? 'media' : 'bassa';

    logger.info('WPQR ingested from PDF', { wpqrId, reference_number: referenceNumber, organizationId });

    return {
        wpqr_id: wpqrId,
        reference_number: referenceNumber,
        welding_process,
        thickness_tested,
        thickness_min,
        thickness_max,
        confidence,
        field_confidence: pipeline.fieldConfidence,
        warnings,
    };
}

module.exports = { ingestWPQRFromPdf, calcThicknessRange };
