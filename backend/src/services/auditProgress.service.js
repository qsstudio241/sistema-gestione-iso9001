/**
 * Avanzamento audit: domande del catalogo norma (attive) contro risposte reali.
 * Non scrive observations_count / opportunities_count: quelle colonne non esistono
 * e facevano fallire l'UPDATE a ogni salvataggio.
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');

const AUDIT_PROGRESS_SQL = `
UPDATE audits
SET
    total_questions = CASE
        WHEN (
            SELECT COUNT(*)
            FROM checklist_questions cq
            INNER JOIN audit_standards ast ON ast.standard_id = cq.standard_id
            WHERE ast.audit_id = @audit_id AND cq.is_active = 1
        ) > 0
        THEN (
            SELECT COUNT(*)
            FROM checklist_questions cq
            INNER JOIN audit_standards ast ON ast.standard_id = cq.standard_id
            WHERE ast.audit_id = @audit_id AND cq.is_active = 1
        )
        ELSE (
            SELECT COUNT(*) FROM audit_responses WHERE audit_id = @audit_id
        )
    END,
    answered_questions = (
        SELECT COUNT(*)
        FROM audit_responses ar
        WHERE ar.audit_id = @audit_id
          AND ar.is_answered = 1
          AND ar.conformity_status IS NOT NULL
          AND LTRIM(RTRIM(ar.conformity_status)) <> ''
          AND ar.conformity_status <> 'NOT_ANSWERED'
          AND (
            NOT EXISTS (
                SELECT 1
                FROM checklist_questions cq
                INNER JOIN audit_standards ast ON ast.standard_id = cq.standard_id
                WHERE ast.audit_id = @audit_id AND cq.is_active = 1
            )
            OR ar.question_id IN (
                SELECT cq.question_id
                FROM checklist_questions cq
                INNER JOIN audit_standards ast ON ast.standard_id = cq.standard_id
                WHERE ast.audit_id = @audit_id AND cq.is_active = 1
            )
          )
    ),
    conformities_count = (
        SELECT COUNT(*) FROM audit_responses
        WHERE audit_id = @audit_id AND conformity_status = 'C'
    ),
    non_conformities_count = (
        SELECT COUNT(*) FROM audit_responses
        WHERE audit_id = @audit_id AND conformity_status = 'NC'
    ),
    completion_percentage = CASE
        WHEN (
            SELECT COUNT(*)
            FROM checklist_questions cq
            INNER JOIN audit_standards ast ON ast.standard_id = cq.standard_id
            WHERE ast.audit_id = @audit_id AND cq.is_active = 1
        ) > 0
        THEN CAST((
            SELECT COUNT(*)
            FROM audit_responses ar
            WHERE ar.audit_id = @audit_id
              AND ar.is_answered = 1
              AND ar.conformity_status IS NOT NULL
              AND LTRIM(RTRIM(ar.conformity_status)) <> ''
              AND ar.conformity_status <> 'NOT_ANSWERED'
              AND ar.question_id IN (
                SELECT cq.question_id
                FROM checklist_questions cq
                INNER JOIN audit_standards ast ON ast.standard_id = cq.standard_id
                WHERE ast.audit_id = @audit_id AND cq.is_active = 1
              )
        ) AS FLOAT)
        / CAST((
            SELECT COUNT(*)
            FROM checklist_questions cq
            INNER JOIN audit_standards ast ON ast.standard_id = cq.standard_id
            WHERE ast.audit_id = @audit_id AND cq.is_active = 1
        ) AS FLOAT) * 100
        ELSE CASE
            WHEN (SELECT COUNT(*) FROM audit_responses WHERE audit_id = @audit_id) > 0
            THEN CAST((
                SELECT COUNT(*) FROM audit_responses
                WHERE audit_id = @audit_id AND is_answered = 1
            ) AS FLOAT)
            / CAST((SELECT COUNT(*) FROM audit_responses WHERE audit_id = @audit_id) AS FLOAT) * 100
            ELSE 0
        END
    END,
    updated_at = GETDATE()
WHERE audit_id = @audit_id
`;

async function updateAuditProgress(auditId, queryFn = query) {
    await queryFn(AUDIT_PROGRESS_SQL, { audit_id: auditId });
}

function progressErrorText(error) {
    return error?.message
        || error?.originalError?.message
        || (error ? String(error) : 'errore sconosciuto');
}

async function updateAuditProgressSafe(auditId, queryFn = query) {
    try {
        await updateAuditProgress(auditId, queryFn);
        logger.info('Audit statistics updated', { audit_id: auditId });
    } catch (error) {
        logger.error('Error updating audit statistics', {
            audit_id: auditId,
            error: progressErrorText(error),
        });
    }
}

module.exports = {
    AUDIT_PROGRESS_SQL,
    updateAuditProgress,
    updateAuditProgressSafe,
    progressErrorText,
};
