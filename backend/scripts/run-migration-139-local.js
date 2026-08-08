/**
 * Migration 139 (local) — colonna thickness_max_unlimited su wpqr_records
 * (gap analysis 07/08/2026, WPQR reale VB0377/23, cliente Mason — giunto FW
 * con range spessore aperto "t1 = >=5 ; t2 => 5", nessun limite superiore).
 * Usa backend/config/database.json (ambiente development = DB condiviso SGQ_ISO9001).
 *
 * Uso: node scripts/run-migration-139-local.js
 */
const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/config/database');

async function main() {
    const sql = fs.readFileSync(
        path.join(__dirname, '..', '..', 'database', 'migrations', '139_wpqr_thickness_max_unlimited.sql'),
        'utf8'
    );
    // Nessun GO nel file: eseguibile come singolo batch.
    await query(sql);

    const chk = await query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'wpqr_records' AND COLUMN_NAME = 'thickness_max_unlimited'
    `);
    console.log('Colonna thickness_max_unlimited:', JSON.stringify(chk.recordset[0] || null));

    await closePool();
    process.exit(0);
}

main().catch((e) => { console.error('ERRORE migration 139:', e.message); process.exit(1); });
