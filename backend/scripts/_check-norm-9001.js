require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');
async function main() {
    const pool = await getPool();
    const r = await pool.request().query(
        `SELECT clause_ref, clause_title FROM norm_requirements WHERE standard_code='ISO_9001_2015' AND is_current=1 ORDER BY clause_ref`
    );
    console.log(`Totale: ${r.recordset.length}`);
    r.recordset.forEach(x => console.log(x.clause_ref, '-', x.clause_title));
    process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
