/**
 * Migration 112 (VPS) — management_reviews: input §9.3.2 c)5 monitoraggio e misurazione
 * Aggiunge la colonna mancante per la piena conformità §9.3.2:
 *   input_monitoring → §9.3.2 c)5 Risultati di monitoraggio e misurazione
 *
 * IDEMPOTENTE e ADDITIVO. Uso sul VPS:
 *   .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-112-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const pool = await getPool();
    try {
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 FROM sys.columns
                WHERE object_id = OBJECT_ID('management_reviews') AND name = 'input_monitoring'
            )
            BEGIN
                ALTER TABLE management_reviews ADD input_monitoring NVARCHAR(MAX) NULL;
                PRINT 'input_monitoring aggiunto — S9.3.2 c)5 monitoraggio e misurazione';
            END
            ELSE PRINT 'input_monitoring gia esistente — skip';
        `);
        console.log('[112] input_monitoring OK');
        console.log('[112] Migration completata.');
    } catch (e) {
        console.error('[112] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}
run();
