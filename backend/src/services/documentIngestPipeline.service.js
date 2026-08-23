'use strict';

/**
 * documentIngestPipeline.service.js
 * Pipeline unificata ingest documenti (IG-1): testo → regole → AI → merge + confidence.
 * IG-2 collegherà upload batch WPQR/patentini a questo servizio.
 */

const logger = require('../utils/logger');
const { confidenceFromTextLength, extractPdfText } = require('../utils/importPdfText');
const { extractFieldsByRules } = require('../utils/ruleFieldExtractors');
const { getSchemaForDocType } = require('../data/documentTypeSchemas');
const { extractStructuredByDocType } = require('./importAiExtraction.service');
const { getActiveProvider, chat } = require('./aiProviderAdapter');
const { parseJsonWithRepair } = require('../utils/jsonRepair');
const {
    repairDeep,
    normalizeIngestSelectFields,
    detectLikelyFontSubstitutionCorruption,
    repairFontSubstitutionArtifacts,
} = require('../utils/textEncodingRepair');
const { describeIngestFileError } = require('../utils/ingestErrorMessage');

let extractTextWithOCR = null;
try {
    extractTextWithOCR = require('../utils/ocrExtractor').extractTextWithOCR;
} catch (_) {}

// cert_ndt (ISO 9712) aggiunto 02/08/2026 — prima era in menu upload ma bloccato qui
// con UNSUPPORTED_DOC_TYPE (simulazione UT Level II TEC-Eurolab).
// report_ndt (verbali CND storici) aggiunto 23/08/2026 — stesso buco: tipo in menu,
// schema AI sì, whitelist pipeline no. Non crea righe in ndt_reports (CND-11).
const SUPPORTED_DOC_TYPES = new Set([
    'wpqr',
    'patentino_saldatore',
    'wps',
    'norma',
    'qualifica_14732',
    'cert_ndt',
    'report_ndt',
]);

/** Alias campi AI/schema → campi piatti pipeline */
const FIELD_ALIASES = {
    wpqr_number: ['reference_number', 'wpqr_code'],
    reference_number: ['wpqr_number', 'wpqr_code'],
    thickness_test_mm: ['thickness_tested'],
    thickness_tested: ['thickness_test_mm'],
    base_material_group: ['material_group', 'base_material'],
    material_group: ['base_material_group', 'base_material'],
    approval_date: ['issue_date'],
    issue_date: ['approval_date', 'exam_date'],
    part_ref: ['component_ref'],
    component_ref: ['part_ref'],
    inspector_name: ['operator_name'],
    operator_name: ['inspector_name'],
    outcome_summary: ['result_summary'],
    result_summary: ['outcome_summary'],
};

const OCR_MIN_CHARS = Number(process.env.INGEST_OCR_MIN_CHARS) || 50;

/**
 * @param {Buffer} pdfBuffer
 * @param {object} [options]
 * @returns {Promise<{ text: string, ocrUsed: boolean, warnings: string[] }>}
 */
async function extractDocumentText(pdfBuffer, options = {}) {
    const warnings = [];
    let text = '';
    let ocrUsed = false;

    try {
        text = await extractPdfText(pdfBuffer);
    } catch (err) {
        const errMsg = describeIngestFileError(err, 'errore non specificato');
        logger.warn('[IngestPipeline] pdf-parse fallito', { error: errMsg, stack: err?.stack || null });
        warnings.push(`pdf-parse: ${errMsg}`);
    }

    if (text.trim().length < OCR_MIN_CHARS && extractTextWithOCR) {
        try {
            logger.info('[IngestPipeline] Testo breve, tentativo OCR', { chars: text.length });
            text = await extractTextWithOCR(pdfBuffer, { maxPages: 3, lang: 'ita+eng' });
            ocrUsed = true;
        } catch (ocrErr) {
            const ocrMsg = (ocrErr && ocrErr.message) ? ocrErr.message : String(ocrErr);
            warnings.push(`OCR non disponibile o fallito: ${ocrMsg}`);
            logger.warn('[IngestPipeline] OCR fallito', { error: ocrMsg });
        }
    } else if (text.trim().length < OCR_MIN_CHARS) {
        warnings.push('Testo PDF insufficiente; OCR non configurato sul server');
    }

    text = String(text || '').trim();

    // Font PDF "anti-copia"/non standard (visto su norme UNI/ISO, es. ISO 9606-1:2017):
    // correzione opzionale e mirata, attivata solo se il testo mostra pattern noti
    // di corruzione (dizionario in textEncodingRepair.js). Non tocca testo pulito.
    if (detectLikelyFontSubstitutionCorruption(text)) {
        text = repairFontSubstitutionArtifacts(text);
        warnings.push('Rilevati pattern di font non standard (es. "buii"→"butt"); applicata correzione automatica — verificare i campi estratti');
    }

    return { text, ocrUsed, warnings };
}

