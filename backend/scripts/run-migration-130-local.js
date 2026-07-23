/**
 * Migration 130 (local) — tabella user_audit_log (audit trail gestione utenti, UAL-2).
 * Usa backend/config/database.json (ambiente development = DB condiviso SGQ_ISO9001).
 *
 * Uso: node scripts/run-migration-130-local.js
 */
const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/config/database');

async function main() {
    const sql = fs.readFileSync(
        path.join(__dirname, '..', '..', 'database', 'migrations', '130_user_audit_log.sql'),
        'utf8'
    );
    // Nessun GO nel file: eseguibile come singolo batch.
    await query(sql);

    const chk = await query(`
        SELECT COUNT(*) AS cnt FROM sys.objects WHERE name = 'user_audit_log' AND type = 'U'
    `);
    console.log('Tabella user_audit_log presente:', chk.recordset[0].cnt === 1);
    await closePool();
    process.exit(0);
}

main().catch((e) => { console.error('ERRORE migration 130:', e.message); process.exit(1); });
