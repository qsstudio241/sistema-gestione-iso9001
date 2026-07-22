/**
 * Diagnostica: verifica schema tabella norm_requirements sul DB produzione VPS.
 * Uso: .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\_check-schema-test.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function main() {
    const pool = await getPool();

    // Verifica se la tabella esiste
    const exists = await pool.request().query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='norm_requirements'`
    );
    console.log('Tabella norm_requirements esiste:', exists.recordset[0].cnt > 0);

    if (exists.recordset[0].cnt > 0) {
        const cols = await pool.request().query(
            `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='norm_requirements' ORDER BY ORDINAL_POSITION`
        );
        console.log('Colonne:', cols.recordset.map(r => `${r.COLUMN_NAME}(${r.DATA_TYPE})`).join(', '));

        const rows = await pool.request().query(`SELECT COUNT(*) AS cnt FROM norm_requirements`);
        console.log('Righe presenti:', rows.recordset[0].cnt);
    }

    process.exit(0);
}

main().catch(e => { console.error('ERRORE:', e.message); process.exit(1); });