/**
 * Estrazione AI con retry su JSON rotto (prompt ridotto).
 * @param {string} text
 * @param {string} docType
 * @param {string} fileName
 * @returns {Promise<{ fields: object, model: string|null, warnings: string[] }>}
 */
async function extractFieldsByAi(text, docType, fileName, organizationId = null) {
    const warnings = [];
    if (!getActiveProvider()) {
        warnings.push('AI non configurata — solo estrazione regole');
        return { fields: {}, model: null, warnings };
    }
    if (text.length < 20) {
        warnings.push('Testo troppo breve per estrazione AI');
        return { fields: {}, model: null, warnings };
    }

    try {
        const result = await extractStructuredByDocType({ text, docType, organizationId });
        const specific = result.data?.type_specific_data || {};
        const flat = { ...specific };
        if (result.data?.title && !flat.title) flat.title = result.data.title;
        return { fields: flat, model: result.model || null, warnings };
    } catch (err) {
        const errMsg = describeIngestFileError(err, 'errore non specificato');
        warnings.push(`AI extraction: ${errMsg}`);
        logger.warn('[IngestPipeline] AI primary failed', { docType, fileName, error: errMsg, stack: err?.stack || null });

        if (err.code !== 'AI_INVALID_JSON' && !String(errMsg).includes('JSON')) {
            return { fields: {}, model: null, warnings };
        }

        try {
            const schema = getSchemaForDocType(docType);
            const retry = await chat(
                [
                    {
                        role: 'system',
                        content: 'Rispondi SOLO con JSON valido. Nessun markdown. Escape delle virgolette nelle stringhe.',
                    },
                    {
                        role: 'user',
                        content: `Estrai campi da questo ${schema?.label || docType} (file ${fileName}). JSON piatto con chiavi: ${Object.keys(schema?.aiExpectedSchema || {}).join(', ')}. Testo:\n${text.slice(0, 3000)}`,
                    },
                ],
                { temperature: 0.1, responseFormat: 'json', maxTokens: 2500 }
            );
            const parsed = parseJsonWithRepair(retry.content || '');
            const fields = parsed.type_specific_data && typeof parsed.type_specific_data === 'object'
                ? parsed.type_specific_data
                : parsed;
            warnings.push('AI extraction recuperata dopo retry JSON');
            return { fields, model: retry.model || null, warnings };
        } catch (retryErr) {
            const retryMsg = describeIngestFileError(retryErr, 'errore non specificato');
            warnings.push(`AI retry fallito: ${retryMsg}`);
            // Log raw response per diagnosi (max 400 char per non intasare log)
            const raw = String(err.rawContent || err.raw_content || '').slice(0, 400);
            const retryRaw = String(retryErr.rawContent || retryErr.raw_content || '').slice(0, 400);
            logger.warn('[IngestPipeline] AI retry fallito — dump risposte AI', {
                docType,
                fileName,
                primaryError: err.message,
                retryError: retryMsg,
                primaryRawSample: raw,
                retryRawSample: retryRaw,
                stack: retryErr?.stack || null,
            });
            return { fields: {}, model: null, warnings };
        }
    }
}

function normalizeFieldValue(val) {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') {
        const t = val.trim();
        return t.length ? t : null;
    }
    if (Array.isArray(val)) return val.length ? val : null;
    return val;
}

function getSchemaKeys(docType) {
    const schema = getSchemaForDocType(docType);
    if (!schema?.aiExpectedSchema) return [];
    return Object.keys(schema.aiExpectedSchema);
}

