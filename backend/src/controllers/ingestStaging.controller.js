/**
 * ingestStaging.controller.js — conferma/scarto staging IG-3
 */

const logger = require('../utils/logger');
const {
    confirmStaging,
    rejectStaging,
    getStagingById,
    listStaging,
    getModuleForDocType,
    resolveStagingFilePath,
    parseJson,
} = require('../services/ingestStaging.service');
const { getLicensedModuleKeysForOrg } = require('../services/moduleLicense.service');
const { getLearningStats } = require('../services/ingestFeedback.service');

async function assertModuleAccess(req, docType) {
    const role = req.user?.role ? String(req.user.role).trim().toLowerCase() : '';
    if (role === 'superadmin' || role === 'admin') return;

    const moduleKey = getModuleForDocType(docType);
    if (!moduleKey) {
        const err = new Error('Tipo documento non supportato');
        err.status = 400;
        err.code = 'UNSUPPORTED_DOC_TYPE';
        throw err;
    }

    const keys = await getLicensedModuleKeysForOrg(req.user.organization_id);
    if (!keys.includes(moduleKey)) {
        const err = new Error('Modulo non abilitato per la tua organizzazione');
        err.status = 403;
        err.code = 'MODULE_NOT_LICENSED';
        throw err;
    }
}

async function getStaging(req, res) {
    try {
        const stagingId = parseInt(req.params.id, 10);
        const row = await getStagingById(stagingId, req.user.organization_id);
        if (!row) {
            return res.status(404).json({ error: 'Staging non trovato', code: 'NOT_FOUND' });
        }

        await assertModuleAccess(req, row.doc_type);

        res.json({
            id: row.id,
            doc_type: row.doc_type,
            original_name: row.original_name,
            review_status: row.review_status,
            fields: parseJson(row.staged_fields_json, {}),
            field_confidence: parseJson(row.field_confidence_json, {}),
            warnings: parseJson(row.warnings_json, []),
            qualification_type: row.qualification_type,
            committed_wpqr_id: row.committed_wpqr_id,
            committed_qualification_id: row.committed_qualification_id,
            target_qualification_id: row.target_qualification_id,
            target_wpqr_id: row.target_wpqr_id,
            field_scope: row.field_scope,
        });
    } catch (error) {
        logger.error('getStaging', { error: error.message });
        res.status(error.status || 500).json({ error: error.message, code: error.code || 'STAGING_GET_ERROR' });
    }
}

// doc_type -> modulo licenza, usato per validare l'accesso quando si filtra per modulo.
const MODULE_DOC_TYPES = {
    qualifiche: ['patentino_saldatore', 'qualifica_14732'],
    // Generalizzazione 08/08/2026 (migrazione 143): la coda di rielaborazione
    // WPQR usa lo stesso meccanismo, filtrata per modulo "saldatura".
    saldatura: ['wpqr'],
};

/**
 * GET /ingest-staging — coda di revisione: upload pending "classici" e, dalla
 * migrazione 137, anche le proposte di rielaborazione (target_qualification_id
 * valorizzato) generate da backend/scripts/reprocess-qualifications.js.
 * Query: ?module=qualifiche (o ?doc_type=...) — obbligatorio uno dei due, per
 * poter verificare la licenza modulo prima di esporre i dati.
 */
async function listStagingHandler(req, res) {
    try {
        const { module: moduleKey, doc_type: docType, review_status: reviewStatus, reprocess_only: reprocessOnly } = req.query;
        const docTypes = moduleKey ? MODULE_DOC_TYPES[moduleKey] : null;

        if (!docType && !docTypes) {
            return res.status(400).json({ error: 'Specificare module o doc_type', code: 'MISSING_FILTER' });
        }
        await assertModuleAccess(req, docType || docTypes[0]);

        const items = await listStaging({
            organizationId: req.user.organization_id,
            reviewStatus: reviewStatus || 'pending',
            docType: docType || null,
            docTypes,
            reprocessOnly: reprocessOnly === 'true' || reprocessOnly === '1',
            limit: 200,
        });

        res.json({ items, total: items.length });
    } catch (error) {
        logger.error('listStaging', { error: error.message });
        res.status(error.status || 500).json({ error: error.message, code: error.code || 'STAGING_LIST_ERROR' });
    }
}

async function confirmStagingHandler(req, res) {
    try {
        const stagingId = parseInt(req.params.id, 10);
        const row = await getStagingById(stagingId, req.user.organization_id);
        if (!row) {
            return res.status(404).json({ error: 'Staging non trovato', code: 'NOT_FOUND' });
        }
        await assertModuleAccess(req, row.doc_type);

        const result = await confirmStaging(
            stagingId,
            req.user.organization_id,
            req.user.user_id,
            req.body?.fields || {},
        );

        if (result.status === 'duplicate') {
            return res.status(409).json({
                error: 'Record duplicato',
                code: 'DUPLICATE',
                ...result,
            });
        }

        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('confirmStaging', { error: error.message });
        const status = error.code === 'VALIDATION_ERROR' ? 400
            : error.code === 'INVALID_STATUS' ? 409
                : 500;
        res.status(status).json({ error: error.message, code: error.code || 'STAGING_CONFIRM_ERROR' });
    }
}

async function rejectStagingHandler(req, res) {
    try {
        const stagingId = parseInt(req.params.id, 10);
        const row = await getStagingById(stagingId, req.user.organization_id);
        if (!row) {
            return res.status(404).json({ error: 'Staging non trovato', code: 'NOT_FOUND' });
        }
        await assertModuleAccess(req, row.doc_type);

        const result = await rejectStaging(
            stagingId,
            req.user.organization_id,
            req.user.user_id,
            req.body?.delete_file !== false,
        );
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('rejectStaging', { error: error.message });
        const status = error.code === 'INVALID_STATUS' ? 409 : 500;
        res.status(status).json({ error: error.message, code: error.code || 'STAGING_REJECT_ERROR' });
    }
}

async function getStagingFile(req, res) {
    try {
        const stagingId = parseInt(req.params.id, 10);
        const row = await getStagingById(stagingId, req.user.organization_id);
        if (!row) {
            return res.status(404).json({ error: 'Staging non trovato', code: 'NOT_FOUND' });
        }

        await assertModuleAccess(req, row.doc_type);

        const filePath = resolveStagingFilePath(row.storage_path);
        const mime = row.mime_type || 'application/octet-stream';
        const safeName = row.original_name || 'documento';

        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(safeName)}"`);
        res.setHeader('Cache-Control', 'private, max-age=300');
        fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        logger.error('getStagingFile', { error: error.message });
        const status = error.code === 'FILE_NOT_FOUND' ? 404
            : error.code === 'FILE_FORBIDDEN' ? 403
                : 500;
        res.status(status).json({ error: error.message, code: error.code || 'STAGING_FILE_ERROR' });
    }
}

async function getLearningStatsHandler(req, res) {
    try {
        const docType = req.query.doc_type || null;
        const stats = await getLearningStats(req.user.organization_id, docType || null);
        res.json({ success: true, ...stats });
    } catch (error) {
        logger.error('getLearningStats', { error: error.message });
        res.status(500).json({ error: error.message, code: 'LEARNING_STATS_ERROR' });
    }
}

module.exports = {
    getStaging,
    listStaging: listStagingHandler,
    getStagingFile,
    confirmStaging: confirmStagingHandler,
    rejectStaging: rejectStagingHandler,
    getLearningStats: getLearningStatsHandler,
};
