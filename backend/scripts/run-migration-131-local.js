/**
 * Migration 131 (local) — user_action_tokens (invito email, UAL-3) + users.pending_activation
 * + estensione CHECK user_audit_log per invite_sent/invite_accepted/invite_resent.
 * Usa backend/config/database.json (ambiente development = DB condiviso SGQ_ISO9001).
 *
 * Uso: node scripts/run-migration-131-local.js
 */
const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/config/database');

async function main() {
    const sql = fs.readFileSync(
        path.join(__dirname, '..', '..', 'database', 'migrations', '131_user_invite_tokens.sql'),
        'utf8'
    );
    // Nessun GO nel file: eseguibile come singolo batch.
    await query(sql);

    const chk = await query(`
        SELECT COUNT(*) AS cnt FROM sys.objects WHERE name = 'user_action_tokens' AND type = 'U'
    `);
    console.log('Tabella user_action_tokens presente:', chk.recordset[0].cnt === 1);

    const chkCol = await query(`
        SELECT COUNT(*) AS cnt FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.users') AND name = 'pending_activation'
    `);
    console.log('Colonna users.pending_activation presente:', chkCol.recordset[0].cnt === 1);

    await closePool();
    process.exit(0);
}

main().catch((e) => { console.error('ERRORE migration 131:', e.message); process.exit(1); });
