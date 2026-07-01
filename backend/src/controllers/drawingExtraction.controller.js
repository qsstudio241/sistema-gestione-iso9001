/**
 * drawingExtraction.controller.js — Estrazione requisiti tecnici dai disegni di commessa.
 *
 * Endpoint (montati su /api/v1):
 *   POST  /cases/:caseId/documents/:docId/extract   avvia estrazione (sincrona, MVP)
 *   GET   /cases/:caseId/extractions                 lista job per commessa (ultimi per allegato)
 *   GET   /cases/:caseId/extractions/:id             stato + requisiti estratti
 *   PATCH /extracted-requirements/:id                revisione umana (conferma/modifica/rifiuta)
 *
 * Scope multi-tenant sempre vincolato a req.user.organization_id (via commercial_cases).
 * Il provider AI e' astratto da drawingExtraction.service (gemini ora, werk24 in futuro).
 */

const fs = require('fs').promises;
const { query } = require('../config/database');
const logger = require('../utils/logger');
const extractionService = require('../services/drawingExtraction.service');

const REVIEW_STATUSES = new Set(['extracted', 'confirmed', 'rejected', 'edited']);

function sendErr(res, httpStatus, message, code) {
    return res.status(httpStatus).json({ error: message, code });
}

function parseId(raw) {
    const id = parseInt(String(raw), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
}

async function caseBelongsToOrg(caseId, organizationId) {
    const r = await query(
        `SELECT id FROM commercial_cases WHERE id = @caseId AND organization_id = @organizationId`,
        { caseId, organizationId },
    );
    return r.recordset.length > 0;
}

/**
 * Carica un job di estrazione + i suoi requisiti, con scope organizzazione
 * verificato tramite la commessa collegata.
 * @returns {Promise<object|null>}
 */
async function fetchExtraction(extractionId, organizationId) {
    const headRes = await query(
        `
        SELECT e.id, e.organization_id, e.case_id, e.document_id, e.attachment_id,
               e.provider, e.external_job_id, e.status, e.error_message, e.page_count,
               e.created_by, e.created_at, e.completed_at
        FROM commercial_case_drawing_extractions e
        INNER JOIN commercial_cases c ON c.id = e.case_id
        WHERE e.id = @extractionId AND c.organization_id = @organizationId
        `,
        { extractionId, organizationId },
    );
    const head = headRes.recordset[0];
    if (!head) return null;

    const reqRes = await query(
        `
        SELECT id, extraction_id, req_type, field_key, value_text, unit,
               confidence, source_bbox, review_status, reviewed_by, created_at
        FROM commercial_case_extracted_requirements
        WHERE extraction_id = @extractionId
        ORDER BY id ASC
        `,
        { extractionId },
    );
    return { ...head, requirements: reqRes.recordset };
}

async function insertRequirements(extractionId, requirements) {
    for (const r of requirements) {
        await query(
            `
            INSERT INTO commercial_case_extracted_requirements
              (extraction_id, req_type, field_key, value_text, unit, confidence, source_bbox)
            VALUES
              (@extractionId, @reqType, @fieldKey, @valueText, @unit, @confidence, @sourceBbox)
            `,
            {
                extractionId,
                reqType: r.req_type,
                fieldKey: r.field_key ?? null,
                valueText: r.value_text ?? null,
                unit: r.unit ?? null,
                confidence: r.confidence ?? null,
                sourceBbox: r.source_bbox ?? null,
            },
        );
    }
}

/**
 * POST /cases/:caseId/documents/:docId/extract
 * docId = attachment_id di un allegato caricato sulla commessa (es. doc_role='drawing').
 */
async function startExtraction(req, res) {
    const organizationId = req.user.organization_id;
    const userId = req.user.user_id;
    const caseId = parseId(req.params.caseId);
    const docId = parseId(req.params.docId);
    if (!caseId || !docId) {
        return sendErr(res, 400, 'ID caso o documento non valido', 'VALIDATION_ERROR');
    }

    if (!(await caseBelongsToOrg(caseId, organizationId))) {
        return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
    }

    const attRes = await query(
        `
        SELECT attachment_id, storage_path, mime_type, file_name
        FROM attachments
        WHERE attachment_id = @docId AND commercial_case_id = @caseId
        `,
        { docId, caseId },
    );
    const att = attRes.recordset[0];
    if (!att) {
        return sendErr(res, 404, 'Documento non trovato per questa commessa', 'NOT_FOUND');
    }

    const provider = extractionService.resolveProvider();

    // Idempotenza (slice #3): ri-cliccare "Estrai" su uno stesso allegato non deve
    // accumulare job/requisiti duplicati. Semantica "ultima estrazione vince": rimuovo
    // le estrazioni precedenti dello stesso allegato (e i loro requisiti) prima di creare
    // quella nuova. Lo scope (case_id + attachment_id) esclude per costruzione le analisi
    // testo del capitolato (attachment_id NULL), che restano intatte.
    await query(
        `
        DELETE r
        FROM commercial_case_extracted_requirements r
        INNER JOIN commercial_case_drawing_extractions e ON e.id = r.extraction_id
        WHERE e.case_id = @caseId AND e.attachment_id = @docId
        `,
        { caseId, docId },
    );
    await query(
        `
        DELETE FROM commercial_case_drawing_extractions
        WHERE case_id = @caseId AND attachment_id = @docId
        `,
        { caseId, docId },
    );

    // Crea subito il record (status 'processing') così l'esito e' sempre tracciato.
    const ins = await query(
        `
        INSERT INTO commercial_case_drawing_extractions
          (organization_id, case_id, attachment_id, provider, status, created_by)
        OUTPUT INSERTED.id
        VALUES (@organizationId, @caseId, @docId, @provider, 'processing', @userId)
        `,
        { organizationId, caseId, docId, provider, userId },
    );
    const extractionId = ins.recordset[0].id;

    try {
        let buffer;
        try {
            buffer = await fs.readFile(att.storage_path);
        } catch {
            const e = new Error('File del documento non disponibile sul server');
            e.code = 'FILE_NOT_FOUND';
            throw e;
        }

        const out = await extractionService.extractFromFile(buffer, att.mime_type, {});
        await insertRequirements(extractionId, out.requirements || []);

        await query(
            `
            UPDATE commercial_case_drawing_extractions
            SET status = 'done', raw_response = @raw, completed_at = SYSDATETIME()
            WHERE id = @extractionId
            `,
            { extractionId, raw: out.raw != null ? String(out.raw).substring(0, 1000000) : null },
        );

        const full = await fetchExtraction(extractionId, organizationId);
        return res.status(201).json(full);
    } catch (err) {
        const msg = err.code ? `${err.code}: ${err.message}` : err.message;
        // Degrado gestito: il record resta con status 'error' e messaggio leggibile.
        try {
            await query(
                `
                UPDATE commercial_case_drawing_extractions
                SET status = 'error', error_message = @msg, completed_at = SYSDATETIME()
                WHERE id = @extractionId
                `,
                { extractionId, msg: String(msg).substring(0, 4000) },
            );
        } catch { /* best effort */ }
        logger.error('startExtraction', msg);
        let full = null;
        try {
            full = await fetchExtraction(extractionId, organizationId);
        } catch { /* best effort */ }
        return res.status(201).json(
            full || { id: extractionId, status: 'error', provider, error_message: msg, requirements: [] },
        );
    }
}

/** GET /cases/:caseId/extractions — lista job (solo disegni con attachment_id), scope org. */
async function listExtractions(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const caseId = parseId(req.params.caseId);
        if (!caseId) return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');

        if (!(await caseBelongsToOrg(caseId, organizationId))) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }

        const result = await query(
            `
            SELECT e.id, e.organization_id, e.case_id, e.document_id, e.attachment_id,
                   e.provider, e.external_job_id, e.status, e.error_message, e.page_count,
                   e.created_by, e.created_at, e.completed_at
            FROM commercial_case_drawing_extractions e
            INNER JOIN commercial_cases c ON c.id = e.case_id
            WHERE e.case_id = @caseId
              AND c.organization_id = @organizationId
              AND e.attachment_id IS NOT NULL
            ORDER BY e.created_at DESC
            `,
            { caseId, organizationId },
        );

        return res.json({ extractions: result.recordset });
    } catch (err) {
        logger.error('listExtractions', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

/** GET /cases/:caseId/extractions/:id */
async function getExtraction(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const caseId = parseId(req.params.caseId);
        const extractionId = parseId(req.params.id);
        if (!caseId || !extractionId) {
            return sendErr(res, 400, 'ID non valido', 'VALIDATION_ERROR');
        }
        const full = await fetchExtraction(extractionId, organizationId);
        if (!full || full.case_id !== caseId) {
            return sendErr(res, 404, 'Estrazione non trovata', 'NOT_FOUND');
        }
        return res.json(full);
    } catch (err) {
        logger.error('getExtraction', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

/** PATCH /extracted-requirements/:id — revisione umana (conferma/modifica/rifiuta). */
async function reviewRequirement(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const userId = req.user.user_id;
        const reqId = parseId(req.params.id);
        if (!reqId) return sendErr(res, 400, 'ID requisito non valido', 'VALIDATION_ERROR');

        const body = req.body || {};
        const reviewStatus = String(body.review_status || '').trim().toLowerCase();
        if (!REVIEW_STATUSES.has(reviewStatus)) {
            return sendErr(res, 400, 'review_status non valido', 'VALIDATION_ERROR');
        }

        // Scope: requisito -> estrazione -> commessa -> organizzazione
        const ownRes = await query(
            `
            SELECT r.id
            FROM commercial_case_extracted_requirements r
            INNER JOIN commercial_case_drawing_extractions e ON e.id = r.extraction_id
            INNER JOIN commercial_cases c ON c.id = e.case_id
            WHERE r.id = @reqId AND c.organization_id = @organizationId
            `,
            { reqId, organizationId },
        );
        if (!ownRes.recordset.length) {
            return sendErr(res, 404, 'Requisito non trovato', 'NOT_FOUND');
        }

        // In modifica si possono aggiornare anche i valori; altrimenti solo lo stato.
        const isEdit = reviewStatus === 'edited';
        const valueText = isEdit && body.value_text !== undefined
            ? (body.value_text === null ? null : String(body.value_text))
            : undefined;
        const fieldKey = isEdit && body.field_key !== undefined
            ? (body.field_key === null ? null : String(body.field_key).substring(0, 100))
            : undefined;
        const unit = isEdit && body.unit !== undefined
            ? (body.unit === null ? null : String(body.unit).substring(0, 30))
            : undefined;

        const sets = ['review_status = @reviewStatus', 'reviewed_by = @userId'];
        const params = { reqId, reviewStatus, userId };
        if (valueText !== undefined) { sets.push('value_text = @valueText'); params.valueText = valueText; }
        if (fieldKey !== undefined) { sets.push('field_key = @fieldKey'); params.fieldKey = fieldKey; }
        if (unit !== undefined) { sets.push('unit = @unit'); params.unit = unit; }

        const upd = await query(
            `
            UPDATE commercial_case_extracted_requirements
            SET ${sets.join(', ')}
            OUTPUT INSERTED.id, INSERTED.extraction_id, INSERTED.req_type, INSERTED.field_key,
                   INSERTED.value_text, INSERTED.unit, INSERTED.confidence, INSERTED.source_bbox,
                   INSERTED.review_status, INSERTED.reviewed_by, INSERTED.created_at
            WHERE id = @reqId
            `,
            params,
        );
        return res.json(upd.recordset[0]);
    } catch (err) {
        logger.error('reviewRequirement', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

/**
 * GET /cases/:caseId/extracted-requirements-summary
 * Aggrega TUTTI i requisiti estratti da job 'done' sul caso (fonte disegni e testi),
 * filtrati per review_status non rifiutato. Usato dalla tab Checklist per la
 * pre-popolazione assistita (SLICE B — suggerimenti AI da documenti).
 */
async function getExtractedRequirementsSummary(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const caseId = parseId(req.params.caseId);
        if (!caseId) return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');

        if (!(await caseBelongsToOrg(caseId, organizationId))) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }

        const result = await query(
            `
            SELECT
                r.id,
                r.req_type,
                r.field_key,
                r.value_text,
                r.unit,
                r.confidence,
                r.review_status,
                e.source,
                e.provider,
                e.id AS extraction_id
            FROM commercial_case_extracted_requirements r
            INNER JOIN commercial_case_drawing_extractions e ON e.id = r.extraction_id
            INNER JOIN commercial_cases c ON c.id = e.case_id
            WHERE c.id = @caseId
              AND c.organization_id = @organizationId
              AND e.status = 'done'
              AND r.review_status IN ('extracted', 'confirmed', 'edited')
            ORDER BY r.req_type ASC, r.confidence DESC, r.id ASC
            `,
            { caseId, organizationId },
        );

        const requirements = result.recordset;

        // Raggruppa per req_type per facilitare la visualizzazione nel pannello
        const byType = {};
        for (const r of requirements) {
            if (!byType[r.req_type]) byType[r.req_type] = [];
            byType[r.req_type].push(r);
        }

        return res.json({
            case_id: caseId,
            total: requirements.length,
            requirements,
            by_type: byType,
        });
    } catch (err) {
        logger.error('getExtractedRequirementsSummary', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

module.exports = {
    startExtraction,
    listExtractions,
    getExtraction,
    reviewRequirement,
    getExtractedRequirementsSummary,
};
