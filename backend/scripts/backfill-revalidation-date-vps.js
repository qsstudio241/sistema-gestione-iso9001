/**
 * Backfill una-tantum: revalidation_date = expiry_date dove ancora NULL.
 * Non usa AI (la revalidazione tipica ISO 9606-1 coincide con la scadenza
 * exam+3 anni già salvata in expiry_date). Idempotente.
 *
 * Uso sul VPS:
 *   node /tmp/backfill-revalidation-date-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { query } = require('/var/www/sgq-backend/src/config/database');

async function main() {
    const before = await query(`
        SELECT COUNT(*) AS cnt FROM qualifications
        WHERE revalidation_date IS NULL AND expiry_date IS NOT NULL AND status != 'revocata'
    `);
    console.log('Candidati prima:', before.recordset[0].cnt);

    const upd = await query(`
        UPDATE qualifications
        SET revalidation_date = expiry_date, updated_at = GETDATE()
        WHERE revalidation_date IS NULL AND expiry_date IS NOT NULL AND status != 'revocata'
    `);
    console.log('Righe aggiornate:', upd.rowsAffected?.[0] ?? upd.rowsAffected);

    const after = await query(`
        SELECT COUNT(*) AS cnt FROM qualifications
        WHERE revalidation_date IS NULL AND expiry_date IS NOT NULL AND status != 'revocata'
    `);
    console.log('Candidati residui:', after.recordset[0].cnt);
    process.exit(0);
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