function pickMergedValue(key, ruleFields, aiFields) {
    const aliases = [key, ...(FIELD_ALIASES[key] || [])];
    let aiVal = null;
    let ruleVal = null;

    for (const k of aliases) {
        if (aiVal == null && aiFields[k] != null) aiVal = normalizeFieldValue(aiFields[k]);
        if (ruleVal == null && ruleFields[k] != null) ruleVal = normalizeFieldValue(ruleFields[k]);
    }

    if (aiVal != null && ruleVal != null) {
        const same = String(aiVal).toLowerCase() === String(ruleVal).toLowerCase();
        return { value: aiVal, confidence: same ? 'high' : 'medium', source: same ? 'ai+rules' : 'ai' };
    }
    if (aiVal != null) {
        return { value: aiVal, confidence: 'medium', source: 'ai' };
    }
    if (ruleVal != null) {
        return { value: ruleVal, confidence: 'medium', source: 'rules' };
    }
    return { value: null, confidence: 'low', source: null };
}

/**
 * @param {object} ruleFields
 * @param {object} aiFields
 * @param {string} docType
 * @returns {{ fields: object, fieldConfidence: object, fieldSources: object }}
 */
function mergeExtractions(ruleFields, aiFields, docType) {
    const keys = getSchemaKeys(docType);
    const extraKeys = new Set([
        ...Object.keys(ruleFields || {}),
        ...Object.keys(aiFields || {}),
    ]);
    for (const k of extraKeys) keys.push(k);
    const uniqueKeys = [...new Set(keys)];

    const fields = {};
    const fieldConfidence = {};
    const fieldSources = {};

    for (const key of uniqueKeys) {
        const { value, confidence, source } = pickMergedValue(key, ruleFields, aiFields);
        if (value != null) {
            fields[key] = value;
            fieldConfidence[key] = confidence;
            fieldSources[key] = source;
        } else {
            fieldConfidence[key] = 'low';
        }
    }
    return { fields, fieldConfidence, fieldSources };
}

/**
 * Pipeline principale.
 *
 * @param {object} params
 * @param {Buffer} params.pdfBuffer
 * @param {string} params.docType — wpqr | patentino_saldatore | wps | norma
 * @param {string} [params.fileName]
 * @param {number} [params.organizationId] — riservato IG-5 (few-shot)
 * @returns {Promise<object>}
 */
async function runDocumentIngest({
    pdfBuffer,
    docType,
    fileName = 'document.pdf',
    organizationId = null,
}) {
    const warnings = [];

    if (!SUPPORTED_DOC_TYPES.has(docType)) {
        const e = new Error(`docType non supportato dalla pipeline: ${docType}`);
        e.code = 'UNSUPPORTED_DOC_TYPE';
        throw e;
    }

    const { text, ocrUsed, warnings: textWarnings } = await extractDocumentText(pdfBuffer);
    warnings.push(...textWarnings);

    const textConfidence = confidenceFromTextLength(text.length);
    if (ocrUsed) {
        warnings.push('Estrazione via OCR — verificare accuratezza dati');
    }

    const ruleFields = extractFieldsByRules(text, docType, fileName);
    const { fields: aiFields, model, warnings: aiWarnings } = await extractFieldsByAi(
        text, docType, fileName, organizationId,
    );
    warnings.push(...aiWarnings);

    const { fields, fieldConfidence, fieldSources } = mergeExtractions(ruleFields, aiFields, docType);
    const normalizedFields = normalizeIngestSelectFields(repairDeep(fields));

    const filledCount = Object.values(normalizedFields).filter((v) => v != null && v !== '').length;
    const schemaKeys = getSchemaKeys(docType);
    const requiredFilled = schemaKeys.filter((k) => normalizedFields[k] != null).length;
    const extractionConfidence = Math.min(
        100,
        Math.round(
            textConfidence * 0.35
            + (filledCount > 0 ? 35 : 0)
            + (aiFields && Object.keys(aiFields).length ? 20 : 0)
            + (requiredFilled / Math.max(schemaKeys.length, 1)) * 10
        )
    );

    logger.info('[IngestPipeline] Completato', {
        docType,
        fileName,
        organizationId,
        textLen: text.length,
        filledCount,
        extractionConfidence,
        model,
    });

    return {
        docType,
        fileName,
        text,
        textLength: text.length,
        ocrUsed,
        fields: normalizedFields,
        fieldConfidence,
        fieldSources,
        ruleFields,
        aiFields,
        aiModel: model,
        extractionConfidence,
        warnings,
    };
}

module.exports = {
    runDocumentIngest,
    extractDocumentText,
    extractFieldsByAi,
    mergeExtractions,
    SUPPORTED_DOC_TYPES,
};
