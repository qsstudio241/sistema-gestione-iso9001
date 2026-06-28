/**
 * qualificationIngest.service.js
 * Ingestion qualifiche da PDF (patentini) — delega estrazione a documentIngestPipeline (IG-2).
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

/**
 * @param {Buffer} pdfBuffer
 * @param {string} fileName
 * @param {number} organizationId
 * @param {number|null} companyId
 * @param {object} options — { userId, filePath }
 */
async function ingestQualificationFromPdf(pdfBuffer, fileName, organizationId, companyId, options = {}) {
    const { userId = null, filePath = null } = options;

    const pipeline = await runDocumentIngest({
        pdfBuffer,
        docType: 'patentino_saldatore',
        fileName,
        organizationId,
    });
    const warnings = [...pipeline.warnings];
    const f = pipeline.fields || {};

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

    const qualificationType = classifyQualificationType(pipeline.text || fileName);

    const person_name = String(f.welder_name || f.person_name || '').trim();
    if (!person_name) {
        throw new Error(`Impossibile estrarre il nome del titolare da "${fileName}". Inserire manualmente.`);
    }

    const certificate_number = f.certificate_number || null;
    const issue_date = normalizeDate(f.exam_date || f.issue_date);
    const expiry_date = normalizeDate(f.expiry_date);
    const issuing_body = f.issuing_body || null;
    const standard_ref = f.standard_reference || f.standard_ref || null;
    const welding_process = f.welding_process || null;
    const material_group = f.material_group || f.filler_material_group || null;
    const position_range = Array.isArray(f.welding_positions)
        ? f.welding_positions.join(', ')
        : (f.welding_positions || f.welding_position || null);
    const thickness_range = f.thickness_min_mm != null && f.thickness_max_mm != null
        ? `${f.thickness_min_mm}-${f.thickness_max_mm} mm`
        : (f.thickness_range || null);
    const ndt_method = f.ndt_method || null;
    const ndt_level = f.ndt_level ? parseInt(f.ndt_level, 10) : null;
    const coordinator_title = f.coordinator_title || null;
    const cpd_valid_until = normalizeDate(f.cpd_valid_until || f.next_confirmation_due);
    const patent_type = f.patent_type || null;
    const certificate_file_url = buildCertificateFileUrl(filePath);

    const pool = await getPool();

    if (certificate_number && companyId) {
        const dupCheck = await pool.request()
            .input('orgId', organizationId)
            .input('certNum', certificate_number)
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
        if (dupCheck.recordset[0].cnt > 0) {
            warnings.push(`Duplicato: certificato ${certificate_number} già presente.`);
            return { duplicate: true, person_name, qualification_type: qualificationType, warnings };
        }
    }

    const personnelResult = await resolvePersonnelForQualification({
        personName: person_name,
        companyId,
        organizationId,
    });
    if (!personnelResult.ok) {
        throw new Error(personnelResult.error || 'Collegamento personale non valido.');
    }
    const personnel_id = personnelResult.personnelId ?? null;

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
        .input('expiryDate', expiry_date || null)
        .input('status', 'valida')
        .input('userId', userId || null)
        .input('weldProc', welding_process || null)
        .input('matGroup', material_group || null)
        .input('posRange', position_range || null)
        .input('thickRange', thickness_range || null)
        .input('ndtMethod', ndt_method || null)
        .input('ndtLevel', ndt_level || null)
        .input('coordTitle', coordinator_title || null)
        .input('cpdUntil', cpd_valid_until || null)
        .input('patentType', patent_type || null)
        .input('certFileUrl', certificate_file_url || null)
        .query(`
            INSERT INTO qualifications
                (organization_id, company_id, person_name, personnel_id,
                 qualification_type, standard_ref, certificate_number, issuing_body,
                 issue_date, expiry_date, status, notes, created_by, approval_status,
                 welding_process, material_group, position_range, thickness_range,
                 ndt_method, ndt_level, coordinator_title, cpd_valid_until,
                 patent_type, certificate_file_url)
            OUTPUT INSERTED.id
            VALUES
                (@orgId, @compId, @personName, @personnelId,
                 @qualType, @stdRef, @certNum, @issuer,
                 @issueDate, @expiryDate, @status, NULL, @userId, 'bozza',
                 @weldProc, @matGroup, @posRange, @thickRange,
                 @ndtMethod, @ndtLevel, @coordTitle, @cpdUntil,
                 @patentType, @certFileUrl)
        `);

    const qualification_id = ins.recordset[0].id;
    const confidence = pipeline.aiModel ? 'ai' : 'rule_based';

    logger.info(`[QualifIngest] Creata qualifica id=${qualification_id} (${person_name}, ${qualificationType}) per org ${organizationId}`);

    return {
        qualification_id,
        person_name,
        qualification_type: qualificationType,
        confidence,
        field_confidence: pipeline.fieldConfidence,
        warnings,
    };
}

module.exports = { ingestQualificationFromPdf, classifyQualificationType };
