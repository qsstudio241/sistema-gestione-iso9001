'use strict';

/**
 * Genera billing_snapshots per un periodo YYYY-MM.
 * Uso: node backend/scripts/generate-billing-snapshot.js [YYYY-MM]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const billingService = require('../src/services/billing.service');

async function main() {
    const period = process.argv[2] || billingService.currentPeriodYyyyMm();
    console.log(`Generazione snapshot fatturazione per periodo ${period}...`);

    try {
        const result = await billingService.generateSnapshotForPeriod(period);
        console.log(`Completato: ${result.total} aziende elaborate, ${result.inserted} nuovi snapshot.`);
        process.exit(0);
    } catch (err) {
        console.error('Errore:', err.message);
        process.exit(1);
    }
}

main();
