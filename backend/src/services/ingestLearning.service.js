/**
 * ingestLearning.service.js — few-shot da feedback org (IG-5)
 */

const { query } = require('../config/database');
const { getSchemaForDocType } = require('../data/documentTypeSchemas');
const { parseJson } = require('./ingestFeedback.service');
const {
    getTopReferencePatterns,
    formatReferencePatternsPromptSection,
} = require('./ingestReferencePattern.service');

const MIN_EXAMPLES = Number(process.env.INGEST_FEWSHOT_MIN_EXAMPLES) || 1;
const DEFAULT_LIMIT = Number(process.env.INGEST_FEWSHOT_LIMIT) || 3;

/**
 * Campi sufficienti per accettare un esempio few-shot MC.
 * document_kind / inspection_document_type sono le prime chiavi dello schema
 * ma spesso null (DDT, mill senza A02) — non possono essere requisiti hard.
 */
const MC_FEWSHOT_SIGNAL_KEYS = [
    'material_role',
    'document_kind',
    'steel_designation',
    'filler_designation',
    'heat_or_lot_no',
    'ddt_no',
    'certificate_no',
    'inspection_document_type',
    'material_standard',
];

function hasNonEmpty(payload, key) {
    const v = payload?.[key];
    return v != null && String(v).trim() !== '';
}

function humanPayloadComplete(humanPayload, docType) {
    if (!humanPayload || typeof humanPayload !== 'object') return false;

    // MC: ADR-017 livello C — basta un segnale operativo (non le prime 2 chiavi schema).
    if (docType === 'material_certificate') {
        return MC_FEWSHOT_SIGNAL_KEYS.some((k) => hasNonEmpty(humanPayload, k));
    }

    const schema = getSchemaForDocType(docType);
    if (!schema?.aiExpectedSchema) return true;
    const requiredKeys = Object.keys(schema.aiExpectedSchema).slice(0, 2);
    return requiredKeys.every((k) => hasNonEmpty(humanPayload, k));
}

/**
 * Costruisce sezione prompt: pattern riferimento (Livello B) + few-shot org (Livello C).
 * @param {number} organizationId
 * @param {string} docType
 * @param {number} [orgLimit]
 */
async function buildIngestLearningPromptSection(organizationId, docType, orgLimit = DEFAULT_LIMIT) {
    const refPatterns = await getTopReferencePatterns(docType, 5);
    const refSection = formatReferencePatternsPromptSection(refPatterns);
    const orgExamples = await buildFewShotExamples(organizationId, docType, orgLimit);
    const orgSection = formatFewShotPromptSection(orgExamples);
    return refSection + orgSection;
}

/**
 * Ultimi esempi accepted/corrected per org+docType.
 * @param {number} organizationId
 * @param {string} docType
 * @param {number} [limit]
 */
async function buildFewShotExamples(organizationId, docType, limit = DEFAULT_LIMIT) {
    if (!organizationId || !docType) return [];

    const result = await query(`
        SELECT TOP (@limit)
            file_name, ai_payload_json, human_payload_json, field_diffs_json, action
        FROM import_extraction_feedback
        WHERE organization_id = @organizationId
          AND doc_type = @docType
          AND action IN ('accepted', 'corrected')
        ORDER BY created_at DESC
    `, { organizationId, docType, limit: Math.min(limit, 5) });

    return result.recordset
        .map((row) => ({
            file_name: row.file_name,
            action: row.action,
            ai_payload: parseJson(row.ai_payload_json, {}),
            human_payload: parseJson(row.human_payload_json, {}),
            field_diffs: parseJson(row.field_diffs_json, {}),
        }))
        .filter((ex) => humanPayloadComplete(ex.human_payload, docType));
}

/**
 * @param {Array} examples
 * @returns {string}
 */
function formatFewShotPromptSection(examples) {
    if (!examples || examples.length < MIN_EXAMPLES) return '';

    const blocks = examples.map((ex, i) => {
        const corrected = ex.field_diffs && Object.keys(ex.field_diffs).length > 0
            ? `\nCorrezioni operatore: ${JSON.stringify(ex.field_diffs)}`
            : '';
        return `Esempio ${i + 1} (file: ${ex.file_name || 'n/d'}):
Estrazione iniziale: ${JSON.stringify(ex.ai_payload)}
Versione confermata: ${JSON.stringify(ex.human_payload)}${corrected}`;
    });

    return `

Esempi dalla tua organizzazione (usa come riferimento, non copiare dati non presenti nel testo corrente):
${blocks.join('\n\n')}`;
}

module.exports = {
    buildFewShotExamples,
    formatFewShotPromptSection,
    buildIngestLearningPromptSection,
    humanPayloadComplete,
    MIN_EXAMPLES,
};
