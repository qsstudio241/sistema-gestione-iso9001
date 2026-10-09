'use strict';

/**
 * documentIngestPipeline.service.js
 * Pipeline unificata ingest documenti (IG-1): testo → regole → AI → merge + confidence.
 * IG-2 collegherà upload batch WPQR/patentini a questo servizio.
 */

const logger = require('../utils/logger');
const { confidenceFromTextLength, extractPdfText } = require('../utils/importPdfText');
const {
    extractFieldsByRules,
    extractIssuingBody,
    sanitizeWeldDetails,
    extractWeldDetailsValidity,
    extractThicknessValidity,
} = require('../utils/ruleFieldExtractors');
const { getSchemaForDocType, DESIGNATION_ONLY_SCHEMA } = require('../data/documentTypeSchemas');
const { extractStructuredByDocType } = require('./importAiExtraction.service');
const { buildProfilePromptSection } = require('../data/jointTypeProfiles');
const { getActiveProvider, chat } = require('./aiProviderAdapter');
const { parseJsonWithRepair } = require('../utils/jsonRepair');
const {
    repairDeep,
    normalizeIngestSelectFields,
    normalizeIssuingBodyCode,
    detectLikelyFontSubstitutionCorruption,
    repairFontSubstitutionArtifacts,
} = require('../utils/textEncodingRepair');
const { describeIngestFileError, redactFileNameForLog } = require('../utils/ingestErrorMessage');

let extractTextWithOCR = null;
let extractHeaderTextWithOCR = null;
try {
    ({ extractTextWithOCR, extractHeaderTextWithOCR } = require('../utils/ocrExtractor'));
} catch (_) {}

/** Qualifiche personali: l'ente certificatore sta nella carta intestata (logo = grafica, non testo). */
const HEADER_OCR_DOC_TYPES = new Set(['patentino_saldatore', 'qualifica_14732']);
const HEADER_OCR_WARNING = 'Ente rilevato da OCR dell\'intestazione \u2014 verificare';

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
 * @param {boolean} [options.collectOcrLayout] - se true e l'OCR parte, restituisce anche `ocrLayout`
 *   (righe con bounding box per pagina; usato solo da qualifica_14732)
 * @returns {Promise<{ text: string, ocrUsed: boolean, warnings: string[], ocrLayout?: Array }>}
 */
async function extractDocumentText(pdfBuffer, options = {}) {
    const warnings = [];
    let text = '';
    let ocrUsed = false;
    const layoutSink = options.collectOcrLayout ? [] : null;

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
            text = await extractTextWithOCR(
                pdfBuffer,
                layoutSink ? { maxPages: 3, lang: 'ita+eng', layoutSink } : { maxPages: 3, lang: 'ita+eng' },
            );
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

    return layoutSink && layoutSink.length ? { text, ocrUsed, warnings, ocrLayout: layoutSink } : { text, ocrUsed, warnings };
}

/**
 * Estrazione AI con retry su JSON rotto (prompt ridotto).
 * @param {string} text
 * @param {string} docType
 * @param {string} fileName
 * @returns {Promise<{ fields: object, model: string|null, warnings: string[] }>}
 */
function pickDesignationOnlyFields(fields) {
    const out = {};
    if (!fields || typeof fields !== 'object') return out;
    for (const key of Object.keys(DESIGNATION_ONLY_SCHEMA)) {
        if (fields[key] != null && fields[key] !== '') out[key] = fields[key];
    }
    return out;
}

function maybeRestrictDesignationFields(fields, designationOnly) {
    if (!designationOnly) return fields || {};
    return pickDesignationOnlyFields(fields);
}

