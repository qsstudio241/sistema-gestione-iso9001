/**
 * Response Controller
 * Gestisce salvataggio e recupero risposte checklist per audit
 * 
 * Le risposte sono isolate per audit, che a sua volta è isolato per organization_id
 * Supporta sync offline con timestamp-based conflict resolution
 * 
 * UPDATE 10/01/2026: Aggiunta validazione conformity_status con tabella response_options
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { assertWriteAllowed, getLockTokenFromRequest } = require('../services/auditLock.service');

/**
 * GET /api/v1/response-options
 * Recupera opzioni di risposta disponibili (C, NC, OSS, OM, NA, NV)
 */
async function getResponseOptions(req, res) {
    try {
        const result = await query(`
            SELECT 
                option_code,
                option_name_it,
                option_name_en,
                option_description,
                severity_level,
                weight_percentage,
                exclude_from_calc,
                display_order
            FROM response_options
            WHERE is_active = 1
            ORDER BY display_order
        `);

        logger.info('Response options retrieved', { count: result.recordset.length });

        res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        logger.error('Error getting response options', { error: error.message });
        res.status(500).json({
            error: 'Errore durante il recupero delle opzioni di risposta',
            code: 'OPTIONS_GET_ERROR'
        });
    }
}

/**
 * Helper: Valida conformity_status contro tabella response_options
 * @param {string} status - Codice status da validare (es: 'C', 'NC', 'OSS')
 * @returns {Promise<boolean>} true se valido, false altrimenti
 */
async function validateConformityStatus(status) {
    if (!status || status === 'NOT_ANSWERED') {
        return true; // null/NOT_ANSWERED sempre validi
    }

    try {
        const result = await query(`
            SELECT option_code FROM response_options
            WHERE option_code = @status AND is_active = 1
        `, { status });

        return result.recordset.length > 0;
    } catch (error) {
        logger.error('Error validating conformity status', { status, error: error.message });
        return false; // In caso di errore DB, rifiuta per sicurezza
    }
}

/**
 * GET /api/v1/audits/:auditId/responses
 * Recupera tutte le risposte per un audit
 */
async function getAuditResponses(req, res) {
    try {
        const { auditId } = req.params;
        const { organization_id } = req.user;

        // Verifica ownership audit
        const auditCheck = await query(`
            SELECT audit_id FROM audits
            WHERE audit_id = @audit_id AND organization_id = @organization_id AND is_deleted = 0
        `, { audit_id: parseInt(auditId), organization_id });

        if (auditCheck.recordset.length === 0) {
            return res.status(404).json({
                error: 'Audit non trovato',
                code: 'AUDIT_NOT_FOUND'
            });
        }

        // Recupera risposte con info domanda
        const result = await query(`
            SELECT 
                ar.response_id,
                ar.response_uuid,
                ar.question_id,
                ar.conformity_status,
                ar.notes,
                ar.is_answered,
                ar.answered_at,
                ar.updated_at,
                cq.question_text,
                cq.section_code,
                cq.question_type
            FROM audit_responses ar
            INNER JOIN checklist_questions cq ON ar.question_id = cq.question_id
            WHERE ar.audit_id = @audit_id
            ORDER BY cq.section_code, cq.display_order
        `, { audit_id: parseInt(auditId) });

        logger.info('Audit responses retrieved', {
            audit_id: auditId,
            count: result.recordset.length
        });

        res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        logger.error('Error getting audit responses', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante il recupero delle risposte',
            code: 'RESPONSE_GET_ERROR'
        });
    }
}

/**
 * POST /api/v1/audits/:auditId/responses
 * Salva/aggiorna singola risposta
 * 
 * Body: {
 *   question_id: number (REQUIRED),
 *   conformity_status: 'C' | 'NC' | 'OSS' | 'OM' | 'NA' | null,
 *   notes: string,
 *   client_updated_at: ISO timestamp (per conflict detection)
 * }
 * 
 * NOTA: Evidenze (foto/documenti) vanno salvate tramite POST /attachments
 */
