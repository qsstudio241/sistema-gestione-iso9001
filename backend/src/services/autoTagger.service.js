/**
 * AutoTagger Service
 * Gestisce il tagging automatico basato su regole e suggerisce
 * tag e relazioni per i documenti del registro SGQ.
 *
 * Formato auto_rule (JSON in document_tags.auto_rule):
 *   { "field": "standard_id", "operator": "eq", "value": 1 }
 *   Operatori: eq, in, like, not_null
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

// ??? RULE EVALUATOR ?????????????????????????????????????????????????????????????

function evaluateRule(rule, document) {
    if (!rule || !rule.field || !rule.operator) return false;

    const fieldValue = document[rule.field];

    switch (rule.operator) {
        case 'eq':
            return fieldValue != null && String(fieldValue) === String(rule.value);
        case 'in':
            if (!Array.isArray(rule.value)) return false;
            return fieldValue != null && rule.value.map(String).includes(String(fieldValue));
        case 'like':
            if (fieldValue == null || rule.value == null) return false;
            return String(fieldValue).toLowerCase().includes(String(rule.value).toLowerCase());
        case 'not_null':
            return fieldValue != null && fieldValue !== '';
        default:
            return false;
    }
}

// ??? AUTO-TAG DOCUMENT ??????????????????????????????????????????????????????????

async function autoTagDocument(orgId, docId) {
    try {
        const docResult = await query(`
            SELECT id, standard_id, clause_ref, doc_type, title, status
            FROM document_registry
            WHERE id = @docId AND organization_id = @orgId
        `, { docId: parseInt(docId), orgId: parseInt(orgId) });

        if (docResult.recordset.length === 0) {
            logger.warn('autoTagDocument: documento non trovato', { orgId, docId });
            return [];
        }

        const doc = docResult.recordset[0];

        const tagsResult = await query(`
            SELECT id, name, auto_rule
            FROM document_tags
            WHERE (organization_id = @orgId OR organization_id IS NULL)
              AND auto_rule IS NOT NULL
        `, { orgId: parseInt(orgId) });

        const assigned = [];

        for (const tag of tagsResult.recordset) {
            let rule;
            try {
                rule = JSON.parse(tag.auto_rule);
            } catch {
                logger.warn('autoTagDocument: auto_rule JSON non valido', { tagId: tag.id });
                continue;
            }

            if (!evaluateRule(rule, doc)) continue;

            try {
                await query(`
                    IF NOT EXISTS (
                        SELECT 1 FROM document_tag_assignments
                        WHERE document_id = @docId AND tag_id = @tagId
                    )
                    INSERT INTO document_tag_assignments (document_id, tag_id, source, assigned_by)
                    VALUES (@docId, @tagId, 'auto', NULL)
                `, { docId: parseInt(docId), tagId: tag.id });

                assigned.push({ tag_id: tag.id, tag_name: tag.name });
            } catch (err) {
                logger.warn('autoTagDocument: errore assegnazione tag', { tagId: tag.id, error: err.message });
            }
        }

        if (assigned.length > 0) {
            logger.info('autoTagDocument completato', { docId, assigned: assigned.length });
        }

        return assigned;
    } catch (error) {
        logger.error('autoTagDocument error', { error: error.message, orgId, docId });
        throw error;
    }
}

// ??? SUGGEST TAGS ???????????????????????????????????????????????????????????????

async function suggestTags(orgId, docId) {
    try {
        const docResult = await query(`
            SELECT id, standard_id, clause_ref, doc_type
            FROM document_registry
            WHERE id = @docId AND organization_id = @orgId
        `, { docId: parseInt(docId), orgId: parseInt(orgId) });

        if (docResult.recordset.length === 0) return [];

        const doc = docResult.recordset[0];

        const allTags = await query(`
            SELECT dt.id, dt.name, dt.slug, dt.color, dt.auto_rule, tc.name AS category_name
            FROM document_tags dt
            LEFT JOIN tag_categories tc ON tc.id = dt.category_id
            WHERE (dt.organization_id = @orgId OR dt.organization_id IS NULL)
        `, { orgId: parseInt(orgId) });

        const alreadyAssigned = await query(`
            SELECT tag_id FROM document_tag_assignments WHERE document_id = @docId
        `, { docId: parseInt(docId) });

        const assignedSet = new Set(alreadyAssigned.recordset.map(r => r.tag_id));

        const suggestions = [];

        for (const tag of allTags.recordset) {
            if (assignedSet.has(tag.id)) continue;

            let reason = null;

            if (tag.auto_rule) {
                try {
                    const rule = JSON.parse(tag.auto_rule);
                    if (evaluateRule(rule, doc)) {
                        reason = `Corrisponde alla regola automatica (${rule.field} ${rule.operator} ${JSON.stringify(rule.value)})`;
                    }
                } catch { /* skip invalid JSON */ }
            }

            if (!reason && tag.slug && doc.doc_type) {
                if (tag.slug.includes(doc.doc_type.toLowerCase())) {
                    reason = `Il tag corrisponde al tipo documento "${doc.doc_type}"`;
                }
            }

            if (reason) {
                suggestions.push({
                    tag_id: tag.id,
                    tag_name: tag.name,
                    tag_color: tag.color,
                    category_name: tag.category_name,
                    reason,
                });
            }
        }

        return suggestions;
    } catch (error) {
        logger.error('suggestTags error', { error: error.message, orgId, docId });
        throw error;
    }
}

