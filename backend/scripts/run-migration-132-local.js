/**
 * Migration 132 (local) — estensione CHECK user_audit_log per gli eventi del
 * reset password self-service (UAL-4): password_reset_requested, password_reset_completed.
 * Nessuna nuova tabella/colonna: solo il CHECK constraint (idempotente, drop+recreate).
 * Usa backend/config/database.json (ambiente development = DB condiviso SGQ_ISO9001).
 *
 * Uso: node scripts/run-migration-132-local.js
 */
const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/config/database');

async function main() {
    const sql = fs.readFileSync(
        path.join(__dirname, '..', '..', 'database', 'migrations', '132_user_password_reset_audit.sql'),
        'utf8'
    );
    // Nessun GO nel file: eseguibile come singolo batch.
    await query(sql);

    const chk = await query(`
        SELECT definition FROM sys.check_constraints WHERE name = 'CK_user_audit_log_action'
    `);
    const def = chk.recordset[0]?.definition || '';
    console.log('CHECK aggiornato con password_reset_requested:', def.includes('password_reset_requested'));
    console.log('CHECK aggiornato con password_reset_completed:', def.includes('password_reset_completed'));

    await closePool();
    process.exit(0);
}

main().catch((e) => { console.error('ERRORE migration 132:', e.message); process.exit(1); });
