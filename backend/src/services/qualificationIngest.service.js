/**
 * qualificationIngest.service.js
 * Ingestion qualifiche da PDF (patentini) — pipeline IG-2 + staging IG-3.
 */

const path = require('path');
const logger = require('../utils/logger');
const { getPool } = require('../config/database');
const { resolvePersonnelForQualification } = require('./personnelQualificationLink.service');
const { runDocumentIngest } = require('./documentIngestPipeline.service');
const { buildWelderQualificationDesignation } = require('../utils/weldingDesignation');
const {
    classifyDocument,
    WRONG_MODULE_FOR_QUALIFICATIONS,
    WRONG_MODULE_MESSAGES,
    SUGGESTED_MODULE,
} = require('../utils/documentClassifier');
const {
    checkDateOrder,
    checkNumericRangeOrder,
    checkShieldingGasKnown,
} = require('../utils/ingestPlausibilityChecks');
const { toNumericOrNull } = require('../utils/numericSanitizer');

/**
 * Controlli di plausibilità/coerenza normativa sui campi estratti (warning-only,
 * mai bloccanti — vedi ingestPlausibilityChecks.js). Gap analysis qualifiche
 * saldatori 26/07/2026: prima di questa funzione nessuna verifica intercettava
 * date incoerenti (es. scadenza anteriore all'esame) o range spessore/diametro
 * invertiti provenienti da errori del documento originale o dell'OCR.
 * @param {object} f - reviewFields (mapPipelineFieldsToReview)
 * @returns {string[]}
 */
function checkQualificationPlausibility(f) {
    const warnings = [];

    const expiryWarn = checkDateOrder({
        laterDate: f.expiry_date,
        earlierDate: f.exam_date,
        laterLabel: 'Data di scadenza',
        earlierLabel: 'Data esame',
    });
    if (expiryWarn) warnings.push(expiryWarn);

    const nextConfWarn = checkDateOrder({
        laterDate: f.next_confirmation_due,
        earlierDate: f.last_confirmation_date || f.exam_date,
        laterLabel: 'Prossima conferma',
        earlierLabel: f.last_confirmation_date ? 'Ultima conferma' : 'Data esame',
    });
    if (nextConfWarn) warnings.push(nextConfWarn);

    const thicknessWarn = checkNumericRangeOrder({
        min: f.thickness_min_mm, max: f.thickness_max_mm, label: 'spessore',
    });
    if (thicknessWarn) warnings.push(thicknessWarn);

    const diameterWarn = checkNumericRangeOrder({
        min: f.pipe_diameter_min_mm, max: f.pipe_diameter_max_mm, label: 'diametro tubo',
    });
    if (diameterWarn) warnings.push(diameterWarn);

    const gasWarn = checkShieldingGasKnown(f.shielding_gas);
    if (gasWarn) warnings.push(gasWarn);

    return warnings;
}

const TYPE_RULES = [
    { pattern: /9606[\s-]?1/i,   type: 'Saldatore ISO 9606-1' },
    { pattern: /9606[\s-]?2/i,   type: 'Saldatore ISO 9606-2' },
    { pattern: /14732/i,          type: 'Operatore ISO 14732' },
    { pattern: /14731/i,          type: 'Coordinatore ISO 14731' },
    { pattern: /IWE|IWT|IWS|IWIP|EWE|EWT|EWS/i, type: 'Coordinatore ISO 14731' },
    // ISO 9712 NDT — metodo specifico per risposta copertura commessa
    { pattern: /9712/i,                                         type: 'Operatore NDT' },
    { pattern: /\bultrasonic.{0,30}(level|livello)/i,           type: 'Operatore NDT UT' },
    { pattern: /\bradio.{0,30}(level|livello)/i,                type: 'Operatore NDT RT' },
    { pattern: /\bmagnetic.{0,30}(level|livello)/i,             type: 'Operatore NDT MT' },
    { pattern: /\bpenetrant.{0,30}(level|livello)/i,            type: 'Operatore NDT PT' },
    { pattern: /\bvisual.{0,30}(level|livello)/i,               type: 'Operatore NDT VT' },
    { pattern: /\beddy.{0,30}(level|livello)/i,                 type: 'Operatore NDT ET' },
    { pattern: /\bNDT\b/i,        type: 'Operatore NDT' },
    { pattern: /\b(VT|MT|PT|UT|RT)\b.*livello|livello.*(VT|MT|PT|UT|RT)/i, type: 'Operatore NDT' },
    { pattern: /PES[\s/]*PAV|PAV[\s/]*PES/i, type: 'Abilitazione PES/PAV (CEI 11-27)' },
    { pattern: /\bPES\b/i,        type: 'Patentino PES (CEI 11-27)' },
    { pattern: /\bPAV\b/i,        type: 'Patentino PAV (CEI 11-27)' },
];

