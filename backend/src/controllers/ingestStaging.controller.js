/**
 * ingestStaging.controller.js — conferma/scarto staging IG-3
 */

const logger = require('../utils/logger');
const {
    confirmStaging,
    rejectStaging,
    getStagingById,
    getModuleForDocType,
    parseJson,
} = require('../services/ingestStaging.service');
const { getLicensedModuleKeysForOrg } = require('../services/moduleLicense.service');

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
        });
    } catch (error) {
        logger.error('getStaging', { error: error.message });
        res.status(error.status || 500).json({ error: error.message, code: error.code || 'STAGING_GET_ERROR' });
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

module.exports = {
    getStaging,
    confirmStaging: confirmStagingHandler,
    rejectStaging: rejectStagingHandler,
};
