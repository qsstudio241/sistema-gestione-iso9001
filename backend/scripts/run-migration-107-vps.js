/**
 * Migration 107 — ndt_report_items.notes
 * Aggiunge colonna notes per descrizione difetto per riga.
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const SQL = `
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('ndt_report_items') AND name = 'notes'
)
BEGIN
    ALTER TABLE ndt_report_items ADD notes NVARCHAR(MAX) NULL;
    PRINT 'ndt_report_items.notes aggiunta';
END
ELSE
    PRINT 'ndt_report_items.notes gia esistente — skip';
`;

async function run() {
    const pool = await getPool();
    try {
        await pool.request().query(SQL);
        console.log('[107] Migration completata.');
    } catch (e) {
        console.error('[107] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}
run();
