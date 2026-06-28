/**
 * ingestLearning.service.js — few-shot da feedback org (IG-5)
 */

const { query } = require('../config/database');
const { getSchemaForDocType } = require('../data/documentTypeSchemas');
const { parseJson } = require('./ingestFeedback.service');

const MIN_EXAMPLES = Number(process.env.INGEST_FEWSHOT_MIN_EXAMPLES) || 1;
const DEFAULT_LIMIT = Number(process.env.INGEST_FEWSHOT_LIMIT) || 3;

function humanPayloadComplete(humanPayload, docType) {
    const schema = getSchemaForDocType(docType);
    if (!schema?.aiExpectedSchema) return true;
    const requiredKeys = Object.keys(schema.aiExpectedSchema).slice(0, 2);
    return requiredKeys.every((k) => {
        const v = humanPayload?.[k];
        return v != null && String(v).trim() !== '';
    });
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
    humanPayloadComplete,
    MIN_EXAMPLES,
};
