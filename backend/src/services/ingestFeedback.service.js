/**
 * ingestFeedback.service.js — cattura feedback operatore (IG-4)
 */

const { query } = require('../config/database');

function parseJson(val, fallback = null) {
    if (val == null) return fallback;
    if (typeof val === 'object') return val;
    try {
        return JSON.parse(val);
    } catch {
        return fallback;
    }
}

/**
 * Calcola delta campo-per-campo tra payload AI e versione umana.
 * @param {object} aiPayload
 * @param {object} humanPayload
 * @returns {object}
 */
function getFieldDiff(aiPayload = {}, humanPayload = {}) {
    const diffs = {};
    const keys = new Set([
        ...Object.keys(aiPayload || {}),
        ...Object.keys(humanPayload || {}),
    ]);

    for (const key of keys) {
        const aiVal = aiPayload[key];
        const humanVal = humanPayload[key];
        const aiStr = aiVal == null ? '' : String(aiVal).trim();
        const humanStr = humanVal == null ? '' : String(humanVal).trim();
        if (aiStr !== humanStr) {
            diffs[key] = { ai: aiVal ?? null, human: humanVal ?? null };
        }
    }
    return diffs;
}

function resolveAction(requestedAction, fieldDiffs) {
    if (requestedAction === 'rejected') return 'rejected';
    const hasDiffs = fieldDiffs && Object.keys(fieldDiffs).length > 0;
    if (requestedAction === 'corrected' || hasDiffs) return 'corrected';
    return 'accepted';
}

/**
 * @param {object} params
 */
async function recordFeedback(params) {
    const {
        organizationId,
        companyId = null,
        docType,
        source = 'batch',
        action,
        aiPayload = {},
        humanPayload = {},
        fieldConfidence = {},
        fileName = null,
        modelUsed = null,
        stagingId = null,
        rejectReason = null,
        createdBy = null,
    } = params;

    const fieldDiffs = getFieldDiff(aiPayload, humanPayload);
    const finalAction = resolveAction(action, fieldDiffs);

    await query(`
        INSERT INTO import_extraction_feedback (
            organization_id, company_id, doc_type, source, action,
            ai_payload_json, human_payload_json, field_diffs_json,
            field_confidence_json, file_name, model_used,
            staging_id, reject_reason, created_by
        )
        VALUES (
            @organizationId, @companyId, @docType, @source, @action,
            @aiPayloadJson, @humanPayloadJson, @fieldDiffsJson,
            @fieldConfidenceJson, @fileName, @modelUsed,
            @stagingId, @rejectReason, @createdBy
        )
    `, {
        organizationId,
        companyId,
        docType,
        source,
        action: finalAction,
        aiPayloadJson: JSON.stringify(aiPayload || {}),
        humanPayloadJson: JSON.stringify(humanPayload || {}),
        fieldDiffsJson: JSON.stringify(fieldDiffs),
        fieldConfidenceJson: JSON.stringify(fieldConfidence || {}),
        fileName,
        modelUsed,
        stagingId,
        rejectReason,
        createdBy,
    });

    return { action: finalAction, field_diffs: fieldDiffs };
}

async function getLearningStats(organizationId, docType = null) {
    const result = await query(`
        SELECT
            doc_type,
            action,
            COUNT(*) AS cnt
        FROM import_extraction_feedback
        WHERE organization_id = @organizationId
          AND (@docType IS NULL OR doc_type = @docType)
        GROUP BY doc_type, action
    `, { organizationId, docType: docType || null });

    const totals = await query(`
        SELECT COUNT(*) AS total
        FROM import_extraction_feedback
        WHERE organization_id = @organizationId
          AND (@docType IS NULL OR doc_type = @docType)
    `, { organizationId, docType: docType || null });

    return {
        total: totals.recordset[0]?.total || 0,
        by_doc_type_action: result.recordset,
    };
}

module.exports = {
    getFieldDiff,
    recordFeedback,
    getLearningStats,
    parseJson,
    resolveAction,
};
