/**
 * Migration 110 — management_reviews: campi normativi ISO 9001:2015 §9.3.2
 * Aggiunge le colonne mancanti per la piena conformità §9.3.2:
 *   input_context_changes      → §9.3.2 b) Cambiamenti nel contesto
 *   input_customer_satisfaction→ §9.3.2 c)1 Soddisfazione del cliente
 *   input_process_performance  → §9.3.2 c)3 Prestazioni dei processi
 *   input_risk_effectiveness   → §9.3.2 e) Efficacia azioni su rischi/opportunità
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const COLUMNS = [
    { name: 'input_context_changes',       comment: 'S9.3.2 b) Cambiamenti nel contesto' },
    { name: 'input_customer_satisfaction', comment: 'S9.3.2 c)1 Soddisfazione del cliente' },
    { name: 'input_process_performance',   comment: 'S9.3.2 c)3 Prestazioni dei processi' },
    { name: 'input_risk_effectiveness',    comment: 'S9.3.2 e) Efficacia azioni su rischi/opportunita' },
];

async function run() {
    const pool = await getPool();
    try {
        for (const col of COLUMNS) {
            await pool.request().query(`
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID('management_reviews') AND name = '${col.name}'
                )
                BEGIN
                    ALTER TABLE management_reviews ADD ${col.name} NVARCHAR(MAX) NULL;
                    PRINT '${col.name} aggiunto — ${col.comment}';
                END
                ELSE PRINT '${col.name} gia esistente — skip';
            `);
            console.log(`[110] ${col.name} OK`);
        }
        console.log('[110] Migration completata — 4 colonne normative §9.3.2 aggiunte.');
    } catch (e) {
        console.error('[110] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}
run();
