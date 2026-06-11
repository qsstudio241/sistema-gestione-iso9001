// Script diagnostico temporaneo � verifica colonne tabella qualifications
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function main() {
    const pool = await getPool();

    // Colonne di qualifications
    const colsQ = await pool.request().query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qualifications' ORDER BY ORDINAL_POSITION"
    );
    console.log('=== qualifications columns ===');
    console.log(colsQ.recordset.map(r => r.COLUMN_NAME).join(', '));

    // Colonne di users (per verificare c'� name o altro)
    const colsU = await pool.request().query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' ORDER BY ORDINAL_POSITION"
    );
    console.log('=== users columns ===');
    console.log(colsU.recordset.map(r => r.COLUMN_NAME).join(', '));

    // Colonne di companies
    const colsC = await pool.request().query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='companies' ORDER BY ORDINAL_POSITION"
    );
    console.log('=== companies columns ===');
    console.log(colsC.recordset.map(r => r.COLUMN_NAME).join(', '));

    process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
