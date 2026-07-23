/**
 * Migration 129 (local) — companies.iso3834_level (additiva, nullable).
 * Usa backend/config/database.json (ambiente development = DB condiviso SGQ_ISO9001).
 *
 * Uso: node scripts/run-migration-129-local.js
 */
const { query, closePool } = require('../src/config/database');

async function main() {
    await query(`
        IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'companies' AND type = 'U')
           AND NOT EXISTS (
               SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('companies') AND name = 'iso3834_level'
           )
        BEGIN
            ALTER TABLE companies ADD iso3834_level NVARCHAR(10) NULL;
        END
    `);
    const chk = await query(`
        SELECT COUNT(*) AS cnt FROM sys.columns
        WHERE object_id = OBJECT_ID('companies') AND name = 'iso3834_level'
    `);
    console.log('companies.iso3834_level presente:', chk.recordset[0].cnt === 1);
    await closePool();
    process.exit(0);
}

main().catch((e) => { console.error('ERRORE migration 129:', e.message); process.exit(1); });