// ??? SUGGEST RELATIONS ??????????????????????????????????????????????????????????

async function suggestRelations(orgId, docId) {
    try {
        const docResult = await query(`
            SELECT id, standard_id, clause_ref, doc_type, title
            FROM document_registry
            WHERE id = @docId AND organization_id = @orgId
        `, { docId: parseInt(docId), orgId: parseInt(orgId) });

        if (docResult.recordset.length === 0) return [];

        const doc = docResult.recordset[0];

        const existingRels = await query(`
            SELECT source_document_id, target_document_id
            FROM document_relations
            WHERE organization_id = @orgId
              AND (source_document_id = @docId OR target_document_id = @docId)
        `, { orgId: parseInt(orgId), docId: parseInt(docId) });

        const linkedIds = new Set();
        linkedIds.add(parseInt(docId));
        for (const r of existingRels.recordset) {
            linkedIds.add(r.source_document_id);
            linkedIds.add(r.target_document_id);
        }

        const conditions = [];
        const params = { orgId: parseInt(orgId), docId: parseInt(docId) };

        if (doc.clause_ref) {
            conditions.push('dr.clause_ref = @clause_ref');
            params.clause_ref = doc.clause_ref;
        }
        if (doc.standard_id) {
            conditions.push('dr.standard_id = @standard_id');
            params.standard_id = parseInt(doc.standard_id);
        }

        if (conditions.length === 0) return [];

        const candidates = await query(`
            SELECT
                dr.id,
                dr.doc_code,
                dr.title,
                dr.doc_type,
                dr.standard_id,
                dr.clause_ref,
                dr.status
            FROM document_registry dr
            WHERE dr.organization_id = @orgId
              AND dr.id != @docId
              AND (${conditions.join(' OR ')})
            ORDER BY dr.title
        `, params);

        const suggestions = [];

        for (const candidate of candidates.recordset) {
            if (linkedIds.has(candidate.id)) continue;

            const reasons = [];
            if (doc.clause_ref && candidate.clause_ref === doc.clause_ref) {
                reasons.push(`Stesso riferimento normativo: ${doc.clause_ref}`);
            }
            if (doc.standard_id && candidate.standard_id === doc.standard_id) {
                reasons.push('Stesso standard di riferimento');
            }

            let suggested_type = 'references';
            if (candidate.doc_type === 'allegato' || candidate.doc_type === 'modulo') {
                suggested_type = 'attachment_of';
            }

            suggestions.push({
                document_id: candidate.id,
                doc_code: candidate.doc_code,
                title: candidate.title,
                doc_type: candidate.doc_type,
                status: candidate.status,
                suggested_relation_type: suggested_type,
                reasons,
            });
        }

        return suggestions;
    } catch (error) {
        logger.error('suggestRelations error', { error: error.message, orgId, docId });
        throw error;
    }
}

module.exports = {
    evaluateRule,
    autoTagDocument,
    suggestTags,
    suggestRelations,
};
