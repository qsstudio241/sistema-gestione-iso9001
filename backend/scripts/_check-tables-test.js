/**
 * Verifica dati norm_requirements (prime 5 righe) per capire la struttura reale.
 * Uso: .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\_check-tables-test.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function main() {
    const pool = await getPool();

    const sample = await pool.request().query(
        `SELECT TOP 8 id, standard_code, clause_ref, clause_title, is_current, norm_version FROM norm_requirements ORDER BY id`
    );
    console.log('Prime 8 righe:');
    sample.recordset.forEach(r => console.log(JSON.stringify(r)));

    const distinct = await pool.request().query(
        `SELECT DISTINCT standard_code, norm_version FROM norm_requirements`
    );
    console.log('\nStandard presenti:', JSON.stringify(distinct.recordset));

    process.exit(0);
}

main().catch(e => { console.error('ERRORE:', e.message); process.exit(1); });
