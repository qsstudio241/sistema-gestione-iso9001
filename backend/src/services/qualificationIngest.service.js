/**
 * qualificationIngest.service.js
 * Ingestion qualifiche da PDF (patentini) — pipeline IG-2 + staging IG-3.
 */

const path = require('path');
const logger = require('../utils/logger');
const { getPool } = require('../config/database');
const { resolvePersonnelForQualification } = require('./personnelQualificationLink.service');
const { runDocumentIngest } = require('./documentIngestPipeline.service');
const {
    classifyDocument,
    WRONG_MODULE_FOR_QUALIFICATIONS,
    WRONG_MODULE_MESSAGES,
    SUGGESTED_MODULE,
} = require('../utils/documentClassifier');

const TYPE_RULES = [
    { pattern: /9606[\s-]?1/i,   type: 'Saldatore ISO 9606-1' },
    { pattern: /9606[\s-]?2/i,   type: 'Saldatore ISO 9606-2' },
    { pattern: /14732/i,          type: 'Operatore ISO 14732' },
    { pattern: /14731/i,          type: 'Coordinatore ISO 14731' },
    { pattern: /IWE|IWT|IWS|IWIP|EWE|EWT|EWS/i, type: 'Coordinatore ISO 14731' },
    { pattern: /\bNDT\b/i,        type: 'Operatore NDT' },
    { pattern: /\b(VT|MT|PT|UT|RT)\b.*livello|livello.*(VT|MT|PT|UT|RT)/i, type: 'Operatore NDT' },
    { pattern: /PES[\s/]*PAV|PAV[\s/]*PES/i, type: 'Abilitazione PES/PAV (CEI 11-27)' },
    { pattern: /\bPES\b/i,        type: 'Patentino PES (CEI 11-27)' },
    { pattern: /\bPAV\b/i,        type: 'Patentino PAV (CEI 11-27)' },
];

function classifyQualificationType(text) {
    const t = String(text || '').substring(0, 3000);
    for (const rule of TYPE_RULES) {
        if (rule.pattern.test(t)) return rule.type;
    }
    return 'Altra qualifica';
}

function normalizeDate(val) {
    if (!val) return null;
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
}

function buildCertificateFileUrl(filePath) {
    if (!filePath) return null;
    const uploadBase = process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve(__dirname, '../../uploads');
    return '/uploads/' + path.relative(uploadBase, filePath).replace(/\\/g, '/');
}

function mapPipelineFieldsToReview(f, pipelineText, fileName) {
    const person_name = String(f.welder_name || f.operator_name || f.person_name || '').trim();
    const position_range = Array.isArray(f.welding_positions)
        ? f.welding_positions.join(', ')
        : (f.welding_positions || f.welding_position || null);

    return {
        welder_name: person_name,
        operator_name: person_name,
        person_name,
        certificate_number: f.certificate_number || null,
        issuing_body: f.issuing_body || null,
        welding_process: f.welding_process || null,
        material_group: f.material_group || f.filler_material_group || null,
        filler_material_group: f.filler_material_group || f.material_group || null,
        welding_positions: f.welding_positions || position_range,
        welding_position: position_range,
        thickness_min_mm: f.thickness_min_mm ?? null,
        thickness_max_mm: f.thickness_max_mm ?? null,
        thickness_range: f.thickness_min_mm != null && f.thickness_max_mm != null
            ? `${f.thickness_min_mm}-${f.thickness_max_mm} mm`
            : (f.thickness_range || null),
        pipe_diameter_min_mm: f.pipe_diameter_min_mm ?? null,
        pipe_diameter_max_mm: f.pipe_diameter_max_mm ?? null,
        exam_date: normalizeDate(f.exam_date || f.issue_date),
        issue_date: normalizeDate(f.exam_date || f.issue_date),
        expiry_date: normalizeDate(f.expiry_date),
        last_confirmation_date: normalizeDate(f.last_confirmation_date),
        next_confirmation_due: normalizeDate(f.next_confirmation_due),
        standard_reference: f.standard_reference || f.standard_ref || null,
        ndt_method: f.ndt_method || null,
        ndt_level: f.ndt_level || null,
        coordinator_title: f.coordinator_title || null,
        cpd_valid_until: normalizeDate(f.cpd_valid_until || f.next_confirmation_due),
        patent_type: f.patent_type || null,
        joint_type: f.joint_type || null,
        pipe_diameter_mm: f.pipe_diameter_mm ?? null,
        // Operatori ISO 14732 (saldatura automatica/meccanizzata)
        equipment_type: f.equipment_type || null,
        welding_type: f.welding_type || null,
        single_multi_run: f.single_multi_run || null,
        qualification_method: f.qualification_method || null,
        qualification_type: classifyQualificationType(pipelineText || fileName),
    };
}