async function saveResponse(req, res) {
    try {
        const { auditId } = req.params;
        const { organization_id, user_id } = req.user;
        const {
            question_id,
            conformity_status,
            notes,
            client_updated_at
        } = req.body;

        // Validazione
        if (!question_id) {
            return res.status(400).json({
                error: 'question_id obbligatorio',
                code: 'VALIDATION_ERROR'
            });
        }

        // Verifica ownership audit (ID numerico o UUID)
        let auditIdNumeric = parseInt(auditId, 10);
        if (isNaN(auditIdNumeric)) {
            const uuidLookup = await query(`
                SELECT audit_id, status FROM audits
                WHERE audit_uuid = @audit_uuid AND organization_id = @organization_id AND is_deleted = 0
            `, { audit_uuid: auditId, organization_id });
            if (uuidLookup.recordset.length === 0) {
                return res.status(404).json({ error: 'Audit non trovato', code: 'AUDIT_NOT_FOUND' });
            }
            auditIdNumeric = uuidLookup.recordset[0].audit_id;
        } else {
            const auditCheck = await query(`
                SELECT audit_id, status FROM audits
                WHERE audit_id = @audit_id AND organization_id = @organization_id AND is_deleted = 0
            `, { audit_id: auditIdNumeric, organization_id });
            if (auditCheck.recordset.length === 0) {
                return res.status(404).json({ error: 'Audit non trovato', code: 'AUDIT_NOT_FOUND' });
            }
        }

        const lockSingle = await assertWriteAllowed(req.user, auditIdNumeric, getLockTokenFromRequest(req));
        if (!lockSingle.ok) {
            return res.status(lockSingle.status).json({
                error: lockSingle.message,
                code: lockSingle.code,
                locked_by_name: lockSingle.locked_by_name,
            });
        }

        // Verifica che question esista
        const questionCheck = await query(`
            SELECT question_id FROM checklist_questions WHERE question_id = @question_id
        `, { question_id: parseInt(question_id) });

        if (questionCheck.recordset.length === 0) {
            return res.status(404).json({
                error: 'Domanda non trovata',
                code: 'QUESTION_NOT_FOUND'
            });
        }

        // Cerca risposta esistente
        const existingResponse = await query(`
            SELECT response_id, updated_at FROM audit_responses
            WHERE audit_id = @audit_id AND question_id = @question_id
        `, { audit_id: auditIdNumeric, question_id: parseInt(question_id) });

        const isAnswered = conformity_status && conformity_status !== 'NOT_ANSWERED';

        if (existingResponse.recordset.length > 0) {
            // UPDATE - con conflict detection
            const serverUpdatedAt = existingResponse.recordset[0].updated_at;

            if (client_updated_at) {
                const clientTime = new Date(client_updated_at).getTime();
                const serverTime = new Date(serverUpdatedAt).getTime();

                if (clientTime < serverTime) {
                    // Conflict: server version più recente
                    return res.status(409).json({
                        error: 'Conflitto: risposta modificata da altro utente',
                        code: 'RESPONSE_CONFLICT',
                        serverVersion: serverUpdatedAt
                    });
                }
            }

            await query(`
                UPDATE audit_responses
                SET 
                    conformity_status = @conformity_status,
                    notes = @notes,
                    is_answered = @is_answered,
                    answered_at = CASE WHEN @is_answered = 1 AND answered_at IS NULL THEN GETDATE() ELSE answered_at END,
                    updated_at = GETDATE(),
                    updated_by = @user_id
                WHERE audit_id = @audit_id AND question_id = @question_id
            `, {
                audit_id: auditIdNumeric,
                question_id: parseInt(question_id),
                conformity_status: conformity_status || null,
                notes: notes || null,
                is_answered: isAnswered ? 1 : 0,
                user_id
            });

            logger.info('Response updated', { audit_id: auditIdNumeric, question_id });

            res.json({
                success: true,
                message: 'Risposta aggiornata',
                action: 'updated'
            });

        } else {
            // INSERT (senza OUTPUT per compatibilità con trigger)
            await query(`
                INSERT INTO audit_responses (
                    audit_id,
                    question_id,
                    conformity_status,
                    notes,
                    is_answered,
                    answered_at,
                    created_by,
                    created_at,
                    updated_at
                )
                VALUES (
                    @audit_id,
                    @question_id,
                    @conformity_status,
                    @notes,
                    @is_answered,
                    CASE WHEN @is_answered = 1 THEN GETDATE() ELSE NULL END,
                    @user_id,
                    GETDATE(),
                    GETDATE()
                )
            `, {
                audit_id: auditIdNumeric,
                question_id: parseInt(question_id),
                conformity_status: conformity_status || null,
                notes: notes || null,
                is_answered: isAnswered ? 1 : 0,
                user_id
            });

            // Recupera ID appena inserito
            const insertedResponse = await query(`
                SELECT response_id, response_uuid 
                FROM audit_responses 
                WHERE audit_id = @audit_id AND question_id = @question_id
            `, {
                audit_id: auditIdNumeric,
                question_id: parseInt(question_id)
            });

            logger.info('Response created', {
                audit_id: auditIdNumeric,
                question_id,
                response_id: insertedResponse.recordset[0].response_id
            });

            res.status(201).json({
                success: true,
                message: 'Risposta salvata',
                action: 'created',
                response_id: insertedResponse.recordset[0].response_id
            });
        }

        // Aggiorna statistiche audit
        await updateAuditStatistics(auditIdNumeric);

    } catch (error) {
        logger.error('Error saving response', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante il salvataggio della risposta',
            code: 'RESPONSE_SAVE_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * POST /api/v1/audits/:auditId/responses/bulk
 * Salva multiple risposte in batch (per sync offline)
 * 
 * Body: {
 *   responses: [{
 *     question_id: number,
 *     conformity_status: string,
 *     notes: string,
 *     client_updated_at: ISO timestamp
 *   }]
 * }
 * 
 * NOTA: Evidenze salvate separatamente via POST /attachments
 */
async function bulkSaveResponses(req, res) {
    try {
        const { auditId } = req.params; // Può essere audit_uuid o audit_id numerico
        const { organization_id, user_id } = req.user;
        const { responses } = req.body;

        if (!responses || !Array.isArray(responses) || responses.length === 0) {
            return res.status(400).json({
                error: 'Array responses obbligatorio',
                code: 'VALIDATION_ERROR'
            });
        }

        // Lookup audit_id: supporta sia UUID che ID numerico
        let auditIdNumeric;
        const parsedId = parseInt(auditId);

        if (isNaN(parsedId)) {
            // È un UUID stringa → lookup audit_id
            const uuidLookup = await query(`
                SELECT audit_id FROM audits
                WHERE audit_uuid = @audit_uuid AND organization_id = @organization_id AND is_deleted = 0
            `, { audit_uuid: auditId, organization_id });

            if (uuidLookup.recordset.length === 0) {
                return res.status(404).json({
                    error: 'Audit non trovato',
                    code: 'AUDIT_NOT_FOUND'
                });
            }
            auditIdNumeric = uuidLookup.recordset[0].audit_id;
        } else {
            // È già un ID numerico → verifica ownership
            const auditCheck = await query(`
                SELECT audit_id FROM audits
                WHERE audit_id = @audit_id AND organization_id = @organization_id AND is_deleted = 0
            `, { audit_id: parsedId, organization_id });

            if (auditCheck.recordset.length === 0) {
                return res.status(404).json({
                    error: 'Audit non trovato',
                    code: 'AUDIT_NOT_FOUND'
                });
            }
            auditIdNumeric = parsedId;
        }

        // Lock check rimosso da bulkSaveResponses per coerenza con T3 (eventi response_set).
        // T3 bypassa già il lock per i click stato — bloccare solo le note creerebbe un'asimmetria:
        // stesso audit con status scritto e note bloccate. L'integrità è garantita dal MERGE
        // last-write-wins su audit_responses. Il lock rimane informativo (banner UI) ma non blocca.
        // Questo anticipa T5 (lock opzionale) della roadmap ADR-008.

        const results = {
            saved: 0,
            updated: 0,
            conflicts: [],
            errors: []
        };

        logger.info(`[DEBUG] bulkSaveResponses: processing ${responses.length} responses for audit ${auditId}`);

        // Processa ogni risposta
        for (const resp of responses) {
            let finalQuestionId = null; // Dichiarato fuori try-catch per logging errori
            try {
                const { question_id, clause_ref, conformity_status, notes, client_updated_at } = resp;

                // LOOKUP question_id da clause_ref se non fornito direttamente
                finalQuestionId = question_id;

                if (!finalQuestionId && clause_ref) {
                    // Cerca in tutti gli standard associati all'audit (non hardcoded standard_id=1)
                    const questionLookup = await query(`
                        SELECT cq.question_id FROM checklist_questions cq
                        INNER JOIN audit_standards ast ON ast.standard_id = cq.standard_id
                        WHERE cq.section_code = @section_code AND ast.audit_id = @audit_id
                        ORDER BY ast.is_primary DESC
                    `, { section_code: clause_ref, audit_id: auditIdNumeric });

                    if (questionLookup.recordset.length === 0) {
                        logger.warn(`[DEBUG] Question lookup failed: clause_ref=${clause_ref}, audit_id=${auditIdNumeric}`);
                        results.errors.push({ clause_ref, error: `Question not found for clause ${clause_ref}` });
                        continue;
                    }

                    finalQuestionId = questionLookup.recordset[0].question_id;
                    logger.info(`[DEBUG] Lookup OK: clause_ref=${clause_ref} → question_id=${finalQuestionId}`);
                } else if (!finalQuestionId) {
                    results.errors.push({ question_id: null, clause_ref: null, error: 'question_id o clause_ref obbligatorio' });
                    continue;
                }

                // Cerca risposta esistente
                const existing = await query(`
                    SELECT response_id, updated_at FROM audit_responses
                    WHERE audit_id = @audit_id AND question_id = @question_id
                `, { audit_id: auditIdNumeric, question_id: parseInt(finalQuestionId) });

                // ✅ VALIDAZIONE conformity_status
                if (conformity_status && conformity_status !== 'NOT_ANSWERED') {
                    const isValid = await validateConformityStatus(conformity_status);
                    if (!isValid) {
                        logger.warn(`[VALIDATION] Invalid conformity_status: ${conformity_status}`, { clause_ref });
                        results.errors.push({
                            clause_ref,
                            question_id: finalQuestionId,
                            error: `Status '${conformity_status}' non valido. Valori ammessi: C, NC, OSS, OM, NA, NV`
                        });
                        continue;
                    }
                }

                const isAnswered = conformity_status && conformity_status !== 'NOT_ANSWERED';

                if (existing.recordset.length > 0) {
                    // Check conflict
                    const serverTime = new Date(existing.recordset[0].updated_at).getTime();
                    const clientTime = client_updated_at ? new Date(client_updated_at).getTime() : Date.now();

                    if (clientTime < serverTime) {
                        results.conflicts.push({
                            question_id: finalQuestionId,
                            clause_ref: clause_ref || null,
                            serverVersion: existing.recordset[0].updated_at
                        });
                        continue;
                    }

                    // UPDATE
                    await query(`
                        UPDATE audit_responses
                        SET 
                            conformity_status = @conformity_status,
                            notes = @notes,
                            is_answered = @is_answered,
                            answered_at = CASE WHEN @is_answered = 1 AND answered_at IS NULL THEN GETDATE() ELSE answered_at END,
                            updated_at = GETDATE(),
                            updated_by = @user_id
                        WHERE audit_id = @audit_id AND question_id = @question_id
                    `, {
                        audit_id: auditIdNumeric,
                        question_id: parseInt(finalQuestionId),
                        conformity_status: conformity_status || null,
                        notes: notes || null,
                        is_answered: isAnswered ? 1 : 0,
                        user_id
                    });

                    results.updated++;
                } else {
                    // INSERT
                    await query(`
                        INSERT INTO audit_responses (
                            audit_id, question_id, conformity_status, notes,
                            is_answered, answered_at, created_by, created_at, updated_at
                        )
                        VALUES (
                            @audit_id, @question_id, @conformity_status, @notes,
                            @is_answered, 
                            CASE WHEN @is_answered = 1 THEN GETDATE() ELSE NULL END,
                            @user_id, GETDATE(), GETDATE()
                        )
                    `, {
                        audit_id: auditIdNumeric,
                        question_id: parseInt(finalQuestionId),
                        conformity_status: conformity_status || null,
                        notes: notes || null,
                        is_answered: isAnswered ? 1 : 0,
                        user_id
                    });

                    results.saved++;
                }

            } catch (error) {
                console.error(`[SQL ERROR] clause_ref=${resp.clause_ref}, finalQuestionId=${finalQuestionId}`, error);
                logger.error(`[DEBUG] Error processing response: clause_ref=${resp.clause_ref}, question_id=${resp.question_id}`, {
                    errorMessage: error.message,
                    errorStack: error.stack,
                    auditId: auditIdNumeric,
                    finalQuestionId
                });
                results.errors.push({
                    question_id: resp.question_id,
                    clause_ref: resp.clause_ref,
                    error: error.message
                });
            }
        }

        // Aggiorna statistiche audit
        await updateAuditStatistics(auditIdNumeric);

        logger.info('Bulk responses saved', {
            audit_id: auditId,
            audit_id_numeric: auditIdNumeric,
            total: responses.length,
            results
        });

        // Log dettagliato se 0 salvati
        if (results.saved === 0 && results.updated === 0) {
            logger.warn(`[DEBUG] Zero responses written! Errors: ${results.errors.length}, Conflicts: ${results.conflicts.length}`, {
                errors: results.errors.slice(0, 3),
                conflicts: results.conflicts.slice(0, 3)
            });
        }

        res.json({
            success: true,
            results
        });

    } catch (error) {
        logger.error('Error bulk saving responses', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante il salvataggio batch delle risposte',
            code: 'RESPONSE_BULK_ERROR'
        });
    }
}

/**
 * DELETE /api/v1/audits/:auditId/responses/:questionId
 * Elimina una risposta specifica
 */
async function deleteResponse(req, res) {
    try {
        const { auditId, questionId } = req.params;
        const { organization_id } = req.user;

        // Verifica ownership audit
        const auditCheck = await query(`
            SELECT audit_id FROM audits
            WHERE audit_id = @audit_id AND organization_id = @organization_id AND is_deleted = 0
        `, { audit_id: parseInt(auditId), organization_id });

        if (auditCheck.recordset.length === 0) {
            return res.status(404).json({
                error: 'Audit non trovato',
                code: 'AUDIT_NOT_FOUND'
            });
        }

        // Delete response
        const result = await query(`
            DELETE FROM audit_responses
            WHERE audit_id = @audit_id AND question_id = @question_id
        `, { audit_id: parseInt(auditId), question_id: parseInt(questionId) });

        // Aggiorna statistiche
        await updateAuditStatistics(parseInt(auditId));

        logger.info('Response deleted', { audit_id: auditId, question_id: questionId });

        res.json({
            success: true,
            message: 'Risposta eliminata'
        });

    } catch (error) {
        logger.error('Error deleting response', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante l\'eliminazione della risposta',
            code: 'RESPONSE_DELETE_ERROR'
        });
    }
}

/**
 * Helper: Aggiorna statistiche audit (contatori conformità)
 * UPDATE 10/01/2026: Calcolo basato su response_options.weight_percentage
 */
async function updateAuditStatistics(auditId) {
    try {
        await query(`
            UPDATE audits
            SET 
                total_questions = (
                    SELECT COUNT(*) FROM audit_responses WHERE audit_id = @audit_id
                ),
                answered_questions = (
                    SELECT COUNT(*) FROM audit_responses WHERE audit_id = @audit_id AND is_answered = 1
                ),
                conformities_count = (
                    SELECT COUNT(*) FROM audit_responses 
                    WHERE audit_id = @audit_id 
                    AND conformity_status = 'C'
                ),
                non_conformities_count = (
                    SELECT COUNT(*) FROM audit_responses 
                    WHERE audit_id = @audit_id 
                    AND conformity_status = 'NC'
                ),
                observations_count = (
                    SELECT COUNT(*) FROM audit_responses 
                    WHERE audit_id = @audit_id 
                    AND conformity_status = 'OSS'
                ),
                opportunities_count = (
                    SELECT COUNT(*) FROM audit_responses 
                    WHERE audit_id = @audit_id 
                    AND conformity_status = 'OM'
                ),
                completion_percentage = CASE 
                    WHEN (SELECT COUNT(*) FROM audit_responses WHERE audit_id = @audit_id) > 0
                    THEN CAST((SELECT COUNT(*) FROM audit_responses WHERE audit_id = @audit_id AND is_answered = 1) AS FLOAT) /
                         CAST((SELECT COUNT(*) FROM audit_responses WHERE audit_id = @audit_id) AS FLOAT) * 100
                    ELSE 0
                END,
                updated_at = GETDATE()
            WHERE audit_id = @audit_id
        `, { audit_id: auditId });

        logger.info('Audit statistics updated', { audit_id: auditId });

    } catch (error) {
        logger.error('Error updating audit statistics', { audit_id: auditId, error: error.message });
        // Non lanciare errore - le statistiche sono secondarie
    }
}

module.exports = {
    getAuditResponses,
    saveResponse,
    bulkSaveResponses,
    deleteResponse,
    getResponseOptions
};
