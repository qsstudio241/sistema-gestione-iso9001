/**
 * reprocessTasks.controller.js — pannello superadmin "Rielaborazioni disponibili"
 * (28/07/2026). Espone via HTTP il registro `reprocessableFields.js` e la
 * logica già usata da `backend/scripts/reprocess-qualifications.js`
 * (`qualificationReprocess.service.js`), senza duplicarla: sia lo script CLI
 * sia questo controller chiamano le stesse funzioni di servizio.
 *
 * Decisione di prodotto (non tecnica, confermata dal committente 28/07/2026):
 * nessuno scheduler automatico — ogni rielaborazione consuma AI, quindi resta
 * a lancio manuale on-demand. Questo endpoint sostituisce solo il comando SSH
 * manuale con un pulsante nella dashboard superadmin.
 *
 * Cross-tenant: il superadmin gestisce più organizzazioni (studi clienti).
 * Di default il conteggio/lancio è cross-tenant (nessun filtro organization_id
 * — coerente con `billing.controller.js`); un `organization_id` opzionale in
 * query/body restringe a un singolo tenant.
 */
const logger = require('../utils/logger');
const { listReprocessableFields, getReprocessableField } = require('../data/reprocessableFields');
const { countReprocessCandidates, runReprocessForField } = require('../services/qualificationReprocess.service');

/**
 * GET /admin/reprocess-tasks — elenco voci del registro con conteggio
 * candidati attuali (cross-tenant di default, oppure filtrato su
 * ?organization_id=NNN).
 */
async function listReprocessTasks(req, res) {
    try {
        const orgId = req.query.organization_id ? parseInt(req.query.organization_id, 10) : null;
        const fields = listReprocessableFields();

        const tasks = await Promise.all(fields.map(async (fieldDef) => {
            try {
                const { total, byOrganization } = await countReprocessCandidates(fieldDef.key, { orgId });
                return {
                    key: fieldDef.key,
                    label: fieldDef.label,
                    module: fieldDef.module,
                    table: fieldDef.table,
                    candidate_count: total,
                    by_organization: byOrganization,
                };
            } catch (err) {
                logger.error('[ReprocessTasks] Errore conteggio candidati', { field: fieldDef.key, error: err.message });
                return {
                    key: fieldDef.key,
                    label: fieldDef.label,
                    module: fieldDef.module,
                    table: fieldDef.table,
                    candidate_count: 0,
                    by_organization: [],
                    error: err.message,
                };
            }
        }));

        const totalCandidates = tasks.reduce((sum, t) => sum + (t.candidate_count || 0), 0);
        res.json({ success: true, tasks, total_candidates: totalCandidates });
    } catch (error) {
        logger.error('[ReprocessTasks] listReprocessTasks error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore recupero task di rielaborazione' });
    }
}

/**
 * POST /admin/reprocess-tasks/:key/run — lancia la rielaborazione per un
 * campo del registro. Sincrona (nessun job/coda): pensata per i volumi
 * attuali (decine-centinaia di record) — vedi DEFAULT_RUN_LIMIT nel servizio.
 * Body opzionale: { organization_id, limit }.
 */
async function runReprocessTask(req, res) {
    try {
        const { key } = req.params;
        const fieldDef = getReprocessableField(key);
        if (!fieldDef) {
            return res.status(404).json({ success: false, error: `Campo non registrato: ${key}`, code: 'FIELD_NOT_FOUND' });
        }

        const orgId = req.body?.organization_id ? parseInt(req.body.organization_id, 10) : null;
        const limit = req.body?.limit ? parseInt(req.body.limit, 10) : undefined;

        logger.info(`[ReprocessTasks] Avvio rielaborazione campo="${key}" richiesta da user_id=${req.user?.user_id}`);
        const summary = await runReprocessForField(key, { orgId, limit });

        res.json({ success: true, ...summary });
    } catch (error) {
        logger.error('[ReprocessTasks] runReprocessTask error', { error: error.message });
        res.status(500).json({ success: false, error: error.message || 'Errore durante la rielaborazione' });
    }
}

module.exports = { listReprocessTasks, runReprocessTask };
