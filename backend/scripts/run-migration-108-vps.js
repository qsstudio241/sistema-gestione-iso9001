/**
 * Migration 108 — attachments.ndt_report_item_id
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const SQL = `
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('attachments') AND name = 'ndt_report_item_id'
)
BEGIN
    ALTER TABLE attachments ADD ndt_report_item_id INT NULL;
    CREATE INDEX IX_attachments_ndt_item ON attachments (ndt_report_item_id)
        WHERE ndt_report_item_id IS NOT NULL;
    PRINT 'ndt_report_item_id aggiunto ad attachments';
END
ELSE PRINT 'gia esistente — skip';
`;

async function run() {
    const pool = await getPool();
    try {
        await pool.request().query(SQL);
        console.log('[108] Migration completata.');
    } catch (e) {
        console.error('[108] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}
run();