async function extractFieldsByAi(text, docType, fileName, organizationId = null, options = {}) {
    const warnings = [];
    if (!getActiveProvider()) {
        warnings.push('AI non configurata — solo estrazione regole');
        return { fields: {}, model: null, warnings };
    }
    if (text.length < 20) {
        warnings.push('Testo troppo breve per estrazione AI');
        return { fields: {}, model: null, warnings };
    }

    const { designationOnly = false, promptAddon = '' } = options;

    try {
        const result = await extractStructuredByDocType({
            text,
            docType,
            organizationId: designationOnly ? null : organizationId,
            promptAddon,
            designationOnly,
        });
        const specific = result.data?.type_specific_data || {};
        const flat = { ...specific };
        if (result.data?.title && !flat.title) flat.title = result.data.title;
        return { fields: maybeRestrictDesignationFields(flat, designationOnly), model: result.model || null, warnings };
    } catch (err) {
        const errMsg = describeIngestFileError(err, 'errore non specificato');
        warnings.push(`AI extraction: ${errMsg}`);
        logger.warn('[IngestPipeline] AI primary failed', { docType, file: redactFileNameForLog(fileName), error: errMsg, stack: err?.stack || null });

        if (err.code !== 'AI_INVALID_JSON' && !String(errMsg).includes('JSON')) {
            return { fields: {}, model: null, warnings };
        }

        try {
            const schema = getSchemaForDocType(docType);
            const retryKeys = designationOnly
                ? Object.keys(DESIGNATION_ONLY_SCHEMA)
                : Object.keys(schema?.aiExpectedSchema || {});
            const retry = await chat(
                [
                    {
                        role: 'system',
                        content: 'Rispondi SOLO con JSON valido. Nessun markdown. Escape delle virgolette nelle stringhe.',
                    },
                    {
                        role: 'user',
                        content: `Estrai campi da questo ${schema?.label || docType} (file ${fileName}). JSON piatto con chiavi: ${retryKeys.join(', ')}. Testo:\n${text.slice(0, 3000)}`,
                    },
                ],
                { temperature: 0.1, responseFormat: 'json', maxTokens: 2500 }
            );
            const parsed = parseJsonWithRepair(retry.content || '');
            const fields = parsed.type_specific_data && typeof parsed.type_specific_data === 'object'
                ? parsed.type_specific_data
                : parsed;
            warnings.push('AI extraction recuperata dopo retry JSON');
            return { fields: maybeRestrictDesignationFields(fields, designationOnly), model: retry.model || null, warnings };
        } catch (retryErr) {
            const retryMsg = describeIngestFileError(retryErr, 'errore non specificato');
            warnings.push(`AI retry fallito: ${retryMsg}`);
            // Log raw response per diagnosi (max 400 char per non intasare log)
            const raw = String(err.rawContent || err.raw_content || '').slice(0, 400);
            const retryRaw = String(retryErr.rawContent || retryErr.raw_content || '').slice(0, 400);
            logger.warn('[IngestPipeline] AI retry fallito — dump risposte AI', {
                docType,
                file: redactFileNameForLog(fileName),
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

/** Chiavi prova: l'AI (o il parser designazione) vince sulle regole 138/range. */
const TEST_SLOT_KEYS = new Set([
    'welding_process_test',
    'welding_processes_validity',
    'welding_position_test',
    'thickness_s_test_mm',
    'thickness_t_test_mm',
    'pipe_diameter_test_mm',
    'qualification_designation',
]);

/**
 * Qualifiche personali: la data esame NON e' una data di emissione. Senza questa esclusione
 * l'alias issue_date -> exam_date copiava la data della prova sull'emissione reale.
 */
const DOC_TYPES_WITHOUT_EXAM_DATE_AS_ISSUE = new Set(['patentino_saldatore', 'qualifica_14732']);

function pickMergedValue(key, ruleFields, aiFields, docType = null) {
    let aliases = [key, ...(FIELD_ALIASES[key] || [])];
    if (key === 'issue_date' && DOC_TYPES_WITHOUT_EXAM_DATE_AS_ISSUE.has(docType)) {
        aliases = aliases.filter((k) => k !== 'exam_date');
    }
    let aiVal = null;
    let ruleVal = null;

    for (const k of aliases) {
        if (aiVal == null && aiFields[k] != null) aiVal = normalizeFieldValue(aiFields[k]);
        if (ruleVal == null && ruleFields[k] != null) ruleVal = normalizeFieldValue(ruleFields[k]);
    }

    // L'OCR tesseract.js stacca la "x" dalla riga 4.1 c) e l'AI la attribuisce alla d): la regola strutturale corregge solo questo caso.
    if (docType === 'qualifica_14732' && key === 'qualification_method'
        && aiVal === 'production_test' && ruleVal === 'iso_9606') {
        return { value: ruleVal, confidence: 'medium', source: 'ai_corrected_by_rules' };
    }

    if (aiVal != null && ruleVal != null) {
        const same = String(aiVal).toLowerCase() === String(ruleVal).toLowerCase();
        return { value: aiVal, confidence: same ? 'high' : 'medium', source: same ? 'ai+rules' : 'ai' };
    }
    if (aiVal != null) {
        return { value: aiVal, confidence: TEST_SLOT_KEYS.has(key) ? 'high' : 'medium', source: 'ai' };
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
        const { value, confidence, source } = pickMergedValue(key, ruleFields, aiFields, docType);
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
 * Ente certificatore dal testo OCR dell'intestazione: solo valori della lista chiusa (mai `altro`), riconosciuti
 * dai matcher ancorati di `extractIssuingBody` (niente match libero sull'intero testo OCR).
 * @param {string} headerText
 * @returns {string|null} codice select (es. 'tec_eurolab')
 */
function detectIssuingBodyCodeFromHeader(headerText) {
    const text = String(headerText || '');
    if (!text.trim()) return null;
    const label = extractIssuingBody(text);
    const code = label ? normalizeIssuingBodyCode(label) : null;
    return code && code !== 'altro' ? code : null;
}

/**
 * Qualifiche con testo PDF ma ente non leggibile (logo e piè di pagina sono grafica): OCR della sola fascia alta
 * della prima pagina. Mai bloccante: errori, timeout e OCR vuoto lasciano l'ente invariato. Non riesegue l'OCR se
 * il documento e' gia' stato letto via OCR completo, ne' sovrascrive un ente valido (diverso da `altro`).
 * Muta `fields`, `fieldConfidence`, `fieldSources`, `warnings`.
 */
async function applyHeaderIssuingBodyFallback({
    pdfBuffer, docType, text, ocrUsed, fields, fieldConfidence, fieldSources, warnings, fileName,
    headerOcr = extractHeaderTextWithOCR,
}) {
    if (!HEADER_OCR_DOC_TYPES.has(docType) || ocrUsed || !headerOcr) return false;
    if (String(process.env.INGEST_HEADER_OCR || '').trim() === '0') return false;
    const current = fields.issuing_body;
    if (current && current !== 'altro') return false;
    if (extractIssuingBody(text)) return false;

    const startedAt = Date.now();
    try {
        const headerText = await headerOcr(pdfBuffer, { pageNumber: 1, lang: 'ita+eng' });
        const code = detectIssuingBodyCodeFromHeader(headerText);
        logger.info(`[IngestPipeline] OCR intestazione file=${redactFileNameForLog(fileName)} docType=${docType} ms=${Date.now() - startedAt}`
            + ` chars=${String(headerText || '').length} ente=${code || 'non rilevato'}`);
        if (!code) return false;
        fields.issuing_body = code;
        fieldConfidence.issuing_body = 'medium';
        fieldSources.issuing_body = 'ocr_header';
        warnings.push(HEADER_OCR_WARNING);
        return true;
    } catch (err) {
        const msg = (err && err.message) ? err.message : String(err);
        logger.warn(`[IngestPipeline] OCR intestazione non riuscito file=${redactFileNameForLog(fileName)} ms=${Date.now() - startedAt}: ${msg}`);
        return false;
    }
}

function sourceForRuleValue(prevValue, prevSource, value) {
    if (prevValue == null) return 'rules';
    const same = String(prevValue).toLowerCase() === String(value).toLowerCase();
    const fromAi = typeof prevSource === 'string' && prevSource.startsWith('ai');
    if (same) return fromAi ? 'ai+rules' : 'rules';
    return fromAi ? 'ai_corrected_by_rules' : 'rules';
}

function setFieldByRule(key, value, { fields, fieldConfidence, fieldSources }) {
    fieldSources[key] = sourceForRuleValue(fields[key], fieldSources[key], value);
    fields[key] = value;
    fieldConfidence[key] = 'high';
}

function clearField(key, { fields, fieldConfidence, fieldSources }) {
    if (fields[key] == null) return;
    delete fields[key];
    delete fieldSources[key];
    fieldConfidence[key] = 'low';
}

/**
 * Patentini ISO 9606-1: nel DB conta solo il CAMPO DI VALIDITA' (i dati di prova restano nel PDF allegato).
 * Dove la riga a tre colonne (Variabili / PROVA / VALIDITA') e' riconosciuta, la colonna VALIDITA' vince
 * sull'AI; altrimenti l'AI resta, con `weld_details` ripulito dai valori che non sono dettagli di saldatura
 * (es. "PIPE PLATE" della riga tubo/piastra). Layout diverso -> nessuna deduzione. Muta fields/fieldConfidence/fieldSources.
 */
function applyValidityColumnRules({ docType, text, fields, fieldConfidence, fieldSources }) {
    if (docType !== 'patentino_saldatore') return false;
    const ctx = { fields, fieldConfidence, fieldSources };
    let changed = false;

    const weldDetails = extractWeldDetailsValidity(text);
    if (weldDetails) {
        if (weldDetails.value) setFieldByRule('weld_details', weldDetails.value, ctx);
        else clearField('weld_details', ctx);
        changed = true;
    } else if (fields.weld_details != null) {
        const clean = sanitizeWeldDetails(fields.weld_details);
        if (clean) fields.weld_details = clean;
        else clearField('weld_details', ctx);
    }

    const thickness = extractThicknessValidity(text);
    if (thickness) {
        if (thickness.min != null) {
            setFieldByRule('thickness_min_mm', thickness.min, ctx);
        } else {
            // Apertura dichiarata senza minimo ("unlimited" da solo): il minimo dell'AI potrebbe essere
            // lo spessore di prova, quindi si lascia vuoto per la revisione invece di tenerlo.
            clearField('thickness_min_mm', ctx);
            clearField('thickness_range', ctx);
        }
        if (thickness.unlimited) {
            clearField('thickness_max_mm', ctx);
            setFieldByRule('thickness_max_unlimited', true, ctx);
        } else {
            setFieldByRule('thickness_max_mm', thickness.max, ctx);
            if (fields.thickness_max_unlimited) setFieldByRule('thickness_max_unlimited', false, ctx);
        }
        if (thickness.min != null) {
            const range = thickness.unlimited
                ? `\u2265${thickness.min} mm`
                : `${thickness.min}-${thickness.max} mm`;
            setFieldByRule('thickness_range', range, ctx);
        }
        changed = true;
    }
    return changed;
}

/** Campi chiave tracciati nella riga di log a fine ingest (solo nomi di campo, mai valori). */
const FIELD_SOURCES_LOG_KEYS = [
    'qualification_method', 'issuing_body', 'examiner_body', 'issue_date',
    'expiry_date', 'certificate_number', 'welding_process',
];
const FIELD_SOURCES_LOG_DOC_TYPES = new Set(['patentino_saldatore', 'qualifica_14732', 'cert_ndt']);

/**
 * Riga di log con la fonte per campo (campo=fonte; `none` = campo non estratto).
 * Valori, dati personali e nome file (puo' contenere il titolare) non compaiono mai.
 * @returns {string|null} null per i tipi documento non qualifica
 */
function buildFieldSourcesLogLine(docType, fieldSources) {
    if (!FIELD_SOURCES_LOG_DOC_TYPES.has(docType)) return null;
    const pairs = FIELD_SOURCES_LOG_KEYS
        .map((k) => `${k}=${(fieldSources && fieldSources[k]) || 'none'}`)
        .join(' ');
    return `[IngestPipeline] Fonti campi docType=${docType} ${pairs}`;
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

    const { text, ocrUsed, warnings: textWarnings, ocrLayout } = await extractDocumentText(
        pdfBuffer,
        docType === 'qualifica_14732' ? { collectOcrLayout: true } : {},
    );
    warnings.push(...textWarnings);

    const textConfidence = confidenceFromTextLength(text.length);
    if (ocrUsed) {
        warnings.push('Estrazione via OCR — verificare accuratezza dati');
    }

    const ruleFields = ocrLayout
        ? extractFieldsByRules(text, docType, fileName, { ocrLayout })
        : extractFieldsByRules(text, docType, fileName);
    let profileKey = ruleFields.joint_type || null;

    if (docType === 'patentino_saldatore' && !profileKey) {
        const { fields: designationAi, warnings: desWarnings } = await extractFieldsByAi(
            text, docType, fileName, organizationId, { designationOnly: true },
        );
        warnings.push(...desWarnings);
        Object.assign(ruleFields, pickDesignationOnlyFields(designationAi));
        profileKey = designationAi.joint_type || ruleFields.joint_type || null;
    }

    const promptAddon = docType === 'patentino_saldatore'
        ? buildProfilePromptSection(profileKey)
        : '';

    const { fields: aiFields, model, warnings: aiWarnings } = await extractFieldsByAi(
        text, docType, fileName, organizationId, { promptAddon },
    );
    warnings.push(...aiWarnings);

    const { fields, fieldConfidence, fieldSources } = mergeExtractions(ruleFields, aiFields, docType);
    const normalizedFields = normalizeIngestSelectFields(repairDeep(fields));
    applyValidityColumnRules({
        docType, text, fields: normalizedFields, fieldConfidence, fieldSources,
    });
    await applyHeaderIssuingBodyFallback({
        pdfBuffer, docType, text, ocrUsed, fileName, warnings,
        fields: normalizedFields, fieldConfidence, fieldSources,
    });

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
        file: redactFileNameForLog(fileName),
        organizationId,
        textLen: text.length,
        filledCount,
        extractionConfidence,
        model,
    });

    const sourcesLine = buildFieldSourcesLogLine(docType, fieldSources);
    if (sourcesLine) logger.info(sourcesLine);

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
    pickMergedValue,
    pickDesignationOnlyFields,
    applyHeaderIssuingBodyFallback,
    applyValidityColumnRules,
    detectIssuingBodyCodeFromHeader,
    buildFieldSourcesLogLine,
    SUPPORTED_DOC_TYPES,
};
