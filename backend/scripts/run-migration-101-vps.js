/**
 * Migration 101 — Estrazione requisiti tecnici dai disegni. DB di PRODUZIONE (VPS).
 *
 * Uso (da Windows con run-on-vps.ps1):
 *   .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-101-vps.js
 *
 * Riusa la stessa logica idempotente di run-migration-101-local.js.
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { getPool } = require('/var/www/sgq-backend/src/config/database');
const { applyMigration101 } = require('/var/www/sgq-backend/scripts/run-migration-101-local');

async function main() {
    console.log('Migration 101 — DB di produzione (VPS)');
    const pool = await getPool();
    await applyMigration101(pool);
    console.log('  OK: migration 101 completata in produzione.');
    process.exit(0);
}

main().catch((e) => {
    console.error('ERRORE migration 101 VPS:', e.message);
    process.exit(1);
});