async function checkQualificationDuplicate(certificateNumber, organizationId, companyId, qualificationType) {
    if (!certificateNumber || !companyId) return false;
    const pool = await getPool();
    const dupCheck = await pool.request()
        .input('orgId', organizationId)
        .input('certNum', certificateNumber)
        .input('compId', companyId)
        .input('qualType', qualificationType)
        .query(`
            SELECT COUNT(*) AS cnt FROM qualifications
            WHERE organization_id=@orgId
              AND certificate_number=@certNum
              AND company_id=@compId
              AND qualification_type=@qualType
              AND status != 'revocata'
        `);
    return dupCheck.recordset[0].cnt > 0;
}

/**
 * Estrae campi senza INSERT (IG-3 staging).
 * @param {string} docType - 'patentino_saldatore' (default, saldatori ISO 9606-1) o 'qualifica_14732'
 *                            (operatori/preparatori saldatura automatica/meccanizzata).
 */
async function extractQualificationFromPdf(pdfBuffer, fileName, organizationId, companyId, docType = 'patentino_saldatore') {
    const pipeline = await runDocumentIngest({
        pdfBuffer,
        docType,
        fileName,
        organizationId,
    });
    const warnings = [...pipeline.warnings];
    const reviewFields = mapPipelineFieldsToReview(pipeline.fields || {}, pipeline.text, fileName);

    if (pipeline.text.length > 30) {
        const docClass = classifyDocument(pipeline.text);
        logger.info('Qualification doc classification', {
            fileName,
            detected_type: docClass.detected_type,
            confidence: docClass.confidence,
        });
        if (WRONG_MODULE_FOR_QUALIFICATIONS.has(docClass.detected_type) && docClass.confidence === 'high') {
            return {
                status: 'wrong_module',
                detected_type: docClass.detected_type,
                message: WRONG_MODULE_MESSAGES[docClass.detected_type],
                suggested_module: SUGGESTED_MODULE[docClass.detected_type],
            };
        }
    }

    if (!reviewFields.person_name) {
        warnings.push('Nome titolare non trovato — inserirlo manualmente in revisione');
    }

    if (reviewFields.certificate_number && companyId
        && await checkQualificationDuplicate(
            reviewFields.certificate_number,
            organizationId,
            companyId,
            reviewFields.qualification_type,
        )) {
        warnings.push(`Duplicato: certificato ${reviewFields.certificate_number} già presente.`);
        return {
            status: 'duplicate',
            person_name: reviewFields.person_name,
            qualification_type: reviewFields.qualification_type,
            warnings,
            fields: reviewFields,
            field_confidence: pipeline.fieldConfidence,
        };
    }

    const confidence = pipeline.aiModel ? 'ai' : 'rule_based';

    return {
        status: 'pending_review',
        fields: reviewFields,
        field_confidence: pipeline.fieldConfidence,
        qualification_type: reviewFields.qualification_type,
        confidence,
        warnings,
        ai_model: pipeline.aiModel,
    };
}

/**
 * Commit definitivo dopo revisione umana.
 */
