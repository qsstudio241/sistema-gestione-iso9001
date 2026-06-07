/**
 * Billing Controller � dashboard fatturazione (solo superadmin)
 */

const logger = require('../utils/logger');
const billingService = require('../services/billing.service');

async function getOverview(req, res) {
    try {
        const data = await billingService.getBillingOverview();
        res.json({ success: true, data });
    } catch (error) {
        logger.error('[BILLING] getOverview error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore recupero riepilogo fatturazione' });
    }
}

async function getCompanies(req, res) {
    try {
        const organizationId = req.query.organization_id
            ? parseInt(req.query.organization_id, 10)
            : undefined;
        const data = await billingService.getBillingCompanies({ organizationId });
        res.json({ success: true, data });
    } catch (error) {
        logger.error('[BILLING] getCompanies error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore recupero aziende fatturabili' });
    }
}

async function getEvents(req, res) {
    try {
        const limit = req.query.limit;
        const organizationId = req.query.organization_id
            ? parseInt(req.query.organization_id, 10)
            : undefined;
        const data = await billingService.getBillingEvents({ limit, organizationId });
        res.json({ success: true, data });
    } catch (error) {
        logger.error('[BILLING] getEvents error', { error: error.message });
        res.status(500).json({ success: false, error: 'Errore recupero eventi fatturazione' });
    }
}

async function exportCsv(req, res) {
    try {
        const period = req.query.period || billingService.currentPeriodYyyyMm();
        const rows = await billingService.getExportCsvRows(period);
        const csv = billingService.rowsToCsv(rows);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="billing-${period}.csv"`);
        res.send('\uFEFF' + csv);
    } catch (error) {
        logger.error('[BILLING] exportCsv error', { error: error.message });
        const status = error.message.includes('Periodo') ? 400 : 500;
        res.status(status).json({ success: false, error: error.message || 'Errore export CSV' });
    }
}

module.exports = {
    getOverview,
    getCompanies,
    getEvents,
    exportCsv,
};
