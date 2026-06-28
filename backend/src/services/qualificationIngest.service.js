/**
 * qualificationIngest.service.js
 * Ingestion automatica di qualifiche da PDF (patentini, certificati).
 * Usato da uploadBatch in qualifications.controller.js.
 *
 * Flusso: estrazione testo pdf-parse ? classificazione tipo ? AI extraction ? validazione ? INSERT
 */

const path   = require('path');
const fs     = require('fs');
const logger = require('../utils/logger');
const { getPool } = require('../config/database');
const { resolvePersonnelForQualification } = require('./personnelQualificationLink.service');
const {
    classifyDocument,
    WRONG_MODULE_FOR_QUALIFICATIONS,
    WRONG_MODULE_MESSAGES,
    SUGGESTED_MODULE,
} = require('../utils/documentClassifier');

// AI opzionale: best-effort, non blocca l'ingestion se non disponibile
let chat = null;
let getActiveProvider = null;
try {
    const aiAdapter = require('./aiProviderAdapter');
    chat = aiAdapter.chat;
    getActiveProvider = aiAdapter.getActiveProvider;
} catch (_) {}

let pdfParse = null;
try { pdfParse = require('pdf-parse'); } catch (_) {}

let extractTextWithOCR = null;
try { extractTextWithOCR = require('../utils/ocrExtractor').extractTextWithOCR; } catch (_) {}

// ?? Classificazione tipo qualifica ????????????????????????????????????????????

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
    const t = text.substring(0, 3000); // analizza i primi 3000 caratteri
    for (const rule of TYPE_RULES) {
        if (rule.pattern.test(t)) return rule.type;
    }
    return 'Altra qualifica';
}

// ?? Prompt AI per estrazione metadati qualifica ???????????????????????????????

function buildQualificationExtractionPrompt(text, fileName) {
    return {
        systemPrompt: `Sei un sistema esperto di estrazione metadati da certificati di qualifica del personale (patentini saldatori ISO 9606, operatori NDT ISO 9712, coordinatori saldatura ISO 14731, abilitazioni PES/PAV).
Rispondi SOLO con JSON valido, senza markdown, senza commenti.`,
        userPrompt: `Estrai i seguenti campi da questo certificato di qualifica.
File: ${fileName}

Testo estratto:
---
${text.substring(0, 4000)}
---

Rispondi con questo schema JSON (usa null per campi non trovati):
{
  "person_name": "Nome Cognome del titolare",
  "certificate_number": "numero certificato/patentino",
  "issue_date": "YYYY-MM-DD oppure null",
  "expiry_date": "YYYY-MM-DD oppure null",
  "issuing_body": "ente certificatore (IIS, Bureau Veritas, DNV, CICPND...)",
  "welding_process": "codice processo ISO 4063 (111, 135, 141...)",
  "base_material": "gruppo materiale",
  "thickness": "spessore qualificato",
  "welding_position": "posizioni qualificate (PA, PB, PF...)",
  "ndt_method": "metodo NDT (VT, MT, PT, UT, RT)",
  "ndt_level": "livello NDT (1, 2, 3)",
  "coordinator_title": "titolo coordinatore (IWE, IWT, IWS, IWIP, EWE, EWT, EWS)",
  "cpd_valid_until": "YYYY-MM-DD oppure null",
  "patent_type": "tipo abilitazione PES/PAV",
  "standard_ref": "norma di riferimento"
}`,
    };
}

// ?? Funzione principale ????????????????????????????????????????????????????????

/**
 * @param {Buffer} pdfBuffer
 * @param {string} fileName
 * @param {number} organizationId
 * @param {number|null} companyId
 * @param {object} options - { userId, filePath }
 * @returns {Promise<{qualification_id, person_name, qualification_type, confidence, warnings[], duplicate?}>}
 */