async function commitQualificationFromFields(fields, organizationId, companyId, options = {}) {
    const {
        userId = null,
        filePath = null,
        fileName = '',
        qualificationType: qualTypeOverride = null,
    } = options;

    const f = fields || {};
    const qualificationType = qualTypeOverride || f.qualification_type || classifyQualificationType(fileName);
    const person_name = String(f.welder_name || f.operator_name || f.person_name || '').trim();

    if (!person_name) {
        const err = new Error('Nome titolare obbligatorio');
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    const certificate_number = f.certificate_number || null;
    const issue_date = normalizeDate(f.exam_date || f.issue_date);
    const exam_date = normalizeDate(f.exam_date || f.issue_date);
    const expiry_date = normalizeDate(f.expiry_date);
    const issuing_body = f.issuing_body || null;
    const standard_ref = f.standard_reference || f.standard_ref || null;
    const welding_process = f.welding_process || null;
    const material_group = f.material_group || f.filler_material_group || null;
    const position_range = Array.isArray(f.welding_positions)
        ? f.welding_positions.join(', ')
        : (f.welding_positions || f.welding_position || null);
    const thickness_min_mm = f.thickness_min_mm ?? null;
    const thickness_max_mm = f.thickness_max_mm ?? null;
    const pipe_diameter_min_mm = f.pipe_diameter_min_mm ?? null;
    const pipe_diameter_max_mm = f.pipe_diameter_max_mm ?? null;
    const thickness_range = f.thickness_range
        || (f.thickness_min_mm != null && f.thickness_max_mm != null
            ? `${f.thickness_min_mm}-${f.thickness_max_mm} mm`
            : null);
    const last_confirmation_date = normalizeDate(f.last_confirmation_date);
    const next_confirmation_due = normalizeDate(f.next_confirmation_due);
    const ndt_method = f.ndt_method || null;
    const ndt_level = f.ndt_level ? parseInt(f.ndt_level, 10) : null;
    const coordinator_title = f.coordinator_title || null;
    const cpd_valid_until = normalizeDate(f.cpd_valid_until || f.next_confirmation_due);
    const patent_type = f.patent_type || null;
    const equipment_type = f.equipment_type || null;
    const welding_type = f.welding_type || null;
    const single_multi_run = f.single_multi_run || null;
    const qualification_method = f.qualification_method || null;
    const certificate_file_url = buildCertificateFileUrl(filePath);
    const warnings = [];

    if (certificate_number && companyId
        && await checkQualificationDuplicate(certificate_number, organizationId, companyId, qualificationType)) {
        const err = new Error(`Certificato ${certificate_number} già presente`);
        err.code = 'DUPLICATE';
        err.warnings = [`Duplicato: certificato ${certificate_number} già presente.`];
        throw err;
    }

    const personnelResult = await resolvePersonnelForQualification({
        personName: person_name,
        companyId,
        organizationId,
    });
    if (!personnelResult.ok) {
        const err = new Error(personnelResult.error || 'Collegamento personale non valido.');
        err.code = 'VALIDATION_ERROR';
        throw err;
    }
    const personnel_id = personnelResult.personnelId ?? null;

    const pool = await getPool();
    const ins = await pool.request()
        .input('orgId', organizationId)
        .input('compId', companyId || null)
        .input('personName', personnelResult.personName || person_name)
        .input('personnelId', personnel_id)
        .input('qualType', qualificationType)
        .input('stdRef', standard_ref || null)
        .input('certNum', certificate_number || null)
        .input('issuer', issuing_body || null)
        .input('issueDate', issue_date || null)
        .input('examDate', exam_date || null)
        .input('expiryDate', expiry_date || null)
        .input('lastConfDate', last_confirmation_date || null)
        .input('nextConfDue', next_confirmation_due || null)
        .input('status', 'valida')
        .input('userId', userId || null)
        .input('weldProc', welding_process || null)
        .input('matGroup', material_group || null)
        .input('posRange', position_range || null)
        .input('thickRange', thickness_range || null)
        .input('thickMin', thickness_min_mm)
        .input('thickMax', thickness_max_mm)
        .input('pipeMin', pipe_diameter_min_mm)
        .input('pipeMax', pipe_diameter_max_mm)
        .input('ndtMethod', ndt_method || null)
        .input('ndtLevel', ndt_level || null)
        .input('coordTitle', coordinator_title || null)
        .input('cpdUntil', cpd_valid_until || null)
        .input('patentType', patent_type || null)
        .input('equipType', equipment_type || null)
        .input('weldingType', welding_type || null)
        .input('singleMultiRun', single_multi_run || null)
        .input('qualMethod', qualification_method || null)
        .input('certFileUrl', certificate_file_url || null)
        .query(`
            INSERT INTO qualifications
                (organization_id, company_id, person_name, personnel_id,
                 qualification_type, standard_ref, certificate_number, issuing_body,
                 issue_date, exam_date, expiry_date, last_confirmation_date, next_confirmation_due,
                 status, notes, created_by, approval_status,
                 welding_process, material_group, position_range, thickness_range,
                 thickness_min_mm, thickness_max_mm, pipe_diameter_min_mm, pipe_diameter_max_mm,
                 ndt_method, ndt_level, coordinator_title, cpd_valid_until,
                 patent_type, equipment_type, welding_type, single_multi_run, qualification_method,
                 certificate_file_url)
            OUTPUT INSERTED.id
            VALUES
                (@orgId, @compId, @personName, @personnelId,
                 @qualType, @stdRef, @certNum, @issuer,
                 @issueDate, @examDate, @expiryDate, @lastConfDate, @nextConfDue,
                 @status, NULL, @userId, 'bozza',
                 @weldProc, @matGroup, @posRange, @thickRange,
                 @thickMin, @thickMax, @pipeMin, @pipeMax,
                 @ndtMethod, @ndtLevel, @coordTitle, @cpdUntil,
                 @patentType, @equipType, @weldingType, @singleMultiRun, @qualMethod,
                 @certFileUrl)
        `);

    const qualification_id = ins.recordset[0].id;
    logger.info(`[QualifIngest] Committed qualifica id=${qualification_id} (${person_name}, ${qualificationType}) per org ${organizationId}`);

    return {
        qualification_id,
        person_name: personnelResult.personName || person_name,
        qualification_type: qualificationType,
        warnings,
    };
}

/**
 * Flusso legacy: estrazione + commit immediato.
 */
async function ingestQualificationFromPdf(pdfBuffer, fileName, organizationId, companyId, options = {}) {
    const extracted = await extractQualificationFromPdf(pdfBuffer, fileName, organizationId, companyId);
    if (extracted.status === 'wrong_module') return extracted;
    if (extracted.status === 'duplicate') {
        return {
            duplicate: true,
            person_name: extracted.person_name,
            qualification_type: extracted.qualification_type,
            warnings: extracted.warnings,
        };
    }

    const committed = await commitQualificationFromFields(
        extracted.fields,
        organizationId,
        companyId,
        { ...options, fileName, qualificationType: extracted.qualification_type },
    );

    return {
        ...committed,
        confidence: extracted.confidence,
        field_confidence: extracted.field_confidence,
        warnings: [...(extracted.warnings || []), ...(committed.warnings || [])],
    };
}

module.exports = {
    ingestQualificationFromPdf,
    extractQualificationFromPdf,
    commitQualificationFromFields,
    classifyQualificationType,
    mapPipelineFieldsToReview,
};
