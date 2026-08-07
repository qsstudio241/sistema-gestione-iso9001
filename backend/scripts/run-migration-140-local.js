/**
 * Migration 140 (local) — colonna thickness_max_unlimited su qualifications
 * (audit strutturale 07/08/2026 — bug attivo qualificationCoverage.js: un
 * thickness_max_mm NULL veniva sempre trattato come "nessun limite", anche
 * quando il dato era solo assente/non estratto — ISO 3834-2 §8.2).
 * Usa backend/config/database.json (ambiente development = DB condiviso SGQ_ISO9001).
 *
 * Uso: node scripts/run-migration-140-local.js
 */
const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/config/database');

async function main() {
    const sql = fs.readFileSync(
        path.join(__dirname, '..', '..', 'database', 'migrations', '140_qualifications_thickness_max_unlimited.sql'),
        'utf8'
    );
    // Nessun GO nel file: eseguibile come singolo batch.
    await query(sql);

    const chk = await query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'qualifications' AND COLUMN_NAME = 'thickness_max_unlimited'
    `);
    console.log('Colonna thickness_max_unlimited:', JSON.stringify(chk.recordset[0] || null));

    await closePool();
    process.exit(0);
}

main().catch((e) => { console.error('ERRORE migration 140:', e.message); process.exit(1); });