async function ingestQualificationFromPdf(pdfBuffer, fileName, organizationId, companyId, options = {}) {
    const { userId = null, filePath = null } = options;
    const warnings = [];

    // 1. Estrae testo (pdf-parse per PDF digitali, OCR fallback per scansioni)
    let extractedText = '';
    let ocrUsed = false;

    if (pdfParse) {
        try {
            const parsed = await pdfParse(pdfBuffer);
            extractedText = parsed.text || '';
        } catch (parseErr) {
            warnings.push(`pdf-parse: ${parseErr.message}`);
        }
    } else {
        warnings.push('pdf-parse non disponibile \u2014 estrazione testo saltata.');
    }

    // 1a. Fallback OCR se il testo e' troppo breve (PDF scansionato)
    if (extractedText.trim().length < 50 && extractTextWithOCR) {
        logger.info('[Qualif ingest] Testo breve, tentativo OCR...', { fileName, textLen: extractedText.length });
        try {
            extractedText = await extractTextWithOCR(pdfBuffer, { maxPages: 3, lang: 'ita+eng' });
            ocrUsed = true;
            logger.info('[Qualif ingest] OCR completato', { fileName, chars: extractedText.length });
        } catch (ocrErr) {
            logger.warn('[Qualif ingest] OCR fallito', { fileName, error: ocrErr.message });
            warnings.push('PDF scansionato non leggibile via OCR \u2014 compilare manualmente');
        }
    }

    // 1b. Cross-check: blocca WPQR/WPS caricati per errore nel modulo qualifiche
    if (extractedText.length > 30) {
        const docClass = classifyDocument(extractedText);
        logger.info('Qualification doc classification', { fileName, detected_type: docClass.detected_type, confidence: docClass.confidence });
        if (WRONG_MODULE_FOR_QUALIFICATIONS.has(docClass.detected_type) && docClass.confidence === 'high') {
            return {
                status:           'wrong_module',
                detected_type:    docClass.detected_type,
                message:          WRONG_MODULE_MESSAGES[docClass.detected_type],
                suggested_module: SUGGESTED_MODULE[docClass.detected_type],
            };
        }
    }

    // 2. Classifica tipo
    const qualificationType = classifyQualificationType(extractedText || fileName);

    // 3. Estrazione AI metadati (best-effort)
    let aiData = {};
    const hasAi = chat && getActiveProvider && !!getActiveProvider();
    if (hasAi && extractedText.length > 50) {
        try {
            const { systemPrompt, userPrompt } = buildQualificationExtractionPrompt(extractedText, fileName);
            const aiResult = await chat(
                [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                { temperature: 0.1, responseFormat: 'json' }
            );
            let raw = String(aiResult.content || '').trim();
            if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
            aiData = JSON.parse(raw) || {};
        } catch (aiErr) {
            warnings.push(`AI extraction: ${aiErr.message}`);
        }
    } else if (!hasAi) {
        warnings.push('AI non configurata \u2014 metadati estratti solo da testo.');
    } else if (ocrUsed) {
        warnings.push('Estrazione via OCR \u2014 verificare accuratezza dati estratti');
    }

    // 4. Assembla dati qualifica
    const person_name = (aiData.person_name || '').trim();
    if (!person_name) {
        throw new Error(`Impossibile estrarre il nome del titolare da "${fileName}". Inserire manualmente.`);
    }

    const certificate_number = aiData.certificate_number || null;
    const issue_date   = normalizeDate(aiData.issue_date);
    const expiry_date  = normalizeDate(aiData.expiry_date);
    const issuing_body = aiData.issuing_body || null;
    const standard_ref = aiData.standard_ref || null;
    const welding_process = aiData.welding_process || null;
    const material_group  = aiData.base_material || null;
    const position_range  = aiData.welding_position || null;
    const thickness_range = aiData.thickness || null;
    const ndt_method      = aiData.ndt_method || null;
    const ndt_level       = aiData.ndt_level ? parseInt(aiData.ndt_level) : null;
    const coordinator_title = aiData.coordinator_title || null;
    const cpd_valid_until   = normalizeDate(aiData.cpd_valid_until);
    const patent_type       = aiData.patent_type || null;

    // URL file
    const uploadBase = process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve(__dirname, '../../uploads');
    const certificate_file_url = filePath
        ? ('/uploads/' + path.relative(uploadBase, filePath).replace(/\\/g, '/'))
        : null;

    const pool = await getPool();

    // 5. Controllo duplicati
    if (certificate_number && companyId) {
        const dupCheck = await pool.request()
            .input('orgId',    organizationId)
            .input('certNum',  certificate_number)
            .input('compId',   companyId)
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
            warnings.push(`Duplicato: certificato ${certificate_number} gi� presente.`);
            return { duplicate: true, person_name, qualification_type: qualificationType, warnings };
        }
    }

    // 6. Risolve personnel_id (camelCase come importJobs.controller)
    const personnelResult = await resolvePersonnelForQualification({
        personName: person_name,
        companyId,
        organizationId,
    });
    if (!personnelResult.ok) {
        throw new Error(personnelResult.error || 'Collegamento personale non valido.');
    }
    const personnel_id = personnelResult.personnelId ?? null;

    // 7. INSERT in qualifications
    const ins = await pool.request()
        .input('orgId',         organizationId)
        .input('compId',        companyId || null)
        .input('personName',    personnelResult.personName || person_name)
        .input('personnelId',   personnel_id)
        .input('qualType',      qualificationType)
        .input('stdRef',        standard_ref || null)
        .input('certNum',       certificate_number || null)
        .input('issuer',        issuing_body || null)
        .input('issueDate',     issue_date || null)
        .input('expiryDate',    expiry_date || null)
        .input('status',        'valida')
        .input('userId',        userId || null)
        .input('weldProc',      welding_process || null)
        .input('matGroup',      material_group || null)
        .input('posRange',      position_range || null)
        .input('thickRange',    thickness_range || null)
        .input('ndtMethod',     ndt_method || null)
        .input('ndtLevel',      ndt_level || null)
        .input('coordTitle',    coordinator_title || null)
        .input('cpdUntil',      cpd_valid_until || null)
        .input('patentType',    patent_type || null)
        .input('certFileUrl',   certificate_file_url || null)
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
    logger.info(`[QualifIngest] Creata qualifica id=${qualification_id} (${person_name}, ${qualificationType}) per org ${organizationId}`);

    return {
        qualification_id,
        person_name,
        qualification_type: qualificationType,
        confidence: hasAi ? 'ai' : 'rule_based',
        warnings,
    };
}

function normalizeDate(val) {
    if (!val) return null;
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // Prova a parsare formati comuni
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
}

module.exports = { ingestQualificationFromPdf };
