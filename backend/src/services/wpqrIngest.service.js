/**
 * wpqrIngest.service.js
 * Ingestion automatica di record WPQR da PDF.
 * Usato da uploadWPQRBatch in welding.controller.js.
 *
 * Flusso: estrazione testo pdf-parse ? AI extraction ? calcolo range ISO 15614-1 ? validazione ? INSERT
 */

const logger   = require('../utils/logger');
const { query } = require('../config/database');

// AI opzionale: best-effort, non blocca l'ingestion se non disponibile
let chat = null;
try {
    const aiAdapter = require('./aiProviderAdapter');
    chat = aiAdapter.chat;
} catch (_) {}

let pdfParse = null;
try { pdfParse = require('pdf-parse'); } catch (_) {}

// ?? Prompt AI per estrazione WPQR ????????????????????????????????????????????

function buildWPQRExtractionPrompt(text, fileName) {
    return {
        systemPrompt: `Sei un sistema esperto di estrazione metadati da certificati WPQR (Welding Procedure Qualification Record) e WPS (Welding Procedure Specification) secondo ISO 15614-1, ISO 9606, EN ISO 15607.
Rispondi SOLO con JSON valido, senza markdown, senza commenti.`,
        userPrompt: `Estrai i seguenti campi da questo certificato WPQR/WPS.
File: ${fileName}

Testo estratto:
---
${text.substring(0, 4000)}
---

Rispondi con questo schema JSON (usa null per campi non trovati):
{
  "reference_number": "numero identificativo WPQR o WPS",
  "wpqr_code": "codice WPQR (se diverso da reference_number)",
  "welding_process": "codice ISO 4063 (111, 121, 131, 135, 136, 141, 311...)",
  "base_material_group": "gruppo materiale base ISO/TR 15608 (1.1, 1.2, 8.1...)",
  "filler_material": "designazione materiale d'apporto",
  "thickness_tested": "spessore del provino in mm (solo numero, es. 10.0)",
  "welding_positions": "posizioni di saldatura (PA, PB, PC, PF...)",
  "examiner_body": "ente esaminatore (Bureau Veritas, DNV, IIS, Lloyd's...)",
  "testing_body": "laboratorio o ente di prova",
  "welder_name": "nome del saldatore qualificato",
  "issue_date": "YYYY-MM-DD oppure null",
  "expiry_date": "YYYY-MM-DD oppure null (tipicamente 3 anni dall'emissione)",
  "certificate_number": "numero certificato",
  "pwht": true/false (trattamento termico post-saldatura applicato)
}`,
    };
}

// ?? Calcolo range spessori ISO 15614-1 ???????????????????????????????????????

/**
 * Calcola il range di qualificazione spessori secondo ISO 15614-1:2017 Tabella 2.
 * - t ? 3 mm     ? min=t, max=2*t
 * - 3 < t ? 12   ? min=3mm, max=2*t
 * - t > 12       ? min=0.5*t (min 5mm), max=2*t (max 200mm)
 */
function calcThicknessRange(t) {
    if (!t || t <= 0) return { thickness_min: null, thickness_max: null };
    const tNum = parseFloat(t);
    let minT, maxT;
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

// ?? Anti-duplicato ????????????????????????????????????????????????????????????

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

// ?? Funzione principale ???????????????????????????????????????????????????????

/**
 * @param {Buffer} pdfBuffer
 * @param {string} fileName
 * @param {number} organizationId
 * @param {number|null} companyId
 * @param {object} options — { userId, filePath }
 * @returns {Promise<{wpqr_id, reference_number, welding_process, confidence, warnings[]}>}
 */
async function ingestWPQRFromPdf(pdfBuffer, fileName, organizationId, companyId, options = {}) {
    const { userId = null, filePath = null } = options;
    const warnings = [];
    let confidence = 'bassa';

    // 1. Estrae testo
    let extractedText = '';
    if (pdfParse) {
        try {
            const parsed = await pdfParse(pdfBuffer);
            extractedText = parsed.text || '';
        } catch (e) {
            warnings.push(`Estrazione testo fallita: ${e.message}`);
        }
    } else {
        warnings.push('pdf-parse non disponibile — metadati estratti manualmente');
    }

    // 2. AI extraction
    let aiData = {};
    if (chat && extractedText.length > 50) {
        try {
            const { systemPrompt, userPrompt } = buildWPQRExtractionPrompt(extractedText, fileName);
            const aiResponse = await chat(userPrompt, { systemPrompt, max_tokens: 800 });
            const raw = (aiResponse || '').replace(/```json\n?|```/g, '').trim();
            aiData = JSON.parse(raw);
            confidence = 'alta';
        } catch (e) {
            warnings.push(`AI extraction fallita: ${e.message}`);
            confidence = 'bassa';
        }
    } else if (!chat) {
        warnings.push('AI provider non configurato — inserimento con dati minimi');
    }

    // 3. Normalizzazione
    const referenceNumber = aiData.reference_number || aiData.wpqr_code || fileName.replace(/\.[^/.]+$/, '');
    const welding_process = aiData.welding_process || null;
    const base_material_group = aiData.base_material_group || null;
    const filler_material = aiData.filler_material || null;
    const thickness_tested = aiData.thickness_tested ? parseFloat(aiData.thickness_tested) : null;
    const welding_positions = aiData.welding_positions || null;
    const examiner_body = aiData.examiner_body || aiData.testing_body || null;
    const welder_name = aiData.welder_name || null;
    const issue_date = aiData.issue_date || null;
    const expiry_date = aiData.expiry_date || null;
    const certificate_number = aiData.certificate_number || null;
    const pwht = aiData.pwht ? 1 : 0;

    // 4. Calcola range spessori
    const { thickness_min, thickness_max } = calcThicknessRange(thickness_tested);
    if (thickness_tested && !thickness_min) {
        warnings.push('Spessore testato non riconoscibile — range non calcolato');
    }

    // 5. Validazione
    if (!referenceNumber || referenceNumber.trim().length === 0) {
        throw new Error('reference_number obbligatorio: non trovato nel documento');
    }

    // 6. Anti-duplicato
    const isDuplicate = await checkDuplicate(referenceNumber.trim(), organizationId, companyId);
    if (isDuplicate) {
        return { status: 'duplicate', reference_number: referenceNumber, warnings };
    }

    // 7. INSERT in wpqr_records
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
        organization_id:    organizationId,
        company_id:         companyId || null,
        reference_number:   referenceNumber.trim(),
        welding_process:    welding_process,
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
        certificate_file_url: filePath || null,
        pwht,
        created_by:         userId,
    });

    const wpqrId = insertResult.recordset[0].id;
    logger.info('WPQR ingested from PDF', { wpqrId, reference_number: referenceNumber, organizationId });

    return {
        wpqr_id:          wpqrId,
        reference_number: referenceNumber,
        welding_process,
        thickness_tested,
        thickness_min,
        thickness_max,
        confidence,
        warnings,
    };
}

module.exports = { ingestWPQRFromPdf, calcThicknessRange };