/**
 * Classifica il tipo qualifica dal testo del certificato.
 * Per cert_ndt: arricchisce con il metodo se estratto dai campi.
 */
function classifyQualificationType(text, extractedFields = {}) {
    const t = String(text || '').substring(0, 3000);
    for (const rule of TYPE_RULES) {
        if (rule.pattern.test(t)) {
            // Se abbiamo il metodo NDT estratto dall'AI, specifica la denominazione
            if (rule.type === 'Operatore NDT' && extractedFields.ndt_method) {
                return `Operatore NDT ${extractedFields.ndt_method} Livello ${extractedFields.certification_level || extractedFields.ndt_level || ''}`.trim();
            }
            return rule.type;
        }
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

/**
 * Aggiunge N mesi a una data ISO (YYYY-MM-DD).
 * Gestisce i mesi a fine anno (es. 2024-10 + 6 = 2025-04).
 * @param {string} isoDate
 * @param {number} months
 * @returns {string|null}
 */
function addMonths(isoDate, months) {
    if (!isoDate) return null;
    const d = new Date(isoDate + 'T00:00:00Z');
    if (isNaN(d.getTime())) return null;
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().slice(0, 10);
}

function buildCertificateFileUrl(filePath) {
    if (!filePath) return null;
    const uploadBase = process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve(__dirname, '../../uploads');
    return '/uploads/' + path.relative(uploadBase, filePath).replace(/\\/g, '/');
}

/**
 * Normalizza il gruppo materiale d'apporto (FM1–FM6 / nessuno).
 * NON confondere con material_group (ISO/TR 15608, es. "11.1"): un fallback
 * incrociato contaminava la designazione e il select del form (bug produzione
 * 01/08/2026 — patentino LOVETERE: filler vuoto in modifica, designazione con "11.1").
 * @param {unknown} raw
 * @returns {string|null}
 */
function normalizeFillerMaterialGroup(raw) {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^nessuno$/i.test(s)) return 'nessuno';
    const fm = s.toUpperCase().replace(/\s+/g, '');
    if (/^FM[1-6]$/.test(fm)) return fm;
    // Accetta anche "FM 1" / "fm1" già normalizzati sopra; altri valori (es. designazione
    // filo ISO 14341) non vanno nel select FM — scarta per non sporcare il form.
    return null;
}

/**
 * Risolve diametro tubo: lo schema AI patentino espone `pipe_diameter_mm` (singolo),
 * mentre DB/form usano min/max. Senza questo bridge il valore confermato in revisione
 * veniva perso al commit (bug produzione 01/08/2026).
 * Policy: diametro prova singolo → min = D, max = null (designazione "D≥D", tipico
 * ISO 9606-1 Tabella 7 quando il certificato riporta un solo Ø esterno di prova).
 * @returns {{ min: number|null, max: number|null }}
 */
function resolvePipeDiameterRange(f = {}) {
    let min = toNumericOrNull(f.pipe_diameter_min_mm);
    let max = toNumericOrNull(f.pipe_diameter_max_mm);
    if (min == null && max == null) {
        const single = toNumericOrNull(f.pipe_diameter_mm);
        if (single != null) min = single;
    }
    return { min, max };
}

function mapPipelineFieldsToReview(f, pipelineText, fileName) {
    const person_name = String(f.welder_name || f.operator_name || f.person_name || '').trim();
    const position_range = Array.isArray(f.welding_positions)
        ? f.welding_positions.join(', ')
        : (f.welding_positions || f.welding_position || null);

    const exam_date    = normalizeDate(f.exam_date || f.issue_date);
    const expiry_date  = normalizeDate(f.expiry_date);

    // Conferma semestrale (ISO 9606-1 §9.2): se il PDF non ha ancora registrato
    // alcuna conferma (tabella 9.2 vuota su nuovo certificato), l'ultima conferma
    // coincide con l'esame e la prossima scade 6 mesi dopo l'esame.
    const last_confirmation_date = normalizeDate(
        f.last_confirmation_date || null
    );
    const next_confirmation_due = normalizeDate(
        f.next_confirmation_due || f.cpd_valid_until
    ) || (last_confirmation_date
        ? addMonths(last_confirmation_date, 6)
        : addMonths(exam_date, 6));

    // Sanitizzazione numerica (bug produzione 27/07/2026): il PDF originale o il
    // form di revisione possono restituire "N.A.", stringa vuota o range testuali
    // per campi non applicabili al tipo di giunto/prodotto — mai testo grezzo su
    // colonne DECIMAL (vedi numericSanitizer.js per la policy completa).
    const thicknessMinNum = toNumericOrNull(f.thickness_min_mm);
    const thicknessMaxNum = toNumericOrNull(f.thickness_max_mm);
    const { min: pipeDiameterMinNum, max: pipeDiameterMaxNum } = resolvePipeDiameterRange(f);
    const fillerGroup = normalizeFillerMaterialGroup(
        f.filler_material_group || f.filler_material
    );
    // pipe_diameter_mm in revisione: preferisci il valore AI originale se presente,
    // altrimenti il min risolto (così il campo schema review resta allineato al DB).
    const pipeDiameterSingle = toNumericOrNull(f.pipe_diameter_mm) ?? pipeDiameterMinNum;

    return {
        welder_name: person_name,
        operator_name: person_name,
        person_name,
        certificate_number: f.certificate_number || null,
        issuing_body: f.issuing_body || null,
        welding_process: f.welding_process || null,
        // material_group (base ISO/TR 15608) e filler (FM1–FM6) restano SEPARATI.
        material_group: f.material_group || null,
        filler_material_group: fillerGroup,
        welding_positions: f.welding_positions || position_range,
        welding_position: position_range,
        thickness_min_mm: thicknessMinNum,
        thickness_max_mm: thicknessMaxNum,
        // Range aperto senza limite superiore (audit strutturale 07/08/2026 — bug
        // qualificationCoverage.js: un thickness_max_mm NULL veniva sempre trattato
        // come "nessun limite" anche quando il dato era solo assente/non estratto).
        // Stesso pattern del flag già introdotto per la WPQR (thickness_max_unlimited).
        thickness_max_unlimited: !!f.thickness_max_unlimited,
        thickness_range: thicknessMinNum != null && thicknessMaxNum != null
            ? `${thicknessMinNum}-${thicknessMaxNum} mm`
            : (f.thickness_range || null),
        pipe_diameter_min_mm: pipeDiameterMinNum,
        pipe_diameter_max_mm: pipeDiameterMaxNum,
        exam_date,
        issue_date: exam_date,
        expiry_date,
        last_confirmation_date,
        next_confirmation_due,
        cpd_valid_until: next_confirmation_due,
        revalidation_date: normalizeDate(f.revalidation_date) || expiry_date || null,
        standard_reference: f.standard_reference || f.standard_ref || null,
        ndt_method: f.ndt_method || null,
        ndt_level: f.ndt_level || null,
        coordinator_title: f.coordinator_title || null,
        patent_type: f.patent_type || null,
        joint_type: f.joint_type || null,
        // Variabile essenziale ISO 9606-1 §11 (P=piastra, T=tubo) e dettagli di giunto —
        // gap analysis 26/07/2026: presenti da tempo su form manuale/DB (product_type,
        // weld_details in qualifications.controller.js), ma mai estratti/mappati in ingest AI.
        product_type: f.product_type || null,
        weld_details: f.weld_details || null,
        pipe_diameter_mm: pipeDiameterSingle,
        // Metodo di trasferimento (ISO 9606-1 §5.2/§9.3, variabile essenziale solo
        // per processi ad arco con filo continuo 131/135/136/138) — richiesta
        // committente 28/07/2026, prima assente da schema/ingest/form.
        transfer_mode: f.transfer_mode || null,
        // Gas di protezione ISO 14175 (campo previsto dallo schema AI patentino_saldatore
        // — documentTypeSchemas.js — ma fino al 26/07/2026 mai mappato qui: veniva estratto
        // dall'AI e poi silenziosamente scartato prima di arrivare in staging/commit).
        shielding_gas: f.shielding_gas || null,
        examiner_body: f.examiner_body || null,
        scope_detail: f.scope_detail || null,
        // NDT ISO 9712
        ndt_sector: f.ndt_sector || null,
        certification_scheme: f.certification_scheme || null,
        // certification_level (alias AI) → ndt_level: la conversione avviene in commitQualificationFromFields
        certification_level: f.certification_level || null,
        // Operatori ISO 14732 (saldatura automatica/meccanizzata)
        equipment_type: f.equipment_type || null,
        welding_type: f.welding_type || null,
        single_multi_run: f.single_multi_run || null,
        qualification_method: f.qualification_method || null,
        qualification_type: classifyQualificationType(pipelineText || fileName, {
            ndt_method: f.ndt_method || null,
            certification_level: f.certification_level || null,
            ndt_level: f.ndt_level || null,
        }),
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

    warnings.push(...checkQualificationPlausibility(reviewFields));

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
    // material_group (base) e filler FM restano separati — vedi normalizeFillerMaterialGroup.
    const material_group = f.material_group || null;
    const filler_material = normalizeFillerMaterialGroup(
        f.filler_material_group || f.filler_material
    );
    const position_range = Array.isArray(f.welding_positions)
        ? f.welding_positions.join(', ')
        : (f.welding_positions || f.welding_position || null);
    // Sanitizzazione numerica (bug produzione 27/07/2026, cliente Mason): campi
    // spessore/diametro non applicabili (es. FW su tubo con "N.A." nel PDF, o
    // campo lasciato vuoto in revisione) non devono mai arrivare come stringa
    // grezza alla query SQL su colonne DECIMAL — vedi numericSanitizer.js.
    const thickness_min_mm = toNumericOrNull(f.thickness_min_mm);
    const thickness_max_mm = toNumericOrNull(f.thickness_max_mm);
    // Range aperto dichiarato senza limite superiore — vedi nota in mapPipelineFieldsToReview.
    const thickness_max_unlimited = !!f.thickness_max_unlimited;
    const { min: pipe_diameter_min_mm, max: pipe_diameter_max_mm } = resolvePipeDiameterRange(f);
    const thickness_range = f.thickness_range
        || (thickness_min_mm != null && thickness_max_mm != null
            ? `${thickness_min_mm}-${thickness_max_mm} mm`
            : null);
    const pipe_diameter = (pipe_diameter_min_mm != null && pipe_diameter_max_mm != null)
        ? `${pipe_diameter_min_mm}-${pipe_diameter_max_mm} mm`
        : (pipe_diameter_min_mm != null ? `≥${pipe_diameter_min_mm} mm` : null);
    const last_confirmation_date = normalizeDate(f.last_confirmation_date);
    const next_confirmation_due = normalizeDate(f.next_confirmation_due);
    // Revalidazione: se assente in estrazione/revisione, allinea a expiry_date
    // (tipicamente exam+3 anni su ISO 9606-1) così il form modifica non resta vuoto.
    const revalidation_date = normalizeDate(f.revalidation_date) || expiry_date || null;
    const ndt_method = f.ndt_method || null;
    const ndtLevelNum = toNumericOrNull(f.ndt_level || f.certification_level);
    const ndt_level = ndtLevelNum != null ? Math.trunc(ndtLevelNum) : null;
    // NDT-specific (ISO 9712): settore e schema certificazione.
    // L'AI usa `certification_level` (schema FE), il DB usa ndt_level (INT).
    const ndt_sector = f.ndt_sector || null;
    const certification_scheme = f.certification_scheme || null;
    const coordinator_title = f.coordinator_title || null;
    const cpd_valid_until = normalizeDate(f.cpd_valid_until || f.next_confirmation_due);
    const patent_type = f.patent_type || null;
    const equipment_type = f.equipment_type || null;
    const welding_type = f.welding_type || null;
    const single_multi_run = f.single_multi_run || null;
    const qualification_method = f.qualification_method || null;
    const shielding_gas = f.shielding_gas || null;
    const joint_type = f.joint_type || null;
    const product_type = f.product_type || null;
    const weld_details = f.weld_details || null;
    const transfer_mode = f.transfer_mode || null;
    const examiner_body = f.examiner_body || null;
    const scope_detail = f.scope_detail || null;
    const certificate_file_url = buildCertificateFileUrl(filePath);
    const warnings = [];

    // Designazione sintetica ISO 9606-1 §11 (stesso calcolo del form manuale —
    // qualifications.controller.js — vedi backend/src/utils/weldingDesignation.js).
    // Usa SOLO il gruppo apporto FM*, mai material_group (bug 01/08/2026).
    const qualification_designation = buildWelderQualificationDesignation({
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
        .input('scopeDetail', scope_detail || null)
        .input('certNum', certificate_number || null)
        .input('issuer', issuing_body || null)
        .input('issueDate', issue_date || null)
        .input('examDate', exam_date || null)
        .input('expiryDate', expiry_date || null)
        .input('lastConfDate', last_confirmation_date || null)
        .input('nextConfDue', next_confirmation_due || null)
        .input('revalDate', revalidation_date || null)
        .input('status', 'valida')
        .input('userId', userId || null)
        .input('weldProc', welding_process || null)
        .input('matGroup', material_group || null)
        .input('posRange', position_range || null)
        .input('thickRange', thickness_range || null)
        .input('thickMin', thickness_min_mm)
        .input('thickMax', thickness_max_mm)
        .input('thickMaxUnlimited', thickness_max_unlimited)
        .input('pipeMin', pipe_diameter_min_mm)
        .input('pipeMax', pipe_diameter_max_mm)
        .input('pipeDiam', pipe_diameter || null)
        .input('filler', filler_material || null)
        .input('ndtMethod', ndt_method || null)
        .input('ndtLevel', ndt_level || null)
        .input('ndtSector', ndt_sector || null)
        .input('certScheme', certification_scheme || null)
        .input('coordTitle', coordinator_title || null)
        .input('cpdUntil', cpd_valid_until || null)
        .input('patentType', patent_type || null)
        .input('equipType', equipment_type || null)
        .input('weldingType', welding_type || null)
        .input('singleMultiRun', single_multi_run || null)
        .input('qualMethod', qualification_method || null)
        .input('shieldGas', shielding_gas || null)
        .input('jointType', joint_type || null)
        .input('productType', product_type || null)
        .input('weldDetails', weld_details || null)
        .input('transferMode', transfer_mode || null)
        .input('examBody', examiner_body || null)
        .input('designation', qualification_designation || null)
        .input('certFileUrl', certificate_file_url || null)
        .query(`
            INSERT INTO qualifications
                (organization_id, company_id, person_name, personnel_id,
                 qualification_type, standard_ref, scope_detail, certificate_number, issuing_body,
                 issue_date, exam_date, expiry_date, last_confirmation_date, next_confirmation_due,
                 revalidation_date,
                 status, notes, created_by, approval_status,
                 welding_process, material_group, position_range, thickness_range, pipe_diameter,
                 thickness_min_mm, thickness_max_mm, thickness_max_unlimited, pipe_diameter_min_mm, pipe_diameter_max_mm,
                 filler_material,
                 ndt_method, ndt_level, ndt_sector, certification_scheme, coordinator_title, cpd_valid_until,
                 patent_type, equipment_type, welding_type, single_multi_run, qualification_method,
                 shielding_gas, joint_type, product_type, weld_details, transfer_mode, examiner_body,
                 qualification_designation, certificate_file_url)
            OUTPUT INSERTED.id
            VALUES
                (@orgId, @compId, @personName, @personnelId,
                 @qualType, @stdRef, @scopeDetail, @certNum, @issuer,
                 @issueDate, @examDate, @expiryDate, @lastConfDate, @nextConfDue,
                 @revalDate,
                 @status, NULL, @userId, 'approvata',
                 @weldProc, @matGroup, @posRange, @thickRange, @pipeDiam,
                 @thickMin, @thickMax, @thickMaxUnlimited, @pipeMin, @pipeMax,
                 @filler,
                 @ndtMethod, @ndtLevel, @ndtSector, @certScheme, @coordTitle, @cpdUntil,
                 @patentType, @equipType, @weldingType, @singleMultiRun, @qualMethod,
                 @shieldGas, @jointType, @productType, @weldDetails, @transferMode, @examBody,
                 @designation, @certFileUrl)
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

/**
 * Campi ammessi per la "rielaborazione" (backfill) di qualifiche già presenti in
 * DB — vedi backend/scripts/reprocess-qualifications.js e migrazione 137.
 * Whitelist esplicita: un nuovo campo va aggiunto qui solo dopo aver verificato
 * che la colonna esiste ed è sicura da scrivere via UPDATE mirato (mai colonne
 * che richiedono side-effect come qualification_designation).
 */
const REPROCESSABLE_FIELDS = {
    transfer_mode: { column: 'transfer_mode' },
    shielding_gas: { column: 'shielding_gas' },
    joint_type: { column: 'joint_type' },
    weld_details: { column: 'weld_details' },
    // Backfill post-bug 01/08/2026: campi estratti in revisione ma non scritti
    // dal commit ingest (filler_material_group → colonna filler_material;
    // pipe_diameter_mm → pipe_diameter_min_mm).
    filler_material: { column: 'filler_material' },
    pipe_diameter_min_mm: { column: 'pipe_diameter_min_mm' },
};

/**
 * Applica un aggiornamento mirato a UNA qualifica già esistente, limitato ai
 * campi in `fieldScope` (whitelist REPROCESSABLE_FIELDS). Usato dal percorso di
 * conferma staging in "modalità rielaborazione" (ingestStaging.service.js) —
 * MAI una INSERT: aggiorna solo se il valore attuale in DB è ancora NULL, per
 * non sovrascrivere mai una correzione manuale già presente (belt & suspenders,
 * oltre al filtro "WHERE campo IS NULL" già applicato dallo script di selezione).
 * @returns {Promise<{qualification_id:number, updated_fields:string[]}>}
 */
async function applyFieldReprocessUpdate(targetQualificationId, organizationId, fieldScope, fields) {
    const scopeFields = String(fieldScope || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!scopeFields.length) {
        const err = new Error('field_scope mancante o vuoto');
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    const pool = await getPool();
    const check = await pool.request()
        .input('id', targetQualificationId)
        .input('orgId', organizationId)
        .query('SELECT id FROM qualifications WHERE id=@id AND organization_id=@orgId');
    if (!check.recordset.length) {
        const err = new Error('Qualifica destinataria non trovata');
        err.code = 'NOT_FOUND';
        throw err;
    }

    const updatable = [];
    for (const key of scopeFields) {
        const def = REPROCESSABLE_FIELDS[key];
        if (!def) continue;
        const value = fields ? fields[key] : undefined;
        if (value === undefined || value === null || value === '') continue;
        updatable.push({ key, column: def.column, value });
    }

    if (!updatable.length) {
        return { qualification_id: targetQualificationId, updated_fields: [] };
    }

    const request = pool.request().input('id', targetQualificationId).input('orgId', organizationId);
    const setClauses = [];
    const updatedFields = [];
    for (const { key, column, value } of updatable) {
        const paramName = `val_${column}`;
        request.input(paramName, value);
        setClauses.push(`${column} = @${paramName}`);
        updatedFields.push(key);
    }

    // "WHERE campo IS NULL" per ciascuna colonna toccata: non sovrascrive mai un
    // valore già presente (anche se lo script di selezione dovrebbe già escluderlo).
    const guardClauses = updatable.map(({ column }) => `${column} IS NULL`).join(' AND ');

    await request.query(`
        UPDATE qualifications
        SET ${setClauses.join(', ')}, updated_at = GETDATE()
        WHERE id = @id AND organization_id = @orgId AND (${guardClauses})
    `);

    logger.info(`[QualifIngest] Rielaborazione applicata id=${targetQualificationId} campi=${updatedFields.join(',')}`);
    return { qualification_id: targetQualificationId, updated_fields: updatedFields };
}

module.exports = {
    ingestQualificationFromPdf,
    extractQualificationFromPdf,
    commitQualificationFromFields,
    classifyQualificationType,
    mapPipelineFieldsToReview,
    checkQualificationPlausibility,
    applyFieldReprocessUpdate,
    normalizeFillerMaterialGroup,
    resolvePipeDiameterRange,
    REPROCESSABLE_FIELDS,
};
