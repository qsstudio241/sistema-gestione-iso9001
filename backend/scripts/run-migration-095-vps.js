/**
 * Migration 095 — commercial_customer_name / commercial_customer_ref su commercial_cases
 * Uso VPS: node /tmp/run-migration-095-vps.js
 */
const fs = require('fs');
const path = require('path');
const { query } = require('/var/www/sgq-backend/src/config/database');

const sqlPath = path.join('/var/www/sgq-backend', 'database', 'migrations', '095_commercial_customer.sql');
const FALLBACK_SQL = '/tmp/095_commercial_customer.sql';

async function run() {
    console.log('Migration 095 — commercial_cases commercial_customer_*');
    const sqlFile = fs.existsSync(sqlPath) ? sqlPath : FALLBACK_SQL;
    if (!fs.existsSync(sqlFile)) {
        console.error('File SQL non trovato:', sqlFile);
        process.exit(1);
    }
    const batches = fs
        .readFileSync(sqlFile, 'utf8')
        .split(/\r?\nGO\r?\n/i)
        .map((b) => b.trim())
        .filter(Boolean);
    for (const batch of batches) {
        await query(batch);
    }
    const verify = await query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'commercial_cases'
          AND COLUMN_NAME IN ('commercial_customer_name', 'commercial_customer_ref')
        ORDER BY COLUMN_NAME
    `);
    const cols = verify.recordset.map((r) => r.COLUMN_NAME);
    if (cols.length !== 2) {
        console.error('VERIFICA FALLITA — colonne attese 2, trovate:', cols);
        process.exit(1);
    }
    console.log('VERIFICA OK:', cols.join(', '));
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
