/**
 * Migration 135 — reference_text + linked_legislation su custom_checklist_sections (ADR-019)
 * Uso (solo su VPS, via SSH — vedi backend/scripts/run-on-vps.ps1):
 *   node /tmp/run-migration-135-vps.js
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const pool = await getPool();
    try {
        const refTextCheck = await pool.request().query(`
            SELECT 1 AS x FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'custom_checklist_sections' AND COLUMN_NAME = 'reference_text'
        `);
        if (refTextCheck.recordset.length === 0) {
            await pool.request().query(`ALTER TABLE dbo.custom_checklist_sections ADD reference_text NVARCHAR(MAX) NULL`);
            console.log('[135] Colonna reference_text aggiunta');
        } else {
            console.log('[135] Colonna reference_text gia esistente — skip');
        }

        const linkedLegCheck = await pool.request().query(`
            SELECT 1 AS x FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'custom_checklist_sections' AND COLUMN_NAME = 'linked_legislation'
        `);
        if (linkedLegCheck.recordset.length === 0) {
            await pool.request().query(`ALTER TABLE dbo.custom_checklist_sections ADD linked_legislation NVARCHAR(MAX) NULL`);
            console.log('[135] Colonna linked_legislation aggiunta');
        } else {
            console.log('[135] Colonna linked_legislation gia esistente — skip');
        }

        console.log('[135] Migration completata.');
    } catch (e) {
        console.error('[135] ERRORE:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.close().catch(() => {});
        process.exit();
    }
}
run();
