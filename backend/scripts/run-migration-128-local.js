/**
 * Migration 128 (local) — projects.technical_review_checklist (additiva, nullable).
 * Usa backend/config/database.json (ambiente development = DB condiviso SGQ_ISO9001).
 *
 * Uso: node scripts/run-migration-128-local.js
 */
const { query, closePool } = require('../src/config/database');

async function main() {
    const r1 = await query(`
        IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'projects' AND type = 'U')
           AND NOT EXISTS (
               SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('projects') AND name = 'technical_review_checklist'
           )
        BEGIN
            ALTER TABLE projects ADD technical_review_checklist NVARCHAR(MAX) NULL;
        END
    `);
    const chk = await query(`
        SELECT COUNT(*) AS cnt FROM sys.columns
        WHERE object_id = OBJECT_ID('projects') AND name = 'technical_review_checklist'
    `);
    console.log('projects.technical_review_checklist presente:', chk.recordset[0].cnt === 1);
    await closePool();
    process.exit(0);
}

main().catch((e) => { console.error('ERRORE migration 128:', e.message); process.exit(1); });
