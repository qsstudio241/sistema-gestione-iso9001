/**
 * Migration 134 — company_id su non_conformities (Ambito azienda per NC non-audit)
 * Uso (solo su VPS, via SSH — vedi backend/scripts/run-on-vps.ps1):
 *   node /tmp/run-migration-134-vps.js
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const pool = await getPool();
    try {
        const colCheck = await pool.request().query(`
            SELECT 1 AS x FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'company_id'
        `);
        if (colCheck.recordset.length === 0) {
            await pool.request().query(`ALTER TABLE dbo.non_conformities ADD company_id INT NULL`);
            console.log('[134] Colonna company_id aggiunta');
        } else {
            console.log('[134] Colonna company_id gia esistente — skip');
        }

        const fkCheck = await pool.request().query(`SELECT 1 AS x FROM sys.foreign_keys WHERE name = 'FK_nc_company'`);
        if (fkCheck.recordset.length === 0) {
            await pool.request().query(`
                ALTER TABLE dbo.non_conformities
                ADD CONSTRAINT FK_nc_company FOREIGN KEY (company_id) REFERENCES dbo.companies(id)
            `);
            console.log('[134] FK_nc_company aggiunto');
        } else {
            console.log('[134] FK_nc_company gia esistente — skip');
        }

        const idxCheck = await pool.request().query(`
            SELECT 1 AS x FROM sys.indexes
            WHERE name = 'IX_nc_company_id' AND object_id = OBJECT_ID('non_conformities')
        `);
        if (idxCheck.recordset.length === 0) {
            await pool.request().query(`CREATE INDEX IX_nc_company_id ON dbo.non_conformities(company_id)`);
            console.log('[134] IX_nc_company_id creato');
        } else {
            console.log('[134] IX_nc_company_id gia esistente — skip');
        }

        console.log('[134] Migration completata.');
    } catch (e) {
        console.error('[134] ERRORE:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.close().catch(() => {});
        process.exit();
    }
}
run();
